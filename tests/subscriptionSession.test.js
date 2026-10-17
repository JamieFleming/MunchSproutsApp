const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createSubscriptionSession } = require("../src/subscriptionSession");
const info = (active, extra = {}, date = "2026-10-17T12:00:00Z") => ({
  requestDate: date,
  entitlements: { active: active ? { pro: { isActive: true, ...extra } } : {} },
});
function setup(initial = info(false), configured = false) {
  let customer = initial;
  let listener;
  const updates = [],
    errors = [],
    calls = [];
  const sdk = {
    isConfigured: async () => configured,
    configure: (options) => calls.push(["configure", options.appUserID]),
    getAppUserID: async () => "previous-user",
    logIn: async (uid) => calls.push(["login", uid]),
    addCustomerInfoUpdateListener: (fn) => {
      listener = fn;
    },
    removeCustomerInfoUpdateListener: (fn) => {
      assert.equal(fn, listener);
      listener = null;
    },
    invalidateCustomerInfoCache: async () => calls.push(["invalidate"]),
    getCustomerInfo: async () => customer,
    purchasePackage: async (pkg) => {
      calls.push(["purchase", pkg]);
      return { customerInfo: customer };
    },
    restorePurchases: async () => customer,
  };
  const session = createSubscriptionSession({
    purchases: sdk,
    uid: "user",
    apiKey: "test",
    onInfo: (_info, pro) => updates.push(pro),
    onError: (e) => errors.push(e),
  });
  return {
    session,
    sdk,
    updates,
    errors,
    calls,
    set: (value) => {
      customer = value;
    },
    emit: (value) => listener(value),
  };
}
test("expired subscriber starts free regardless of old Firebase plan", async () => {
  const s = setup();
  await s.session.refresh();
  assert.deepEqual(s.updates, [false]);
  s.session.dispose();
});
for (const plan of ["monthly", "yearly"]) {
  test(`${plan}: cancellation keeps paid access, expiration revokes it`, async () => {
    const s = setup(info(true, { productIdentifier: plan, willRenew: false }));
    await s.session.refresh();
    assert.equal(s.updates.at(-1), true);
    s.set(info(false, {}, "2026-11-17T12:00:00Z"));
    await s.session.refresh();
    assert.equal(s.updates.at(-1), false);
    s.session.dispose();
  });
}
test("lifetime entitlement without expiration stays Pro", async () => {
  const s = setup(info(true, { expirationDate: null, willRenew: false }));
  await s.session.refresh();
  await s.session.refresh();
  assert.deepEqual(s.updates, [true, true]);
  s.session.dispose();
});
test("purchase grants access and restore with no active entitlement removes it", async () => {
  const s = setup(info(true));
  await s.session.purchase("monthly");
  s.set(info(false));
  await s.session.restore();
  assert.deepEqual(s.updates, [true, false]);
  s.session.dispose();
});
test("listener handles refund and rejects older results", async () => {
  const s = setup(info(true));
  await s.session.refresh();
  s.emit(info(false, {}, "2026-10-17T13:00:00Z"));
  s.emit(info(true));
  assert.deepEqual(s.updates, [true, false]);
  s.session.dispose();
});
test("existing SDK switches identity before retrieving access", async () => {
  const s = setup(info(false), true);
  await s.session.refresh();
  assert.deepEqual(s.calls[0], ["login", "user"]);
  s.session.dispose();
});
test("network failures report an error instead of inventing subscription status", async () => {
  const s = setup();
  s.sdk.getCustomerInfo = async () => {
    throw new Error("offline");
  };
  await s.session.refresh();
  assert.equal(s.errors.length, 1);
  assert.deepEqual(s.updates, []);
  s.sdk.getCustomerInfo = async () => info(true);
  await s.session.refresh();
  assert.deepEqual(s.updates, [true]);
  s.session.dispose();
});
test("late response after sign-out cannot grant access", async () => {
  const s = setup();
  let resolve;
  s.sdk.getCustomerInfo = () =>
    new Promise((done) => {
      resolve = done;
    });
  const pending = s.session.refresh();
  await new Promise(setImmediate);
  s.session.dispose();
  resolve(info(true));
  await pending;
  assert.deepEqual(s.updates, []);
});
test("concurrent refreshes share one request", async () => {
  const s = setup();
  await Promise.all([s.session.refresh(), s.session.refresh()]);
  assert.equal(s.calls.filter(([name]) => name === "invalidate").length, 1);
  s.session.dispose();
});
test("failed SDK initialization can recover on next refresh", async () => {
  const s = setup(info(true));
  s.sdk.isConfigured = async () => {
    throw new Error("temporary init failure");
  };
  await s.session.refresh();
  assert.equal(s.errors.length, 1);
  s.sdk.isConfigured = async () => false;
  await s.session.refresh();
  assert.deepEqual(s.updates, [true]);
  s.session.dispose();
});
