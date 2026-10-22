const { test } = require("node:test");
const assert = require("node:assert/strict");
const harness = require("./support/appHarness.cjs");
function setup(fail = false) {
  const data = new Map();
  const h = harness("ios", {
    "@react-native-async-storage/async-storage": {
      async getItem(key) {
        if (fail) throw Error("storage");
        return data.get(key);
      },
      async setItem(key, value) {
        if (fail) throw Error("storage");
        data.set(key, value);
      },
    },
  });
  return h.load("src/whatsNew.js");
}
const user = {
  uid: "existing",
  metadata: { creationTime: "2026-06-01T00:00:00Z" },
};
test("release notes target 1.6.2 existing accounts and remember dismissal per user", async () => {
  const m = setup();
  assert.equal(await m.shouldShowWhatsNew(user, "1.6.1"), false);
  assert.equal(await m.shouldShowWhatsNew(null, "1.6.2"), false);
  assert.equal(await m.shouldShowWhatsNew(user, "1.6.2"), true);
  await m.dismissWhatsNew(user.uid);
  assert.equal(await m.shouldShowWhatsNew(user, "1.6.2"), false);
  assert.equal(
    await m.shouldShowWhatsNew({ ...user, uid: "another" }, "1.6.2"),
    true,
  );
});
test("new accounts skip release notes and storage failures never block app access", async () => {
  const m = setup();
  assert.equal(
    await m.shouldShowWhatsNew(
      { uid: "new", metadata: { creationTime: "2026-10-23T00:00:00Z" } },
      "1.6.2",
    ),
    false,
  );
  const failed = setup(true);
  assert.equal(await failed.shouldShowWhatsNew(user, "1.6.2"), false);
  await assert.doesNotReject(failed.dismissWhatsNew(user.uid));
});

test("release notes can be dismissed by CTA or Android back", () => {
  const h = harness();
  const Component = h.load("src/components/WhatsNewModal.js").WhatsNewModal;
  let closed = 0;
  const flatten = (node) =>
    Array.isArray(node)
      ? node.flatMap(flatten)
      : node && typeof node === "object"
        ? [node, ...flatten(node.props?.children)]
        : [];
  const nodes = flatten(Component({ onClose: () => closed++ }));
  nodes
    .find((node) => node.props.accessibilityLabel === "Let’s get munching")
    .props.onPress();
  nodes.find((node) => node.type === "Modal").props.onRequestClose();
  assert.equal(closed, 2);
});
