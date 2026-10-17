// Real Firestore transactions, isolated demo data; Auth/Storage are fake boundaries.
const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const req = createRequire(path.resolve("functions/package.json"));
const { initializeApp } = req("firebase-admin/app");
const admin = req("firebase-admin/firestore");
if (process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8088")
  throw new Error("Run server tests only through the demo Firestore emulator.");
initializeApp({
  projectId: "demo-munchsprouts",
  storageBucket: "demo-munchsprouts.appspot.com",
});
const db = admin.getFirestore();
let authDeleted = [],
  photos = [],
  failStorage = false;
const auth = {
  getUserByEmail: async (email) => ({ uid: "guest", email }),
  getUser: async (uid) => ({ uid, email: uid + "@example.test" }),
  deleteUser: async (uid) => authDeleted.push(uid),
};
const bucket = {
  name: "demo-munchsprouts.appspot.com",
  file: (name) => ({ delete: async () => photos.push(name) }),
  deleteFiles: async ({ prefix }) => {
    if (failStorage) throw Error("storage offline");
    photos.push(prefix);
  },
};
const cache = {};
function load(name) {
  if (cache[name]) return cache[name];
  const module = { exports: {} };
  const resolve = (id) =>
    id === "firebase-admin/auth"
      ? { getAuth: () => auth }
      : id === "firebase-admin/storage"
        ? { getStorage: () => ({ bucket: () => bucket }) }
        : id.startsWith("./")
          ? load(id.slice(2))
          : req(id);
  new Function(
    "require",
    "module",
    "exports",
    fs.readFileSync(path.resolve("functions", name + ".js"), "utf8"),
  )(resolve, module, module.exports);
  cache[name] = module.exports;
  return module.exports;
}

const access = load("access"),
  deletion = load("deletion");
function request(uid, data = {}) {
  return {
    auth: {
      uid,
      token: { auth_time: Date.now() / 1000, email: uid + "@example.test" },
    },
    data,
  };
}
(async () => {
  const quota = db.doc("users/quota/mealIdeasUsage/test");
  await quota.delete();
  const results = await Promise.allSettled(
    Array.from({ length: 8 }, () => access.reserveQuota(quota, 2)),
  );
  if (!results.some((x) => x.status === "fulfilled"))
    console.error(results[0].reason);
  assert.equal(results.filter((x) => x.status === "fulfilled").length, 2);
  assert.equal((await quota.get()).data().count, 2);
  await db
    .doc("children/server-child")
    .set({ userId: "owner", name: "Sprout", sharedWith: [] });
  await assert.rejects(
    access.generateInviteCode(request("stranger", { childId: "server-child" })),
  );
  const { code } = await access.generateInviteCode(
    request("owner", { childId: "server-child" }),
  );
  assert.match(code, /^[A-F0-9]{12}$/);
  const joined = await Promise.allSettled(
    ["join-a", "join-b"].map((uid) =>
      access.joinViaInviteCode(request(uid, { code })),
    ),
  );
  assert.equal(joined.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(
    (await db.doc("children/server-child").get()).data().sharedWith.length,
    1,
  );
  await assert.rejects(
    access.manageSharing(
      request("stranger", {
        childId: "server-child",
        email: "guest@example.test",
      }),
    ),
  );
  await access.manageSharing(
    request("owner", { childId: "server-child", email: "guest@example.test" }),
  );
  await access.manageSharing(
    request("owner", {
      childId: "server-child",
      targetUid: "guest",
      remove: true,
    }),
  );
  assert.equal(
    (await db.doc("children/server-child").get())
      .data()
      .sharedWith.includes("guest"),
    false,
  );
  // Child plus partner logs/subcollections removed by server, not client permissions.
  for (const col of ["foodLog", "bottleLog", "weightLog"])
    await db
      .doc(`${col}/server-shared`)
      .set({ userId: "partner", childId: "server-child" });
  await db.doc("foodLog/server-shared").update({
    photoUri:
      "https://firebasestorage.googleapis.com/v0/b/demo-munchsprouts.appspot.com/o/foodPhotos%2Fvictim%2Fprivate.jpg?alt=media",
  });
  await db.doc("children/server-child/lists/test").set({ items: [] });
  await assert.rejects(
    deletion.deleteChildData(request("stranger", { childId: "server-child" })),
  );
  await deletion.deleteChildData(request("owner", { childId: "server-child" }));
  assert.equal(photos.includes("foodPhotos/victim/private.jpg"), false);
  for (const loc of [
    "children/server-child",
    "foodLog/server-shared",
    "bottleLog/server-shared",
    "weightLog/server-shared",
    "children/server-child/lists/test",
  ])
    assert.equal((await db.doc(loc).get()).exists, false);
  await deletion.deleteChildData(request("owner", { childId: "server-child" })); // safe retry
  await db.doc("users/remove-me").set({ name: "Test" });
  await db.doc("users/remove-me/smartRecipes/test").set({ title: "Test" });
  await db.doc("recipeSuggestions/remove-me").set({ userId: "remove-me" });
  await db.doc("supportRequests/remove-me").set({ userId: "remove-me" });
  await db.doc("children/other-child").set({
    userId: "other",
    sharedWith: ["remove-me"],
    sharedWithEmails: ["remove-me@example.test"],
    sharedWithRoles: { "remove-me": "caregiver" },
  });
  const stale = request("remove-me");
  stale.auth.token.auth_time -= 600;
  await assert.rejects(deletion.deleteAccountData(stale));
  assert.equal((await db.doc("users/remove-me").get()).exists, true);
  failStorage = true;
  await assert.rejects(deletion.deleteAccountData(request("remove-me")));
  assert.equal(authDeleted.length, 0);
  assert.equal(
    (await db.doc("accountDeletionJobs/remove-me").get()).exists,
    true,
  );
  failStorage = false;
  await deletion.deleteAccountData(request("remove-me"));
  for (const loc of [
    "users/remove-me",
    "users/remove-me/smartRecipes/test",
    "recipeSuggestions/remove-me",
    "supportRequests/remove-me",
  ])
    assert.equal((await db.doc(loc).get()).exists, false);
  assert.equal(
    (await db.doc("children/other-child").get()).data().sharedWith.length,
    0,
  );
  assert.equal(
    (await db.doc("accountDeletionJobs/remove-me").get()).data().status,
    "completed",
  );
  assert.deepEqual(authDeleted, ["remove-me"]);
  assert.ok(photos.includes("foodPhotos/remove-me/"));
  console.log(
    "PASS: concurrent quota, atomic invite redemption, sharing ownership, complete deletion, recent login and retry after storage failure.",
  );
  await db.terminate();
})().catch(async (e) => {
  console.error(e);
  await db.terminate();
  process.exitCode = 1;
});
