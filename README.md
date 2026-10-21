# MunchSprouts Native

Expo SDK 57 / React Native 0.86.3, app version 1.6.1. Use Node 22 or newer.

New to the code? Read [Understanding and maintaining MunchSprouts](docs/codebase-guide.md)
for a beginner walkthrough, screen/component map, data flows and maintenance exercises.

```sh
npm ci
npm ci --prefix functions
npm ci --prefix tests/rules
npm run lint
npm test
npm run format:check
```

For rules/server checks, install Firebase CLI and Java 21+, then run
`npm run test:rules`. Tests use **demo-munchsprouts**, never production data.
`npm run audit:reviewed` checks documented dependency exceptions; backend auditing
is `npm audit --prefix functions`. CI performs these checks and platform exports.

See [iPhone testing](docs/iphone-testing.md) for device setup and
[release hardening](docs/release-hardening.md) for required backend rollout and
remaining external release checks. Do not publish an OTA for SDK/native changes.

See [the 1.6.1 release review](docs/release-audit-2026-10-21.md) for checks, cleanup and device testing before release.

## Where to make changes

- `App.js`: signed-in orchestration, state and navigation. Header menus and milestone
  UI live in `src/components/ChildDropdown`, `ChildPickerModal`, `AddMenuSheet` and
  `MilestoneModal`, not inline in the root file.
- `src/screens`: screens and screen-specific behaviour. Several large screens remain
  candidates for incremental extraction when touched; avoid broad rewrites during
  security releases.
- `src/dashboardModel.js`, `src/appAccent.js`, `src/ThemeContext.js`: preferences,
  accent tokens and shared styles. Legacy "Purple" token names represent any
  selected accent; reaction/allergy/milk-status colours remain semantic.
- `src/useSaveAction.js`: async form saves. A parent must return `true` on success,
  `false` after presenting its own failure, or throw. Close only after success.
- `src/foodDraftStore.js`: account/child-scoped local drafts and ordered writes.
- `src/subscriptionSession.js`: serialized RevenueCat identity and access updates.
  Firestore plan is a compatibility mirror, never server authorization.
- `functions/access.js`: private sharing endpoints, quotas and access policy.
- `functions/deletion.js`: resumable server-owned cleanup and recent-login checks.
- `functions/revenuecat.js`: authoritative premium-call verification.
- `firestore.rules`, `storage.rules`: client boundaries; always test negative cases.

## Maintenance conventions

Use `npm run format`; keep lint/tests green. Comments should explain invariants,
trade-offs and failure semantics, not promise behaviour that isn't enforced.
Never swallow persistence errors and then show success. Keep ownership and sharing
writes on the server. Never introduce a private token into client code. Add tests
for failure/retry and authorization boundaries, not just matching implementation.

The lightweight React harness mocks native services and does not execute effects.
Use device testing for gestures/layout, login, notifications and store purchases.
Use emulator integration tests for permissions and transaction races. Auth/Storage
mocks in server tests do not certify deployed IAM or production deletion.

No new commits, deployments or store releases are performed automatically by these
scripts. Workflow checks require no production credentials.
