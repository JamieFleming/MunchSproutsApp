# Test MunchSprouts 1.6.0 on an iPhone

Use a standalone **preview** build for this release. It contains SDK 57 native
modules and the bundled app, so it runs without Metro or a connected Mac.
Expo Go and an OTA update to the existing SDK 54 app cannot test this upgrade.
Requires iOS 16.4 or newer and access to the project's Apple Developer team.

From the project folder:

```sh
npx eas-cli@latest login
npx eas-cli@latest device:create
npx eas-cli@latest build --platform ios --profile preview
```

1. Skip login if already signed in to the correct Expo account.
2. Follow device registration on your iPhone. Register before building; if the
   device is already registered, reuse it. Include your iPhone when EAS asks
   about the provisioning profile. Follow the Apple signing prompts.
3. Once the build finishes, open its EAS installation link/QR on your iPhone
   and tap Install. This is an internal build, not an App Store submission.
4. Open MunchSprouts. No `expo start` command is needed for a preview build.

The preview uses the same bundle identifier and Firebase configuration as the
live app. Installing it may replace the current MunchSprouts installation on
that phone, and account changes use the real backend. Use a dedicated test
account and fictional child details. No separate staging backend is configured.

## Recommended test sequence

- Create a fresh email account to exercise all five onboarding screens. Existing
  accounts correctly skip onboarding. Test back navigation, optional photos,
  date validation, allergy selections, notification permission and priorities.
- Finish onboarding: confirm the personalised completion screen opens the
  dashboard, then close/reopen the app and confirm it does not repeat.
- Check parent details in More, child details in their profile, known allergies
  in the allergen tracker, and dashboard preferences. Edit and relaunch.
- Add, edit and delete food, milk and weight entries. Try photos, favourites,
  child switching and family sharing with another test account.
- Open recipes, shopping lists, meal planner, Smart Meal Ideas, PDF export and
  sharing. Confirm online service responses and error handling.
- If you skipped notifications, enable bottle reminders in More: it should ask
  for permission. Schedule a near-future reminder; test foreground/background
  delivery. Test meal reminders separately.
- Test email, Apple and Google login, logout and account switching. Use store
  sandbox purchases to check monthly/annual/lifetime, restore and expiry.
  Cancelling renewal keeps Pro until the paid period expires; lifetime persists
  unless refunded/revoked. See subscriptions.md for the full matrix.

For ongoing code editing instead, use the `development` build profile and run
`npx expo start --dev-client`, then scan its QR on the same network. Build again
when native dependencies/configuration change.

## Known release follow-up

The local premium AI Cloud Functions now verify RevenueCat using the authenticated
Firebase UID. Configure the server secret and deploy the functions and rules
before relying on this protection in production. See reliability.md.
No backend changes or secrets were deployed during this work. See
[release hardening](release-hardening.md) for the complete security rollout and
compatibility requirements for older clients.

Official references:
- https://docs.expo.dev/build/internal-distribution/
- https://docs.expo.dev/build/eas-json/
