const { test } = require("node:test");
const assert = require("node:assert/strict");
const harness = require("./support/appHarness.cjs");
function dataHarness(existing = { plan: "pro", onboardingComplete: true }) {
  const writes = [],
    uploads = [];
  const user = {
    uid: "parent",
    email: "test@example.test",
    displayName: "Jamie",
  };
  const firestore = {
    doc: (_db, ...parts) => parts.join("/"),
    collection: (_db, ...parts) => parts.join("/"),
    getDoc: async () => ({
      exists: () => existing !== null,
      data: () => existing,
    }),
    setDoc: async (...args) => writes.push(["set", ...args]),
    updateDoc: async (...args) => writes.push(["update", ...args]),
    deleteDoc: async (...args) => writes.push(["delete", ...args]),
    addDoc: async (...args) => {
      writes.push(["add", ...args]);
      return { id: "entry" };
    },
    serverTimestamp: () => "timestamp",
    deleteField: () => "deleted",
  };
  const auth = {
    OAuthProvider: class {
      credential(v) {
        return v;
      }
    },
    GoogleAuthProvider: { credential: (v) => v },
    signInWithCredential: async () => ({ user }),
    updateProfile: async () => {},
  };
  const h = harness("ios", {
    "firebase/firestore": firestore,
    "firebase/auth": auth,
    "firebase/storage": {
      ref: (_storage, path) => path,
      uploadString: async (...args) => uploads.push(args),
      getDownloadURL: async () => "https://example.test/photo.jpg",
    },
    firebase: { auth: { currentUser: user }, db: {}, storage: {} },
  });
  return { api: h.load("src/firebaseHooks.js"), writes, uploads };
}
test("returning Apple sign-in preserves Pro and completed onboarding", async () => {
  const h = dataHarness();
  await h.api.signInWithApple("identity.token", "nonce", null, null);
  assert.equal(h.writes.length, 1);
  const [, path, data, options] = h.writes[0];
  assert.equal(path, "users/parent");
  assert.equal("plan" in data, false);
  assert.equal("onboardingComplete" in data, false);
  assert.deepEqual(options, { merge: true });
});
test("new Apple sign-in starts free and enters onboarding", async () => {
  const h = dataHarness(null);
  await h.api.signInWithApple("identity.token", "nonce", null, null);
  assert.equal(h.writes[0][2].plan, "free");
  assert.equal(h.writes[0][2].onboardingComplete, false);
});
test("returning Google sign-in does not overwrite subscription or profile", async () => {
  const h = dataHarness({
    email: "test@example.test",
    plan: "pro",
    onboardingComplete: true,
  });
  await h.api.signInWithGoogle("token");
  assert.deepEqual(h.writes, []);
});
for (const [label, add, edit, remove, collection] of [
  ["food", "addFoodEntry", "updateFoodEntry", "deleteFoodEntry", "foodLog"],
  [
    "milk",
    "addBottleEntry",
    "updateBottleEntry",
    "deleteBottleEntry",
    "bottleLog",
  ],
  [
    "weight",
    "addWeightEntry",
    "updateWeightEntry",
    "deleteWeightEntry",
    "weightLog",
  ],
])
  test(`${label} create, edit and delete target the correct record and retain child ownership`, async () => {
    const h = dataHarness();
    const entry = { childId: "child", date: "2026-10-17", amount: 100 };
    assert.equal(await h.api[add]("parent", entry), "entry");
    assert.equal(h.writes[0][1], collection);
    assert.equal(h.writes[0][2].userId, "parent");
    assert.equal(h.writes[0][2].childId, "child");
    await h.api[edit]("entry", { amount: 120 });
    assert.deepEqual(h.writes[1], [
      "update",
      `${collection}/entry`,
      { amount: 120 },
    ]);
    await h.api[remove]("entry");
    assert.deepEqual(h.writes[2], ["delete", `${collection}/entry`]);
  });
test("profile and child edits preserve feeding preferences and upload legacy photos to Storage", async () => {
  const h = dataHarness();
  await h.api.updateUserProfile("parent", {
    name: "Jamie",
    photoURL: "data:image/jpeg;base64,aGVsbG8=",
  });
  await h.api.updateChild("child", {
    name: "Sprout",
    feedingApproach: "mixed",
    knownAllergens: ["Dairy"],
    photoUri: "data:image/jpeg;base64,aGVsbG8=",
  });
  assert.equal(h.uploads[0][0], "profilePhotos/parent/profile.jpg");
  assert.equal(h.uploads[1][0], "childPhotos/parent/child.jpg");
  assert.equal(h.writes[0][2].photoURL, "https://example.test/photo.jpg");
  assert.deepEqual(h.writes[1][2].knownAllergens, ["Dairy"]);
  assert.equal(h.writes[1][2].feedingApproach, "mixed");
});
test("recipe favourites save and remove only the selected user recipe", async () => {
  const h = dataHarness();
  await h.api.toggleRecipeFavourite("parent", "recipe", false);
  await h.api.toggleRecipeFavourite("parent", "recipe", true);
  assert.equal(h.writes[0][1], "users/parent/favouriteRecipes/recipe");
  assert.deepEqual(h.writes[1], [
    "delete",
    "users/parent/favouriteRecipes/recipe",
  ]);
});
test("release metadata agrees on 1.6.1 and prevents old-runtime OTA matching", () => {
  const app = require("../app.json").expo;
  assert.equal(app.version, "1.6.1");
  assert.equal(require("../package.json").version, app.version);
  assert.equal(
    require("../package-lock.json").packages[""].version,
    app.version,
  );
  assert.equal(app.runtimeVersion.policy, "fingerprint");
  assert.equal(require("../eas.json").build.production.autoIncrement, true);
});
