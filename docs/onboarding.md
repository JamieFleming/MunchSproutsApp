# Five-screen onboarding

Local implementation only. No EAS update, build submission or Firebase deployment
was made for this change.

## Test it

Start the development build with `npx expo start --dev-client`.

- Existing account: More → Preview new onboarding (development only). This
  walkthrough never saves account changes, uploads photos, or requests push
  permission. It closes when you finish. It is excluded from release UI.
- New test account: registration opens the real five-screen flow. Use this to
  test Firestore saving, photo uploads, notification permissions and dashboard
  personalization. Existing accounts are not sent back through onboarding.

## Data mapping

| Answers | Firestore location | Edit later |
| --- | --- | --- |
| Parent name/photo | `users/{uid}.name`, `.photoURL` | More → profile |
| Child name, birthday, photo, weaning date | `children/{id}.name`, `.dob`, `.photoUri`, `.weaningStart` | Child profile → Edit Child |
| Feeding stage/approach | `children/{id}.weaningStage`, `.feedingApproach` | Child profile → Edit Child |
| Known allergies | `children/{id}.allergyStatus`, `.knownAllergens`, `.otherAllergies` | Child profile → Edit Child; also shown in Allergen Tracker |
| Milk/allergen dashboard cards | `users/{uid}.dashboardPreferences` | More → Dashboard |
| Favourite starting feature | `users/{uid}.onboardingPriority` | More → Your preferences |
| Notification choice | `users/{uid}.notificationPreference` | More → Your preferences; OS Settings controls actual permission |
| Default child | `users/{uid}.defaultChildId` | Existing child selection |

Continue saves `users/{uid}.onboardingDraft` with the next screen, answers, and
one reserved child ID. Photos are uploaded to the existing Storage paths before
saving a draft. Back preserves answers in memory. Editing the current screen
without continuing is not yet checkpointed. Failed uploads/saves leave the form
available to retry.

The last screen atomically creates the child and writes the profile/preferences,
sets `onboardingComplete: true`, and removes the draft. Repeated attempts use the
same child ID. Auth display name and local preference cache are best effort;
Firestore holds the primary data.

Known allergies are separate from food-log reactions: no fictitious food events
are generated, they are not counted as introductions, and they are excluded from
next-allergen suggestions and delayed-reaction check-ins. The existing recipe
catalog is not automatically filtered by these answers.

Notifications are opt-in. Choosing Not now never triggers the permission dialog
on entry to MainApp. Allowing notifications registers a push token when available;
it does not silently schedule meal or bottle reminders.

## Verification

`node --test tests/onboarding.test.js tests/subscriptionSession.test.js`

The onboarding tests exercise the screen callbacks with mocked native/Firebase
services, plus validation and allergen status. They are not on-device tests.
The iOS JavaScript bundle is also exported locally to check module compatibility.

Before publishing, check on an iPhone: keyboard/footer layout, small-screen
scrolling, photo permission denial, future DOB rejection, resume after closing
between steps, finish/retry on a slow connection, all four priority shortcuts,
known allergies in the tracker and child editor, and permission denial/Not now.
Confirm saved data with a new test account. Do not reset a real customer's
onboarding flag for testing.

## Completion screen

After the five setup steps, a personalised completion screen uses the child's
name and chosen priority. The final save also writes `users/{uid}.onboardingWelcome`
with that name and priority. Root displays the completion screen while this marker
exists, including after an app restart. “Let's go to my dashboard” clears only
this marker and opens MainApp on Home. Existing completed accounts without the
marker are unaffected. The development preview includes this screen too.
