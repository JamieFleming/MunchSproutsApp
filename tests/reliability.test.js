const { test } = require("node:test");
const assert = require("node:assert/strict");
const harness = require("./support/appHarness.cjs");
test("drafts are scoped to user/child and cannot inject record identifiers", () => {
  const { foodDraftKey, sanitiseFoodDraft } = harness().load(
    "src/foodDraftStore.js",
  );
  assert.notEqual(foodDraftKey("a", "child"), foodDraftKey("b", "child"));
  assert.notEqual(foodDraftKey("a", "child"), foodDraftKey("a", "other"));
  assert.equal(foodDraftKey("a", null), null);
  assert.deepEqual(
    sanitiseFoodDraft({
      name: "Banana",
      id: "bad",
      userId: "bad",
      categories: ["Fruits", 4],
      allergens: ["Dairy"],
    }),
    { name: "Banana", categories: ["Fruits"], allergens: ["Dairy"] },
  );
});
test("draft writes survive reopening and a pending write cannot undo a clear", async () => {
  const { createFoodDraftStore } = harness().load("src/foodDraftStore.js");
  const values = new Map();
  const storage = {
    getItem: async (key) => values.get(key),
    setItem: async (key, value) => {
      await new Promise((r) => setTimeout(r, 5));
      values.set(key, value);
    },
    removeItem: async (key) => values.delete(key),
  };
  const store = createFoodDraftStore(storage, "child");
  await store.write({
    name: "Banana",
    categories: ["Fruits"],
    reaction: "Loved",
  });
  assert.equal(
    (await createFoodDraftStore(storage, "child").read()).name,
    "Banana",
  );
  const pending = store.write({ name: "Carrot" });
  const cleared = store.clear();
  await Promise.all([pending, cleared]);
  assert.equal(await store.read(), null);
  values.set("child", "invalid");
  assert.equal(await store.read(), null);
});
test("saving failure retains the form; success closes once; duplicate saves are blocked", async () => {
  const { useSaveAction } = harness().load("src/useSaveAction.js");
  const { runSave } = useSaveAction();
  let closed = 0,
    requests = 0,
    resolve;
  assert.equal(
    await runSave(
      async () => false,
      () => closed++,
    ),
    false,
  );
  assert.equal(
    await runSave(
      async () => {
        throw new Error("offline");
      },
      () => closed++,
    ),
    false,
  );
  assert.equal(closed, 0);
  const pending = runSave(
    () => {
      requests++;
      return new Promise((r) => {
        resolve = r;
      });
    },
    () => closed++,
  );
  assert.equal(
    await runSave(
      async () => {
        requests++;
      },
      () => closed++,
    ),
    false,
  );
  resolve(true);
  assert.equal(await pending, true);
  assert.equal(requests, 1);
  assert.equal(closed, 1);
});
test("undo restores the original ID and data without overwriting existing records", async () => {
  const writes = [];
  let exists = false;
  const h = harness("ios", {
    firebase: { db: {}, auth: { currentUser: { uid: "parent" } } },
    "firebase/firestore": {
      doc: (_db, ...parts) => parts.join("/"),
      runTransaction: async (_db, action) =>
        action({
          get: async () => ({ exists: () => exists }),
          set: (...args) => writes.push(args),
        }),
    },
  });
  const { restoreLogEntry } = h.load("src/firebaseHooks.js");
  const entry = {
    id: "original",
    childId: "child",
    name: "Banana",
    categories: ["Fruits"],
    photoUri: "https://example.test/photo.jpg",
  };
  await restoreLogEntry("foodLog", entry, "parent");
  assert.deepEqual(writes[0], [
    "foodLog/original",
    {
      childId: "child",
      name: "Banana",
      categories: ["Fruits"],
      photoUri: entry.photoUri,
      userId: "parent",
    },
  ]);
  exists = true;
  await assert.rejects(restoreLogEntry("foodLog", entry, "parent"));
  await assert.rejects(restoreLogEntry("users", entry, "parent"));
  await assert.rejects(restoreLogEntry("foodLog", entry, "different-user"));
  assert.equal(writes.length, 1);
});
