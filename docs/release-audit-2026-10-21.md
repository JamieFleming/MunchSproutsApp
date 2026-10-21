# Release review: MunchSprouts 1.6.1

## Release decision

Use a new iOS and Android production build. This revision updates Expo to
57.0.31 and expo-sharing to 57.0.24 and removes unused native dependencies.
The fingerprint runtime policy intentionally separates this native runtime from
previous builds. Do not send this revision as an OTA to old binaries.
EAS manages build numbers remotely and increments them for production builds;
the misleading local build number/versionCode fields have been removed.

No store release, OTA, backend deployment or rules deployment was performed as
part of this review.

## Changes and cleanup

- Food entry sheet, scoped drafts, clear-entry controls, optional custom food
  groups, other texture/meal choices, and prominent favourite action.
- Log calendar with food/milk/weight markers, collapsible dates and swipe hints.
- Updated dashboard counts, menus/backdrops, allergen layout, child profile and
  settings disclosures, notification preferences, and sign-out confirmation.
- Centralised local reminder reconciliation and per-allergen 48-hour check-ins.
  Initial data-load failure no longer treats an empty snapshot as grounds to
  cancel reminders. Reconciliation waits for saved preference loading too.
- Removed obsolete reminder UI/scheduler and unused notification helpers,
  unused MealsHub row component and unused imports. Retained behaviour-focused
  comments and the beginner codebase guide.
- Removed unused Fredoka font, document picker and RevenueCat prebuilt paywall
  package. The custom purchase UI and RevenueCat SDK remain in use.
- Removed tracked `.claude` permissions and `.fallow` cache; ignored both paths.
  Local backups, along with stale export/log files, are at
  `~/.codex/backups/munchsprouts/2026-10-21/`. These are optional development tool
  files, not app dependencies. Credentials, signing keystore, native development
  folders and installed dependencies were retained. Historical audit reports
  are retained as review records, not runtime dependencies.

## Verification

- 184 automated tests pass, including subscriptions, data operations, forms,
  calendars, reminder reconciliation, Android notification channels and swipes.
- ESLint, formatting and Git whitespace checks pass.
- Expo Doctor: 21/21 checks pass.
- Firestore/Storage emulator suite passes, including cross-account access,
  sharing escalation, concurrent quotas, deletion retries and upload isolation.
- iOS and Android production JavaScript exports succeed; source-map scans find
  neither `braces` nor `node-forge` in shipped JavaScript.
- Cloud Functions dependency audit: zero vulnerabilities. App/tooling audit
  retains the two documented upstream advisory exceptions; it is not a
  zero-advisory dependency tree. See `release-hardening.md`.

Tests ran locally on Node 24; GitHub CI targets Node 22. The React test harness
mocks native services and does not execute React effects. Exporting JavaScript
is not equivalent to compiling and running the native store binary. This review
does not certify production service configuration or every device interaction.

## Before store release

1. Build with `eas build --platform all --profile production`.
2. Upload the builds to TestFlight and Google Play internal testing.
3. Test upgrade from the installed release without clearing app data, plus a
   fresh account: onboarding, child selection, themes and saved preferences.
4. Test Apple/Google/email login, sign-out confirmation, photo uploads, and food,
   milk and weight create/edit/delete/repeat flows. Check food draft recovery,
   calendar dates, favourite state, keyboard layout and swipe gestures.
5. Test notification allow/deny and phone settings, bottle reminders, allergen
   check-ins, app reopen and notification taps on both platforms. Turning off
   reminders and signing out must cancel local reminders.
6. Test monthly/yearly/lifetime purchases and restoration with store sandbox
   accounts; verify Pro at expiry and cross-device account access. Cancellation
   of renewal keeps access through the paid period; expiration removes it.
7. Test family sharing, recipe/planner/shopping flows, account deletion and
   support. Check real error/retry behaviour with the network disabled.
8. Release only after those device checks and EAS native builds pass.

The app still has large orchestration/screens. This pass removes clearly dead
code and introduces shared disclosure/calendar/reminder modules; it deliberately
avoids rewriting working data and subscription flows immediately before release.
