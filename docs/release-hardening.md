# Audit fixes and release rollout

Local fixes following the 17 October audit. **Nothing has been deployed or published.**
These changes must be released together; a store upload alone does not update rules,
functions, secrets or account configuration. Signed-device validation remains required.

## Resolved in code

- Private user documents are owner-only. Sharing no longer queries private profiles
  or reads invite documents from the client. Family members can request only their
  child's owner's email through a membership-checked server endpoint.
- Ownership, sharing membership, roles and deletion flags cannot be changed by
  clients. Both family roles can edit ordinary child profiles/logs; owner-only server
  endpoints manage access. Log userId/childId cannot be reassigned. Rules validate a
  reachable child on creation, including atomic initial-weight batches.
- Invitation codes use 48 secure random bits (12 hex characters), expire after 24
  hours and are redeemed transactionally. Creation/sharing are limited to 20 calls
  per account/hour; redemption to 10 attempts/hour. Existing six-character codes
  remain redeemable until their original expiry. Owner/membership/deletion state is
  rechecked inside transactions; removed/changed owners invalidate old invitations.
- Child/account removal runs on the server. Recent authentication (five minutes)
  is checked before account removal begins. Jobs lock account writes; child markers
  lock dependent writes. Logs, partner-owned child logs, child subcollections,
  user subcollections, own suggestions/support requests, invitations, sharing
  memberships and stored photos are cleaned before Auth identity deletion.
  Failures propagate and markers retain progress; retry is idempotent. Client UI
  no longer hides failed child deletions or reports them as successful.
- Child/profile saves await results and retain inputs on failure. Child plus initial
  weight uses one Firestore batch. Photo failures no longer silently report a
  successful child/profile edit. Shared PrimaryBtn supports disabled state.
- AI generation reserves daily quota in a transaction before upstream requests.
  **Attempts consume quota even if generation fails.** Retrying a failed request is
  another attempt, preventing failure/retry storms from bypassing cost limits.
  Network-level retries cannot exceed the daily reservation limit. A reservation
  is not an idempotent response cache: duplicate attempts consume separate quota.
- Apple sign-in uses 32 cryptographically random bytes for its nonce.
- Admin tooling is a development dependency; Firebase Admin for deployed functions
  is upgraded to 14.5.x (Node 22). Compatible transitive dependency updates remove
  all reported critical vulnerabilities and all backend advisories.
- Firebase Functions SDK is 7.4.x, which declares compatibility with Admin 14.x.
  A clean `npm ci --prefix functions` was verified under Node 22; do not bypass
  peer dependency checks with `--force` or `--legacy-peer-deps`.
- The app stays on Expo 57 / React Native 0.86.3. Purchase and Google native SDKs
  are pinned to previously validated versions instead of introducing unrelated
  native feature upgrades during security work. A fresh release build is still
  required; exports are not signed device tests.

## Data removal semantics

Deleting a child removes that owned child's logs from all family members, lists,
invites and photos whose ownership can be verified. Deleting an account removes all owned children and
that account's own records, plus membership in children owned by other accounts.
Other owners' child profiles and records remain. No ownership transfers occur.

Photo cleanup accepts only expected bucket paths belonging to the record owner;
client-supplied URLs cannot instruct the server to delete another user's arbitrary
photo. Deterministic child-photo filenames for known collaborators are also removed.
Legacy food photos uploaded by a different family editor can remain in that editor's
Storage folder until their account is removed; the current records do not reliably
record that uploader. A trusted media-ownership migration is needed to clean those
objects automatically without trusting arbitrary client-supplied URLs.
Local account preferences/drafts and scheduled notifications are cleared on successful
account removal from the current phone. Other offline devices retain their local
cache until those devices are cleared; this is not remote device erasure.

Store subscriptions are not cancelled by account deletion. The confirmation now
says to cancel through Apple/Google. Store/RevenueCat financial records and upstream
provider retention are separate from Firebase application-data deletion.

Large deletions can exceed a callable's 540-second timeout. Retry from Settings;
completed work is not recreated. A fresh sign-in may be required before retrying.
Account deletion jobs are private; operational support should monitor jobs with
status `running`, rather than treating an interrupted response as completion. A
minimal UID-keyed `completed` tombstone remains after deletion to reject still-valid
old ID tokens. It contains timestamps/status, not the removed profile or child data.
Do not remove tombstones while old tokens could still be accepted.

## Dependency exceptions — not a zero-advisory claim

The backend audit reports **zero vulnerabilities**. The app/root tree reports
**15 high package entries tracing to two underlying upstream advisories**, with no
critical/moderate/low entries at verification time:

- [braces nested-pattern recursion](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm):
  no patched release is available. Used by Metro/micromatch tooling.
- [node-forge signature verification](https://github.com/advisories/GHSA-86w9-cpqp-85rv):
  no patched release is available. Used by Expo CLI/code-signing tooling.

Neither appears in exported iOS/Android JS source maps, and neither is in the
Cloud Functions dependency tree. That limits mobile/backend exposure but does not
make local build tooling invulnerable. Use trusted repository patterns/certificates
and keep development servers private. We did not invent a crypto patch or force npm's
suggested incompatible Expo downgrade. Follow upstream fixes and remove exceptions
when available. `npm run audit:reviewed` fails on new advisories and requires review
of these exceptions by 17 November 2026. CI separately verifies both exported bundle
graphs to prevent these dependencies being introduced into shipped JavaScript.

## Deployment order and compatibility

1. Verify a staging/test environment and a current backend backup. Configure
   `REVENUECAT_SECRET_API_KEY` using a RevenueCat v1 secret for the correct project:

   ```sh
   firebase functions:secrets:set REVENUECAT_SECRET_API_KEY --project munchsprouts
   ```

2. Deploy the reviewed new/changed functions before enabling their callers:

   ```sh
   firebase deploy --project munchsprouts --only functions:generateInsights,functions:generateMealIdeas,functions:generateWeeklyMealPlan,functions:generateInviteCode,functions:joinViaInviteCode,functions:manageSharing,functions:familyOwnerDetails,functions:deleteChildData,functions:deleteAccountData
   ```

3. Deploy the Firestore and Storage rules as the coordinated security release:

   ```sh
   firebase deploy --project munchsprouts --only firestore:rules,storage
   ```

   Storage rules now consult Firestore's deletion marker. Complete any requested
   service permission setup and verify real photo uploads/deletion locks in staging.
   Recipe writes now require an `admin: true` Auth custom claim; Admin SDK scripts
   bypass rules as before. Do not reintroduce email-based admin authorization.

4. Install the matching app through TestFlight and Play internal testing. Verify
   the checklist in iphone-testing.md and the original audit, especially real
   identity providers, RevenueCat purchase/restore/expiry, deletion, family sharing,
   notifications, photos and offline retries. Resolve the Apple Developer account
   login issue before attempting signed iOS builds.

5. Commit/review the exact final revision and release only after signed-device checks.

**Older app versions:** profile lookup, direct invitation reads, direct sharing edits
and client-side child/account deletion will be denied by the new rules. That is
intentional; keeping those paths open would retain the vulnerabilities. Communicate
that users must update for sharing/deletion. Do not deploy stricter rules as an
unannounced isolated change and promise old clients remain fully compatible.

## Local verification

- App regression suite: 164 passing tests.
- ESLint (undefined identifiers, duplicate keys, unreachable code, Hooks rules): pass.
- Consistent Prettier formatting added across app, server and test source.
- Expo Doctor: 21/21.
- Production JS exports: iOS and Android pass; reviewed tooling packages absent.
- Firestore emulator: owner saves, shared editing boundaries, immutable identities,
  protected counters, private profiles, private invitations, atomic child/weight save.
- Server helpers against real Firestore transactions: quota contention, one-use
  invitation contention, owner checks, shared-child cleanup, recent-login rejection,
  retry after simulated Storage failure, and nested user cleanup.
- Storage emulator: own uploads allowed; cross-account writes and writes during
  deletion blocked. Auth deletion and production Storage are fake boundaries in
  the server helper tests; production credentials/services still need validation.

The historical audit remains as evidence of the original findings. This document
records remediation and the remaining external release gates; it does not certify
production deployment or guarantee all device/store behaviours.
