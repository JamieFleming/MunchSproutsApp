# Barcode scanner development — 1.6.2

## Branches and release safety

- `main` and `release/1.6.1` retain the published 1.6.1 source and native dependencies.
- `feature/barcode-scanner` contains the scanner and version 1.6.2.
- A separate checkout at `../MunchSproutsNative-1.6.1` is ready for 1.6.1 fixes.
  Make and test OTA fixes there. Publish only an intentionally reviewed fix using
  `eas update --channel production --platform all --message "Describe the fix"`.
  Keep its dependencies/native config unchanged so its fingerprint matches 1.6.1.
- Never publish this scanner branch to the production OTA channel or merge it
  into the release branch. It needs new native builds containing expo-camera.
- No backend/rules migration is required. Saved names and allergens use the
  existing food log fields. Source, barcode and extra warnings are saved in notes.

## Development build

From the original project folder on `feature/barcode-scanner`:

```sh
npm ci
eas build --platform ios --profile barcode-development
eas build --platform android --profile barcode-development
npx expo start --dev-client --clear
```

Install the new build and open its Metro QR code. An older dev client lacks the
camera module. iOS requires a registered device in the provisioning profile.
The `barcode-development` profile inherits development settings and uses its own
update channel. It uses the production EAS environment solely to obtain the existing
Google Services file (the development environment has none). This does not submit
or release the app. It retains the existing app identifiers/auth configuration, so
installing it can replace the TestFlight/store installation on the same device.
It also uses the existing Firebase project: test with a designated test account;
food records saved during testing are real records for that account.

## User flow

Open Add Food → Scan barcode. Allow camera access or type barcode digits.
EAN-8/EAN-13, UPC-A and ITF-14 product codes are supported; invalid checksums are
rejected. The camera stops while a lookup/review is in progress. Review the name,
brand, ingredients, listed allergens and trace warnings; confirm the current
packaging, then select Use this food. Review/edit the populated food form, choose
food groups and reaction, then save normally.

Cancelling leaves the original form intact. Lookup requests are cancelled when
the scanner closes. Permission denial, unknown products, network errors, rate
limits and a 12-second timeout all leave manual food entry available.

Only mapped contains-allergens populate tracking checkboxes. May-contain warnings
are written to notes, never treated as an introduction. The app currently tracks
nine allergen groups: additional database allergens (e.g. celery/mustard/lupin/
sulphites) stay visible and are preserved in notes. Empty data is unknown, not a
claim of no allergens. Imported data is editable and does not certify food safety.

## Data provider and maintenance

`src/barcodeLookup.js` validates codes, calls Open Food Facts API v3 with selected
fields and maps its taxonomy to MunchSprouts. No calories/nutrient data is fetched.
Only the barcode is sent; no account, child details or camera images are uploaded.
Product coverage and accuracy are not guaranteed. There is no persistent shared
product database/cache and no writing back to Open Food Facts.

Open Food Facts attribution and an ODbL link are visible in the review; source
URLs are retained in notes. Before a public launch, review the provider's reuse
requirements and register the app through its API usage form:
https://openfoodfacts.github.io/openfoodfacts-server/api/

`FoodBarcodeScanner` owns permissions, camera lifecycle, requests and review.
`FoodForm` owns the editable entry and saving. No duplicate Firestore write path.

## Verification and device checklist

Automated checks cover barcode validation, unknown/malformed data, contains versus
traces, untracked allergens, network failure, rate-limit response, cancellation,
duplicate scan callbacks, manual input without camera permission, packaging
confirmation and form submission. The React harness mocks camera hardware.

On an iPhone and Android development build, check:

1. Allow/deny permission; return from phone settings and scan after granting it.
2. Scan several UK baby foods and compare every result with the current label.
3. Scan an unknown product, enter digits manually and try offline.
4. Scan the same barcode repeatedly; only one lookup/review should open.
5. Cancel during lookup and close the whole food sheet; no late result should apply.
6. Import contains/trace warnings, edit, save, reopen and verify draft recovery.
7. Background/foreground the scanner and check that the camera resumes correctly.
8. Confirm no microphone prompt and no effect on existing manual food logging.


### Tap to focus (native patch)

`patches/expo-camera+57.0.6.patch` adds native tap handling to the camera preview.
`npm ci` applies it through the `postinstall` script using patch-package. Keep the
patch committed and review/recreate it whenever expo-camera is upgraded.
`expo.autolinking.buildFromSource` in package.json must include `expo-camera`
on both platforms: precompiled camera binaries otherwise bypass the native patch.

On iOS, the preview layer converts the tap into camera coordinates, then requests
a fresh autofocus scan at the supported focus point on the capture session queue.
Continuous autofocus resumes after three seconds; older timers cannot override a
newer tap. The native tap recognizer allows simultaneous sheet gestures. Android uses CameraX preview coordinates and restores normal autofocus
after three seconds. Devices without focus-point support retain automatic focus.

This needs a new barcode development build on each platform; Metro reload or OTA
alone cannot add the native gesture to an existing client. Expo Go does not include
this patch. Test centre/edge taps, scrolling past the preview, repeated scans and
background/resume on physical iOS and Android devices before release. No focus square is shown:
a focus request does not guarantee that the barcode is sharp, particularly inside
the lens's minimum focusing distance.
