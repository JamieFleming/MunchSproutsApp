const { test } = require("node:test");
const assert = require("node:assert/strict");
const harness = require("./support/appHarness.cjs");
function formHarness(props = {}) {
  const base = harness();
  const state = [];
  let cursor = 0;
  const react = {
    ...base.react,
    useState(initial) {
      const i = cursor++;
      if (!(i in state))
        state[i] = typeof initial === "function" ? initial() : initial;
      return [
        state[i],
        (next) => {
          state[i] = typeof next === "function" ? next(state[i]) : next;
        },
      ];
    },
    useRef(initial) {
      const i = cursor++;
      if (!(i in state)) state[i] = { current: initial };
      return state[i];
    },
  };
  const h = harness("ios", { react });
  const { FoodForm } = h.load("src/components/FoodForm.js");
  const submissions = [];
  const render = () => {
    cursor = 0;
    return FoodForm({
      onSubmit: async (...args) => {
        submissions.push(args);
        return true;
      },
      ...props,
    });
  };
  const flat = (node) =>
    Array.isArray(node)
      ? node.flatMap(flat)
      : node && typeof node === "object"
        ? [node, ...flat(node.props?.children)]
        : [];
  const nodes = () => flat(render());
  const find = (label) =>
    nodes().find((n) => n.props.accessibilityLabel === label);
  return {
    find,
    nodes,
    submissions,
    save: () => find("Add to Log").props.onPress(),
  };
}
test("quick form keeps optional notes hidden and exposes name, reaction and allergen review", () => {
  const h = formHarness();
  assert.ok(h.find("Food or drink name"));
  assert.ok(h.find("Check allergens"));
  assert.ok(h.find("Reaction: Loved"));
  assert.equal(h.find("Food notes"), undefined);
  h.find("More food details").props.onPress();
  assert.ok(h.find("Food notes"));
});
test("food edit preserves all categories and hidden optional values", async () => {
  const initial = {
    id: "entry",
    date: "2026-10-17",
    name: "Mixed meal",
    category: "Fruits",
    categories: ["Fruits", "Vegetables"],
    notes: "Loved it",
    favourite: true,
    mealTime: "Lunch",
    photoUri: "https://example.test/photo.jpg",
    allergens: ["Dairy"],
    form: "Mashed",
    reaction: "Loved",
  };
  const h = formHarness({ initial });
  await h.save();
  assert.deepEqual(h.submissions[0][0], { ...initial, ml: "" });
  assert.equal(h.find("Food or drink name").props.value, "Mixed meal");
});
test("blank names cannot be saved and success trims names", async () => {
  const h = formHarness({ initial: { name: "   ", categories: ["Fruits"] } });
  await h.save();
  assert.equal(h.submissions[0][0], null);
  h.find("Food or drink name").props.onChangeText(" Banana ");
  await h.save();
  assert.equal(h.submissions[1][0].name, "Banana");
  assert.equal(h.find("Food or drink name").props.value, "");
});
test("failed save keeps inputs and duplicate presses submit only once", async () => {
  let resolve;
  let calls = 0;
  const h = formHarness({
    initial: { name: "Banana", categories: ["Fruits"] },
    onSubmit: () => {
      calls++;
      return new Promise((r) => {
        resolve = r;
      });
    },
  });
  const pending = h.save();
  await h.save();
  assert.equal(calls, 1);
  assert.equal(h.find("Add to Log").props.disabled, true);
  resolve(false);
  await pending;
  assert.equal(h.find("Food or drink name").props.value, "Banana");
  assert.equal(h.find("Add to Log").props.disabled, false);
});
test("recent shortcut reuses latest food details but not its reaction, amount, date, notes or photo", async () => {
  const h = formHarness({
    recentFoods: [
      {
        id: "old",
        date: "2026-01-01",
        name: "Porridge",
        category: "Grains",
        form: "Purée",
        allergens: [],
      },
      {
        id: "new",
        date: "2026-10-17",
        name: "Porridge",
        categories: ["Grains", "Dairy"],
        form: "Mashed",
        allergens: ["Dairy"],
        reaction: "Allergic",
        ml: "200",
        notes: "Old notes",
        photoUri: "old.jpg",
      },
    ],
  });
  assert.equal(
    h.nodes().filter((n) => n.props.accessibilityLabel === "Porridge").length,
    1,
  );
  h.find("Porridge").props.onPress();
  assert.equal(
    h.find("Check allergens").props.accessibilityState.expanded,
    true,
  );
  await h.save();
  const data = h.submissions[0][0];
  assert.deepEqual(data.categories, ["Grains", "Dairy"]);
  assert.deepEqual(data.allergens, ["Dairy"]);
  assert.equal(data.form, "Mashed");
  for (const key of ["reaction", "ml", "notes", "photoUri"])
    assert.equal(data[key], "");
});
test("allergic reaction opens allergen choices and liquid amount is saved only for liquids", async () => {
  const h = formHarness({
    initial: { name: "Drink", categories: ["Liquids"], ml: "120" },
  });
  h.find("Reaction: Allergic").props.onPress();
  assert.equal(
    h.find("Check allergens").props.accessibilityState.expanded,
    true,
  );
  h.find("Allergen: Dairy").props.onPress();
  await h.save();
  assert.equal(h.submissions[0][0].ml, "120");
  assert.deepEqual(h.submissions[0][0].allergens, ["Dairy"]);
  const solid = formHarness({
    initial: { name: "Banana", categories: ["Fruits"], ml: "120" },
  });
  await solid.save();
  assert.equal(solid.submissions[0][0].ml, "");
});
test("default food date uses the local calendar day", () => {
  const { localFoodDate } = harness().load("src/components/FoodForm.js");
  assert.equal(localFoodDate(new Date(2026, 9, 17, 0, 1)), "2026-10-17");
});
