# SDK 57 upgrade

The local project now targets Expo 57.0.30, React Native 0.86.3 and React 19.2.3.
The app version is 1.6.0. Nothing has been published or submitted.

## Release requirements

This is a native upgrade. Install a new development build to test it, then use a
new App Store/TestFlight build to deliver it. Do not publish this bundle as an
update to the old SDK 54 / runtime 1.5.0 app.

Runtime matching uses Expo's `fingerprint` policy, so SDK 57 binaries and OTA
updates must share compatible native dependencies/configuration. Old app
installs retain their existing app and update runtime.

SDK 57 requires iOS 16.4 or newer and Xcode 26.4 or newer. The local Xcode is
26.5. The EAS profiles use the `sdk-57` image alias (currently Xcode 26.6). Building
with Xcode 27 requires the separate SDK 57 scene-lifecycle opt-in; do not select
an Xcode 27 image without configuring and testing it.

Use a current EAS CLI (the config requires 25.1.1 or newer):

```sh
npx eas-cli@latest build --platform ios --profile development
npx expo start --dev-client
```

For TestFlight, after device validation:

```sh
npx eas-cli@latest build --platform ios --profile production
```

These commands build only; no build or submission has been started on EAS here.
For later compatible OTA releases, SDK 57 requires the environment flag:

```sh
npx eas-cli@latest update --channel production --environment production --platform ios --message "Your update description"
```

## Migration changes

- Updated Expo modules, React Native, React, safe-area-context and SVG to Expo's
  SDK 57 version recommendations. A strict peer-dependency resolution dry run also passed.
- Migrated splash configuration to the expo-splash-screen plugin, retaining the
  existing logo and white background.
- Added required Expo config plugins and expo-system-ui for Android light-mode
  configuration. Removed obsolete architecture/edge-to-edge flags.
- Migrated Android image caching to async `File.copy` and `Paths.cache`.
- Updated notification presentation and trigger/channel configuration.
- Added targeted modular headers for GoogleUtilities and RecaptchaInterop, needed
  by Google Sign-In's AppCheckCore Swift dependency during CocoaPods integration.
- Regenerated ignored native projects from app config. The generated folders are
  not source files for EAS: the config plugins preserve these build changes.
- Made EAS environments explicit and updated its minimum CLI version.

RevenueCat, Firebase identity, bundle identifiers, product entitlement name,
OAuth callback schemes and the existing EAS project ID are retained.

## Validation and remaining device checks

Expo Doctor: 21/21 checks pass. Expo dependency version validation passes. Both
iOS and Android JavaScript exports pass. All 136 automated checks pass (run
`npm test`). Android native `:app:assembleDebug` completed successfully with Java 17.
iOS native Release simulator build completed successfully with Xcode 26.5.
The compiled release app was installed and launched on an iPhone 17 simulator
(iOS 26.5), successfully displaying the sign-in screen. The unsigned simulator
build logged a notification keychain entitlement error and an update-fetch
error; signed-device push registration and compatible OTA fetching remain
unverified. No fatal startup exception was observed.
Tests mock service responses and do not prove actual store transactions or
production Firebase writes.

Before publishing, test on an iPhone with a test account:

- Email, Apple and Google sign-in; sign-out/relaunch and auth persistence.
- Five-step onboarding, photos, resume, completion screen and dashboard.
- Monthly/annual/lifetime sandbox purchases, restore and expiry.
- Food, milk, allergen and weight entries; editing and deleting records.
- Photo uploads, PDF exports/sharing and recipe imports.
- Push permissions, meal/bottle reminders, and foreground notification display.
- OTA fetching on a newly built SDK 57 binary with matching fingerprint.

Pre-upgrade package/config snapshots and a native-source archive are in
`/tmp/munchsprouts-before-sdk57`. They are local temporary recovery files, not a
source-control checkpoint. Existing uncommitted app work was preserved.

Local build note: the synced Documents folder attached Finder metadata to the
JSI generated framework, blocking its nested code-sign step. Relocating only
`.DerivedData` did not help because the upstream script recreates it. For this
validation the ignored `expo-modules-jsi/apple` directory was temporarily moved
outside the synced tree, with a symlink retaining its original module path. No
dependency source was patched, and the directory was restored after validation.
For reliable local builds, keep the checkout
outside cloud-synced folders.

## Follow-up regression review — 1.6.0

App, package and lockfile versions now all read 1.6.0. Production EAS build
numbers remain remotely managed with auto-increment enabled.

Fixed during this review:

- Returning Apple sign-in no longer writes `plan: free` over an existing user's
  RevenueCat subscription mirror. New users still start free.
- Smart Meal Ideas and the weekly planner now receive onboarding/profile known
  allergies, other allergies, legacy exclusions and recorded allergic reactions.
  A previous positive log cannot override a profile allergy in meal context.
- The weekly planner calculates age from the child's date of birth rather than
  normally falling back to six months.

Validation after these fixes:

- `npm test`: 136/136 pass, comprising 98 screen render scenarios and 38 targeted
  behaviour checks. Screens cover iOS/Android, free/Pro and empty/populated logs,
  plus authentication. The checks exercise actual component/helper code with
  native modules and remote services mocked; they do not simulate every tap,
  run React effects, validate native layout, or establish live service access.
- Data checks cover food/milk/weight writes and edits, profile photo upload paths,
  recipe favourites, returning sign-ins and meal-generation request payloads.
- Existing onboarding persistence/retry/completion, subscription expiry/restore
  and SDK notification/file compatibility checks continue to pass.
- Expo Doctor: 21/21; dependency validation passes; fresh iOS/Android production
  JavaScript/Hermes exports pass. No undefined identifiers were found in the
  app/source static scan.
- The native iOS/Android builds and simulator startup documented above were
  completed during the SDK migration. This follow-up changes JavaScript and
  package version metadata; it has not produced another signed device build.

No production accounts, purchases, Firebase data or deployments were changed
by validation. The signed-device checklist above remains required before release,
including live family sharing, recipe imports/AI service responses, PDF sharing,
notification delivery, purchases and end-to-end onboarding with a test account.

Final review also fixed bottle-reminder permission after choosing Not now during
onboarding, and explicitly assigned Android bottle reminders to their channel.
The notification service comment now accurately describes its native requirement.
See [iPhone testing](iphone-testing.md) for standalone preview installation and
known backend authorization limitations. All 55 tracked JavaScript files were
parsed and checked for unresolved identifiers; the only extra Node global used
by tests is `setImmediate`. Cloud Functions syntax and git whitespace checks pass.
