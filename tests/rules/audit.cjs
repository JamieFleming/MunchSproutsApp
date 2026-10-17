// Regression checks for the release audit. Run only against demo-munchsprouts.
const fs = require("node:fs");
const path = require("node:path");
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require("@firebase/rules-unit-testing");
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
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db
        .doc("users/owner")
        .set({ email: "fictional@example.test", name: "Private parent" });
      await db
        .doc("children/audit-child")
        .set({ userId: "owner", sharedWith: ["helper"] });
      await db
        .doc("inviteCodes/AUDIT1")
        .set({ ownerUid: "owner", childId: "audit-child", used: false });
      await db
        .doc("foodLog/audit-food")
        .set({ userId: "helper", childId: "audit-child" });
    });
    const stranger = env.authenticatedContext("stranger").firestore();
    await assertFails(stranger.doc("users/owner").get());
    await assertFails(stranger.collection("inviteCodes").get());
    console.log("PASS: private profiles and invitation enumeration blocked.");
    const helper = env.authenticatedContext("helper").firestore();
    await assertSucceeds(
      helper.doc("children/audit-child").update({ name: "Updated sprout" }),
    );
    await assertSucceeds(
      helper.doc("foodLog/audit-food").update({ notes: "Updated notes" }),
    );
    for (const change of [{ userId: "owner" }, { childId: "other-child" }]) {
      await assertFails(helper.doc("foodLog/audit-food").update(change));
    }
    await assertFails(
      helper
        .doc("children/audit-child")
        .update({ userId: "helper", sharedWith: ["stranger"] }),
    );
    console.log("PASS: caregiver ownership and sharing escalation blocked.");
    await env.withSecurityRulesDisabled((ctx) =>
      ctx
        .firestore()
        .doc("children/audit-child")
        .set({ userId: "owner", sharedWith: ["helper"] }),
    );
    const owner = env.authenticatedContext("owner").firestore();
    await assertFails(owner.doc("children/audit-child").delete());
    await env.withSecurityRulesDisabled((ctx) =>
      ctx.firestore().doc("children/audit-child").delete(),
    );
    await assertFails(owner.doc("foodLog/audit-food").get());
    await assertFails(owner.doc("foodLog/audit-food").delete());
    await assertFails(
      owner
        .collection("recipeSuggestions")
        .where("userId", "==", "owner")
        .get(),
    );
    console.log("PASS: clients cannot bypass server-owned deletion.");
    await env.withSecurityRulesDisabled((ctx) =>
      ctx
        .firestore()
        .doc("accountDeletionJobs/owner")
        .set({ status: "completed" }),
    );
    await assertFails(owner.doc("users/owner").set({ name: "Recreated" }));
    await assertFails(owner.doc("children/recreated").set({ userId: "owner" }));
    console.log("PASS: completed deletion blocks stale-token recreation.");
    // Other suites reuse this fixture account in the same emulator process.
    await env.withSecurityRulesDisabled((ctx) =>
      ctx.firestore().doc("accountDeletionJobs/owner").delete(),
    );
  } finally {
    await env.cleanup();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
