# Pro subscription access

The `pro` entitlement in RevenueCat is the source of truth for app access.
Attach monthly, annual, and lifetime store products to this entitlement and
include their respective package types in the current RevenueCat offering.
An unavailable package is never replaced with another billing period.

Cancelling auto-renewal preserves access through the paid period. The app
removes access when RevenueCat reports that the entitlement is inactive.
Lifetime purchases remain active unless revoked/refunded. RevenueCat's active
entitlement status also handles store billing grace periods.

The app checks at launch, on return to the foreground, every minute while
active, and after purchase/restore. It also listens for SDK updates. Each refresh
invalidates the SDK cache before fetching. SDK offline behavior still applies;
if verification throws, the app temporarily locks Pro and retries at the next
refresh. A network failure does not write a free plan to Firestore.

Firestore `users/{uid}.plan` is a compatibility mirror, updated after successful
checks; it is never used to grant access in MainApp. Existing stale Pro flags
are corrected when the updated app checks RevenueCat. This is client-side
synchronization, not a server webhook: the database is not updated while the
app is closed, and old installed app versions retain their old behavior.
Release the updated app to deliver this fix. The local premium Cloud Functions now verify RevenueCat independently using
the authenticated Firebase UID. This protection requires backend deployment;
see reliability.md for secret configuration and deployment instructions.

## Validation

Run `node --test tests/subscriptionSession.test.js`.

Before release, use store sandbox/TestFlight with RevenueCat to confirm:

- Monthly and annual purchase unlock Pro and show the correct store price.
- Cancel renewal: Pro remains until sandbox expiry, then locks on refresh.
- Restart an expired account whose Firestore plan was Pro: it stays locked.
- A renewed subscription stays active; a lifetime purchase survives restart.
- Restore active and expired purchases, and verify both access outcomes.
- Refund/revoke an entitlement and return to the app: Pro locks.
- Sign out and into another account: access cannot carry across accounts.
- Disconnect during verification and reconnect: access recovers after a refresh.

Automated tests mock RevenueCat. They do not validate live store products,
RevenueCat dashboard settings, real purchases, or deployed Firebase rules.
