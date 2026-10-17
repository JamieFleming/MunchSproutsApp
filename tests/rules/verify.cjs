const fs = require("node:fs");
const path = require("node:path");
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require("@firebase/rules-unit-testing");
const doc = (db, location) => db.doc(location);
const setDoc = (ref, data) => ref.set(data);
const getDoc = (ref) => ref.get();
const updateDoc = (ref, data) => ref.update(data);
const deleteDoc = (ref) => ref.delete();
(async () => {
  const env = await initializeTestEnvironment({
    projectId: "demo-munchsprouts",
    firestore: {
      host: "127.0.0.1",
      port: 8088,
      rules: fs.readFileSync(
        path.resolve(__dirname, "../../firestore.rules"),
        "utf8",
      ),
    },
  });
  try {
    const own = env.authenticatedContext("parent").firestore();
    const other = env.authenticatedContext("other").firestore();
    await assertSucceeds(
      setDoc(doc(own, "users/parent"), {
        name: "Test",
        dashboard: { colour: "pink" },
      }),
    );
    await assertSucceeds(
      setDoc(doc(own, "users/parent/lists/test"), { items: [] }),
    );
    await assertFails(
      setDoc(doc(other, "users/parent/lists/test"), { items: [] }),
    );
    await assertFails(getDoc(doc(other, "users/parent/lists/test")));
    await assertSucceeds(
      setDoc(doc(own, "children/child"), { userId: "parent", name: "Test" }),
    );
    const batch = own.batch();
    batch.set(doc(own, "children/new-child"), {
      userId: "parent",
      name: "New",
    });
    batch.set(doc(own, "weightLog/new-child_initial"), {
      userId: "parent",
      childId: "new-child",
      value_kg: 4,
    });
    await assertSucceeds(batch.commit());
    for (const collection of ["foodLog", "bottleLog", "weightLog"]) {
      const target = doc(own, `${collection}/test`);
      const data = { userId: "parent", childId: "child", value: 1 };
      await assertSucceeds(setDoc(target, data));
      await assertSucceeds(updateDoc(target, { value: 2 }));
      await assertFails(setDoc(doc(other, `${collection}/test`), data));
      await assertSucceeds(deleteDoc(target));
      await assertSucceeds(setDoc(target, data));
    }
    for (const collection of [
      "mealIdeasUsage",
      "weeklyPlanUsage",
      "insights",
    ]) {
      const location = `users/parent/${collection}/test`;
      await env.withSecurityRulesDisabled(async (context) =>
        setDoc(doc(context.firestore(), location), { count: 1 }),
      );
      await assertSucceeds(getDoc(doc(own, location)));
      await assertFails(setDoc(doc(own, location), { count: 0 }));
      await assertFails(deleteDoc(doc(own, location)));
      await assertFails(
        setDoc(doc(own, `users/parent/${collection}/new`), { count: 0 }),
      );
    }
    console.log(
      "Firestore rules checks passed: preferences, logs/undo, account isolation, protected AI data.",
    );
  } finally {
    await env.cleanup();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
