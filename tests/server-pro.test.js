const { test } = require("node:test");
const assert = require("node:assert/strict");
const { hasActivePro, requirePro } = require("../functions/revenuecat");
const now = Date.parse("2026-10-17T12:00:00Z");
const customer = (fields = {}) => ({
  subscriber: {
    entitlements: {
      pro: {
        product_identifier: "monthly",
        purchase_date: "2026-10-01T00:00:00Z",
        expires_date: "2026-11-01T00:00:00Z",
        ...fields,
      },
    },
    subscriptions: {},
  },
});
test("server entitlement handles active, cancelled-but-paid, expired, grace and lifetime", () => {
  assert.equal(hasActivePro(customer(), now), true);
  const cancelled = customer();
  cancelled.subscriber.subscriptions.monthly = {
    unsubscribe_detected_at: "2026-10-02T00:00:00Z",
  };
  assert.equal(hasActivePro(cancelled, now), true);
  assert.equal(
    hasActivePro(customer({ expires_date: "2026-10-01T00:00:00Z" }), now),
    false,
  );
  assert.equal(
    hasActivePro(
      customer({
        expires_date: "2026-10-01T00:00:00Z",
        grace_period_expires_date: "2026-10-18T00:00:00Z",
      }),
      now,
    ),
    true,
  );
  assert.equal(hasActivePro(customer({ expires_date: null }), now), true);
  assert.equal(hasActivePro(customer({ expires_date: undefined }), now), false);
  assert.equal(hasActivePro(customer({ expires_date: "invalid" }), now), false);
  const refunded = customer();
  refunded.subscriber.subscriptions.monthly = {
    refunded_at: "2026-10-16T00:00:00Z",
  };
  assert.equal(hasActivePro(refunded, now), false);
  assert.equal(hasActivePro({ subscriber: { entitlements: {} } }, now), false);
});
test("verification encodes the authenticated UID and never trusts a local plan", async () => {
  let request;
  await requirePro("firebase/user", {
    apiKey: "server-secret",
    now,
    fetchImpl: async (...args) => {
      request = args;
      return { ok: true, json: async () => customer() };
    },
  });
  assert.equal(
    request[0],
    "https://api.revenuecat.com/v1/subscribers/firebase%2Fuser",
  );
  assert.equal(request[1].headers.Authorization, "Bearer server-secret");
  await assert.rejects(
    requirePro("user", {
      apiKey: "key",
      now,
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({
          plan: "pro",
          isPro: true,
          subscriber: { entitlements: {} },
        }),
      }),
    }),
    { code: "permission-denied" },
  );
});
test("outages, malformed responses and missing configuration fail closed", async () => {
  for (const fetchImpl of [
    async () => {
      throw new Error("network");
    },
    async () => ({ ok: false, status: 500 }),
    async () => ({ ok: true, json: async () => ({}) }),
  ]) {
    await assert.rejects(requirePro("user", { apiKey: "key", fetchImpl }), {
      code: "unavailable",
    });
  }
  await assert.rejects(requirePro("user", { apiKey: "" }), {
    code: "failed-precondition",
  });
  await assert.rejects(requirePro(null, { apiKey: "key" }), {
    code: "unauthenticated",
  });
});
test("all premium callable endpoints reject forged Pro flags before database or AI access", async () => {
  const fs = require("node:fs"),
    vm = require("node:vm");
  const exports = {},
    verified = [];
  class HttpsError extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
    }
  }
  const imports = {
    "firebase-functions/v2/https": {
      onCall: (options, handler) =>
        typeof options === "function" ? options : handler,
      HttpsError,
    },
    "firebase-functions/params": {
      defineSecret: (name) => ({ value: () => name }),
    },
    "firebase-admin/app": { initializeApp() {} },
    "firebase-admin/firestore": {
      getFirestore: () => {
        throw new Error("Unexpected database access");
      },
      FieldValue: {},
    },
    openai: class {
      constructor() {
        throw new Error("Unexpected AI access");
      }
    },
    "./access": { active: async () => {} },
    "./deletion": {},
    "./revenuecat": {
      requirePro: async (uid) => {
        verified.push(uid);
        const e = new Error("Inactive");
        e.code = "permission-denied";
        throw e;
      },
    },
  };
  vm.runInNewContext(fs.readFileSync("functions/index.js", "utf8"), {
    exports,
    require: (name) => {
      if (!(name in imports)) throw new Error(name);
      return imports[name];
    },
    console,
  });
  for (const name of [
    "generateInsights",
    "generateMealIdeas",
    "generateWeeklyMealPlan",
  ]) {
    await assert.rejects(
      exports[name]({
        auth: { uid: "signed-in-user" },
        data: {
          uid: "victim",
          isPro: true,
          plan: "pro",
          childName: "Test",
          ageMonths: 9,
        },
      }),
      { code: "permission-denied" },
    );
  }
  assert.deepEqual(verified, [
    "signed-in-user",
    "signed-in-user",
    "signed-in-user",
  ]);
});
