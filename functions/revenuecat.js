// Server-only. Never trust a client isPro flag or the client-writable plan mirror.
function failure(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}
function hasActivePro(customer, now = Date.now()) {
  if (
    !customer?.subscriber ||
    typeof customer.subscriber.entitlements !== "object" ||
    !customer.subscriber.entitlements
  ) {
    throw failure(
      "unavailable",
      "Subscription verification returned an invalid response. Please try again.",
    );
  }
  const entitlement = customer.subscriber.entitlements.pro;
  if (!entitlement) return false;
  if (
    !entitlement.product_identifier ||
    !Number.isFinite(Date.parse(entitlement.purchase_date))
  )
    return false;
  const subscription =
    customer.subscriber.subscriptions?.[entitlement.product_identifier];
  if (subscription?.refunded_at) return false;
  // null explicitly means non-expiring; missing/invalid expiry must not grant access.
  if (entitlement.expires_date === null) return true;
  const expiry = Date.parse(entitlement.expires_date);
  const grace = Date.parse(entitlement.grace_period_expires_date);
  return (
    (Number.isFinite(expiry) && expiry > now) ||
    (Number.isFinite(grace) && grace > now)
  );
}
async function requirePro(
  uid,
  { apiKey, fetchImpl = fetch, now = Date.now() },
) {
  if (!uid) throw failure("unauthenticated", "Please sign in.");
  if (!apiKey)
    throw failure(
      "failed-precondition",
      "Subscription verification is not configured.",
    );
  let response, customer;
  try {
    response = await fetchImpl(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(uid)}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(10000),
      },
    );
    if (response.status === 404)
      throw failure(
        "permission-denied",
        "An active Pro subscription is required.",
      );
    if (!response.ok)
      throw failure(
        "unavailable",
        "Could not verify your subscription. Please try again.",
      );
    customer = await response.json();
  } catch (error) {
    if (error.code === "permission-denied" || error.code === "unavailable")
      throw error;
    throw failure(
      "unavailable",
      "Could not verify your subscription. Please try again.",
    );
  }
  if (!hasActivePro(customer, now))
    throw failure(
      "permission-denied",
      "An active Pro subscription is required. Restore purchases if you recently subscribed.",
    );
}
module.exports = { hasActivePro, requirePro };
