const { test } = require("node:test");
const assert = require("node:assert/strict");
const harness = require("./support/appHarness.cjs");
const flat = (node) =>
  Array.isArray(node)
    ? node.flatMap(flat)
    : node && typeof node === "object"
      ? [node, ...flat(node.props?.children)]
      : [];
function modal(onSubmit) {
  const h = harness();
  let closes = 0;
  const Component = h.load("src/components/AddFoodModal.js").AddFoodModal;
  const nodes = flat(
    Component({
      onSubmit,
      onClose: () => closes++,
      draftKey: "user-child",
      initial: { name: "Banana" },
    }),
  );
  return {
    close: () =>
      nodes
        .find((node) => node.props.accessibilityLabel === "Close food entry")
        .props.onPress(),
    back: () =>
      nodes.find((node) => node.type === "Modal").props.onRequestClose(),
    form: nodes.find((node) => node.type?.name === "FoodForm").props,
    closes: () => closes,
  };
}
test("food sheet keeps the draft key and supports close button and Android back", () => {
  const m = modal(async () => true);
  assert.equal(m.form.draftKey, "user-child");
  assert.equal(m.form.initial.name, "Banana");
  m.close();
  m.back();
  assert.equal(m.closes(), 2);
});
test("food sheet stays open after a failed save and closes only after success", async () => {
  const failed = modal(async () => false);
  assert.equal(await failed.form.onSubmit({ name: "Banana" }), false);
  assert.equal(failed.closes(), 0);
  const saved = modal(async () => true);
  assert.equal(await saved.form.onSubmit({ name: "Banana" }), true);
  assert.equal(saved.closes(), 1);
});
test("food sheet cannot be dismissed or submit twice during a pending save", async () => {
  let release;
  const m = modal(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const pending = m.form.onSubmit({ name: "Banana" });
  m.close();
  m.back();
  assert.equal(m.closes(), 0);
  assert.equal(await m.form.onSubmit({ name: "Banana" }), false);
  release(true);
  await pending;
  assert.equal(m.closes(), 1);
});
test("add menu exposes separate dismiss, food, milk and weight actions", () => {
  const h = harness();
  const Component = h.load("src/components/AddMenuSheet.js").AddMenuSheet;
  const actions = [];
  const nodes = flat(
    Component({
      visible: true,
      fabBottom: 30,
      onClose: () => actions.push("close"),
      onFood: () => actions.push("food"),
      onBottle: () => actions.push("milk"),
      onWeight: () => actions.push("weight"),
    }),
  );
  for (const label of ["Add food", "Add milk", "Add weight", "Close add menu"])
    nodes
      .find((node) => node.props.accessibilityLabel === label)
      .props.onPress();
  assert.deepEqual(actions, ["food", "milk", "weight", "close"]);
});
