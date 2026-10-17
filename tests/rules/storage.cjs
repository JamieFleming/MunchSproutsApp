const fs = require("node:fs"),
  path = require("node:path");
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
    storage: {
      host: "127.0.0.1",
      port: 9198,
      rules: fs.readFileSync(
        path.resolve(__dirname, "../../storage.rules"),
        "utf8",
      ),
    },
  });
  try {
    const own = env.authenticatedContext("photo-owner").storage();
    const other = env.authenticatedContext("stranger").storage();
    for (const folder of ["profilePhotos", "childPhotos", "foodPhotos"]) {
      const name = `${folder}/photo-owner/test.jpg`;
      await assertSucceeds(own.ref(name).putString("test"));
      await assertFails(other.ref(name).putString("overwrite"));
    }
    await env.withSecurityRulesDisabled((ctx) =>
      ctx
        .firestore()
        .doc("accountDeletionJobs/photo-owner")
        .set({ started: true }),
    );
    await assertFails(
      own.ref("foodPhotos/photo-owner/new.jpg").putString("test"),
    );
    console.log(
      "PASS: owner photo uploads, isolation and deletion write lock.",
    );
  } finally {
    await env.cleanup();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
