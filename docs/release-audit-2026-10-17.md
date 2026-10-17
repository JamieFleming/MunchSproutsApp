# Release readiness audit — 17 October 2026

**Historical findings — remediation is recorded in [release-hardening.md](release-hardening.md).**

**Decision at audit time: do not publish this working tree yet.** The app passes current
regression and compatibility checks, but confirmed privacy/data-deletion defects
and unverified native/store integrations prevent a release recommendation.

This audit covers the current local working tree (version 1.6.0 / Expo SDK 57),
including uncommitted changes. It does not certify the deployed Firebase rules,
functions, Apple/Google console settings, RevenueCat products or store binaries.
No production data was accessed or changed and nothing was deployed/published.

## Findings, in priority order

### 1. BLOCKER — authenticated users can enumerate family invitation codes

`firestore.rules:104` grants any authenticated account read access to the entire
inviteCodes collection, including list queries. The join function grants access
using a valid unused code. An unrelated account can therefore discover invitations
without the owner providing one, then attempt to redeem one to obtain child access.
Local emulator reproduction confirms enumeration succeeds.

Fix: deny client reads/listing of inviteCodes; retrieve and redeem only through
validated server calls. Use cryptographically random codes and rate limiting.
`functions/index.js:515` also checks/consumes invitations without a transaction;
concurrent redemptions can both observe unused status. Consume the code and update
membership atomically. Validate role and ownership server-side.

### 2. BLOCKER — private profiles are readable by unrelated accounts

`firestore.rules:10` permits every signed-in account to read any user document,
not just a limited sharing lookup. The emulator successfully read a fictional
parent's private profile from an unrelated account. Profiles include email/name
and onboarding/preferences fields.

Fix: owner-only private profiles. Move minimal sharing lookup data behind a
restricted server endpoint or separate appropriately protected document. Update
family lookup clients together with the rules; blindly removing the read permission
may otherwise break the existing sharing UI.

### 3. BLOCKER — collaborators can rewrite ownership and sharing permissions

`firestore.rules:26` permits unrestricted child updates by anyone already in
sharedWith. The emulator confirmed a caregiver can change userId to themselves
and replace sharedWith with another account. Log update rules likewise do not
protect userId/childId against reassignment.

Fix: protect immutable ownership/parent identifiers, restrict changed fields by
role, and reserve membership/role changes for owner-authorized server operations.
Test both normal collaborative editing and attempted ownership escalation.

### 4. BLOCKER — account/child deletion is incomplete and can partially destroy data

`src/firebaseHooks.js:291` deletes child documents before querying shared logs.
The emulator confirmed this removes the owner's permission to read/delete a
partner-owned log. Cleanup errors are caught and logged and deletion proceeds.
Recipe suggestions cannot be queried/deleted under current rules either, also
confirmed in the emulator. Weight cleanup only queries the deleting user's entries.

Other omitted cleanup includes user lists, smart recipes, insight/usage documents,
child subcollections, food photos, local food drafts and shared memberships.
Deleting a parent document does not perform this explicit application cleanup.
`deleteChild` at line 508 similarly deletes the parent first and omits weight data.
Firebase Auth deletion happens last, with no preceding recent-login/reauthentication
flow in this helper; failure there leaves data already removed and the account alive.

Fix: authenticated, resumable server-side deletion with complete child/log/photo/
subcollection cleanup and explicit reauthentication before destructive work.
Handle partial failures durably and verify completion rather than silently reporting
success. Define retention and shared-family ownership semantics before implementing.

### 5. RELEASE GATE — premium backend verification is not confirmed live

The local `functions/revenuecat.js` and three AI callables now verify RevenueCat
using the authenticated Firebase UID. Their new secret and rules require deployment.
This audit did not inspect or deploy production functions/secrets; a store app
upload alone does not install these backend changes. See reliability.md.

Verify the server secret and deployed guards, then test active, expired, cancelled
but still paid, grace-period, restored, refunded and lifetime customers on real
store sandbox accounts. Test switching Firebase accounts on the same phone.
Firestore plan remains client-writable and must never become an authorization source.

### 6. HIGH — dependency advisories require triage and compatible updates

Current `npm audit --omit=dev` results:

| Dependency tree | Critical | High | Moderate | Low | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| App/root | 2 | 22 | 16 | 1 | 41 |
| Cloud Functions | 2 | 6 | 10 | 0 | 18 |

Full machine-readable reports are in `docs/audit/dependencies-*.json`. These are
reported vulnerable package counts, not confirmed exploitable app paths; the
root tree includes build tools and admin tooling declared as dependencies.
Critical entries include proxy-addr and websocket-driver. Runtime reachability
and configuration need review, particularly for deployed functions.

Do not use `npm audit fix --force`: suggested remediations include downgrading
Expo/React Native to incompatible older majors. Update compatible transitive
packages and server libraries deliberately, then rerun build/integration checks.
Move administrative script dependencies out of the app runtime dependency group
where practical; do not assume package.json inclusion means bundled exposure.

### 7. MEDIUM — child forms still close before saves finish

`src/screens/ChildrenScreen.js:59` invokes onAdd/onEdit and closes immediately.
`src/screens/ChildDetailScreen.js:353` does the same for profile/allergy edits.
`App.js` editChild catches save failures without returning success/failure. Failed
network saves can lose the visible edits and repeated taps are not consistently
blocked. Add-child plus initial-weight operations are separate; a weight failure
can leave a child created while displaying an overall failure.

Fix: apply the shared async save contract to child forms and define partial-save
handling. On failure retain the form; on success close once. Photo failures should
be explained rather than silently retaining the previous photo and saying Updated.

### 8. MEDIUM — AI daily limits are vulnerable to concurrent requests

`functions/index.js:236` and `:458` read counters before AI generation and write
later (`:285`, `:509`), without atomic reservation. Simultaneous requests can pass
the same limit and make additional paid AI calls. Restricting client counter writes
does not fix this race.

Fix: transactionally reserve quota before generation, with deliberate retry,
idempotency and failed-request accounting. Add concurrent-call tests.

### 9. MEDIUM — Apple sign-in nonce uses Math.random

`src/screens/AuthScreen.js:140` uses Math.random for the raw OAuth nonce. The nonce
should use cryptographically secure random bytes (expo-crypto is already installed),
then be hashed and bound to the Firebase credential as it is now. This is separate
from the reported Expo Go availability issue and Apple Developer account lock.

## What was verified

- **164/164 regression tests passed.** These include model/data tests and mocked
  screen rendering, save failures, drafts, swipe confirmation and subscription logic.
- **21/21 Expo Doctor checks passed.** This checks compatibility/configuration,
  not app-store readiness or account credentials.
- Fresh **iOS and Android production JS exports succeeded**, output in
  `/tmp/munch-release-audit-export` (not published).
- **54 app source files parsed**, no duplicate JSX attributes or unbound C theme
  identifiers found in that targeted static check. This is not a complete lint check.
- Existing Firestore emulator tests passed for owner saves, log restoration and
  protected AI usage/cache writes.
- Additional demo-emulator reproductions confirmed findings 1–4. These intentionally
  assert the current unsafe behaviour and are kept separate from the normal suite.
- `git diff --check` passed. No known credential-file names matched tracked files in
  the targeted check; this is not a full repository-history secret scan.

Reproduce the security audit using the installed standalone rules-test dependencies:

```sh
npm install --prefix tests/rules
firebase emulators:exec --config firebase.emulator.json --project demo-munchsprouts --only firestore "node tests/rules/audit.cjs"
```

`tests/rules/audit.cjs` is an audit reproducer, not a desired-security regression
specification. Convert it to rejection assertions as fixes land. This audit used
Java 26 and temporary rules-test dependencies, and did not contact production data.

## What still needs release-device / store validation

No new signed production archive was built/submitted during this audit. Earlier
simulator/native build results do not prove the current store release works.
Expo Go currently reports Apple auth unavailable on the user's phone, and EAS Apple
credential authentication is blocked by the reported account lock. Neither result
establishes the behaviour of a properly signed store build.

Before release, complete:

1. Resolve Apple Developer credentials; build the exact final production commit for
   both platforms and install through TestFlight / Play internal testing.
2. Verify fresh Apple and Google sign-in, cancellation, existing accounts, logout,
   password reset, reauthentication and completed account deletion.
3. Verify RevenueCat products/offering prices and the purchase/restore/expiry matrix
   against the deployed backend, including monthly/annual/lifetime products.
4. Test first-time and returning-user onboarding, child switches, known allergies,
   dashboard settings persistence, photos, milk/food/weight saves, offline failure,
   swipe actions, repeat and Undo on actual devices.
5. Test family invitations/roles/revocation and cleanup after deletion against fixed
   rules, including both collaborators editing entries.
6. Verify reminders with permission granted/denied and app backgrounded, PDFs,
   shopping lists, meal planning, sharing, large text, keyboard and small screens.
7. Confirm the production environment contains required Firebase/Google config,
   OAuth redirect/Android signing fingerprints, notification credentials, backend
   secrets and store product settings. These were not remotely inspected here.
8. Commit and review the final working tree, then build that exact revision. Many
   recent UI/reliability changes are currently uncommitted/untracked.

## Cleanliness, comments and future maintenance

The code is understandable in places and recent small modules are useful seams:
`subscriptionSession`, `dashboardModel`, `appAccent`, `foodDraftStore`,
`useSaveAction` and the reusable swipe component. Comments explaining identity
serialization, immutable IDs and draft-write ordering add real value. Feature docs
now explain much of the intended behaviour.

However, it is **not consistently clean or easy to maintain yet**:

- App.js is about 2,482 lines; MealPlannerScreen about 2,333; LogScreen 1,590;
  MoreScreen 1,499. They mix UI, persistence, navigation and business decisions.
- Formatting varies between tabs/spaces and dense single-line JSX. Split screens
  into focused components/hooks and adopt one formatter in CI.
- There is no lint/typecheck script or checked-in CI workflow in the inspected tree.
  Add linting (including hooks rules), incremental types/JSDoc at data boundaries,
  and automated tests/Expo compatibility checks on changes.
- Some comments overpromise. Account cleanup comments say partner data is removed,
  but permissions and omitted collections prevent it. Apple JWT comments say email
  is always present, while the implementation itself treats it as optional. Comments
  must describe guarantees actually enforced by the code.
- Async success/failure contracts differ by form; swallowing errors allows partial
  success to appear complete. Standardize these contracts and use structured errors.
- The screen harness intentionally does not run effects or real native services.
  A green count is useful regression evidence, not proof of login, swipe feel,
  permissions, purchases, notifications or live Firestore behaviour.
- Keep semantic colours separate from decoration and document the legacy purple
  token names now used for any chosen accent to reduce future confusion.

Prioritize privacy/cleanup fixes and release-device validation before broad cosmetic
refactoring. Adding comments to unsafe code is not a substitute for fixing its
behaviour. This audit created evidence and documentation; it did not silently
change production rules, dependencies, account-deletion semantics or app behaviour.
