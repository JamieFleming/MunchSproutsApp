# Saving, drafts, undo and Pro verification

Changes are local and unpublished. iPhone testing still requires the SDK 57
preview/development build described in iphone-testing.md.

## App behaviour

- Food, milk and weight forms wait for successful saves, block repeated taps,
  and retain inputs after failures. Dashboard and onboarding preferences show
  saved feedback; failed favourite/unit changes show an error.
- New food drafts are saved on this phone, separately for each account and child.
  Reopening the form restores the draft. Successful saves clear it. Explicit
  repeat-food or allergen prefills take precedence over a stored draft.
  Drafts are not cloud backups; local photo files may not remain available forever.
- The most recent deleted food, milk or weight entry has a floating Undo pill for six seconds,
  positioned above the navigation/add button without changing the layout.
  The timer pauses during restoration and restarts if restoration fails. Undo restores the original ID and details and
  refuses to overwrite an existing record. A failed restore can be retried.
  Dismissing the pill, its timeout, another deletion or closing the app ends this option.
- Empty food and milk logs offer a direct action to create the first entry.

## Server protection — deployment required

The later security audit also changed sharing, deletion and Storage rules.
Follow **[release-hardening.md](release-hardening.md)** for the full coordinated
deployment; the three AI functions alone are no longer the complete rollout.

The three premium AI callables verify RevenueCat's `pro` entitlement for the
**authenticated Firebase UID** before returning cached data or calling AI.
Client `isPro` flags and Firestore plan mirrors do not authorize these functions.
Expired subscriptions are denied; cancellation keeps access through paid expiry.
Grace periods and non-expiring lifetime entitlements are supported. Network or
configuration failures deny the request with a retry/configuration error.

The rules also prevent client writes to AI usage counters and cached insights.
This is a targeted change, not a full audit of all existing sharing rules.

When ready to release, configure a RevenueCat v1 secret API key through the
Firebase CLI prompt (never put it in app code or chat), then deploy:

```sh
firebase functions:secrets:set REVENUECAT_SECRET_API_KEY --project munchsprouts
# Follow the complete function/rules deployment sequence in release-hardening.md.
```

Confirm RevenueCat app user IDs match Firebase UIDs. Test active, expired,
cancelled-but-paid, grace-period and lifetime sandbox customers, and an unavailable
RevenueCat service, before release. These changes do not update Firestore plan
mirrors while the app is closed; the app still refreshes that mirror on verification.

Reference: [RevenueCat customer info model](https://www.revenuecat.com/docs/api-v1/customer-info-model).

## Repeatable checks

```sh
npm test
npm install --prefix tests/rules
firebase emulators:exec --config firebase.emulator.json --project demo-munchsprouts --only firestore "node tests/rules/verify.cjs"
npx expo export --platform all --output-dir /tmp/munchsprouts-reliability-export
```

The rules check uses a demo project and an emulator; it does not change production.
A supported Java runtime and Firebase CLI are required.

On iPhone, interrupt each save with airplane mode, retry after reconnecting,
reopen an unfinished food entry, switch child/accounts, and delete/undo each log
type. Confirm restored records remain after restarting. Test preferences and
empty-state buttons with a new account as well as an existing account.

Local validation: 161 regression tests passed; Firestore emulator checks passed;
iOS and Android production JavaScript exports passed. All 52 app source files
parsed without duplicate JSX attributes. Live purchases and physical-device
interaction still require the checks above.

Food attempts and milk entries support swiping left to reveal actions that stay
open. Swipe right to close them, or tap an action. In the grouped food view,
expand a food to swipe a specific attempt. Food actions include Favourite (or
Unfavourite), Repeat, and Delete. Repeat opens the existing prefilled food form
for review. Milk rows offer Repeat and Delete. Repeating milk opens a new feed
with the same feeding details and the current local date/time; previous symptoms
and notes are cleared so they are not recorded as a new observation. Tapping Delete opens a cancellable confirmation;
a swipe alone never requests deletion. Short or predominantly vertical gestures
do not open the actions. The existing buttons and six-second Undo pill remain.
Verify gesture feel and vertical scrolling on a physical iPhone before publishing.
