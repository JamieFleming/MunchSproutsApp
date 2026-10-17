const { test } = require("node:test");
const assert = require("node:assert/strict");
const harness = require("./support/appHarness.cjs");

// Retain hook state across screen renders to check reference stability and
// invalidation. Native scrolling/frame timing still requires a device profiler.
function screenHarness(file, name) {
  const slots = [];
  let cursor = 0;
  const react = { ...harness().react };
  react.useState = (initial) => {
    const i = cursor++;
    if (!(i in slots))
      slots[i] = typeof initial === "function" ? initial() : initial;
    return [
      slots[i],
      (next) => {
        slots[i] = typeof next === "function" ? next(slots[i]) : next;
      },
    ];
  };
  react.useMemo = (fn, deps) => {
    const i = cursor++;
    if (!slots[i] || deps.some((dep, j) => !Object.is(dep, slots[i].deps[j]))) {
      slots[i] = { deps, value: fn() };
    }
    return slots[i].value;
  };
  react.useCallback = (fn, deps) => react.useMemo(() => fn, deps);
  const h = harness("ios", { react });
  const Screen = h.load(file)[name];
  function findList(node) {
    if (!node || typeof node !== "object") return null;
    if (Array.isArray(node)) return node.map(findList).find(Boolean);
    return node.type === "FlatList" ? node : findList(node.props?.children);
  }
  return (props) => {
    cursor = 0;
    return findList(Screen(props)).props;
  };
}

test("food list preserves grouping on lightbox changes and invalidates on new logs", () => {
  const render = screenHarness("src/screens/LogScreen.js", "LogScreen");
  const food = {
    id: "f1",
    name: "Banana",
    food: "Banana",
    date: "2026-10-17",
    reaction: "Loved",
  };
  const props = { foodLog: [food] };
  const first = render(props);
  const firstRow = first.renderItem({ item: first.data[0] });
  firstRow.props.setLightboxPhoto({ uri: "https://example.test/photo.jpg" });
  const second = render(props);
  assert.equal(second.data, first.data);
  assert.equal(second.renderItem, first.renderItem);
  assert.equal(
    second.renderItem({ item: second.data[0] }).props.entries,
    firstRow.props.entries,
  );
  const changed = render({
    ...props,
    foodLog: [...props.foodLog, { ...food, id: "f2", date: "2026-10-18" }],
  });
  assert.equal(changed.data.length, 2);
  assert.notEqual(changed.renderItem, first.renderItem);
});

test("opening milk repeat retains day rows and callbacks; deleting a log invalidates data", () => {
  const render = screenHarness("src/screens/BottleScreen.js", "BottleScreen");
  const entry = { id: "b1", date: "2026-10-17", amount: 120, unit: "ml" };
  const props = { bottleLog: [entry] };
  const first = render(props);
  const row = first.renderItem({ item: first.data[0] });
  row.props.onRepeat(entry);
  const second = render(props);
  assert.equal(second.data, first.data);
  assert.equal(second.renderItem, first.renderItem);
  assert.equal(
    second.renderItem({ item: second.data[0] }).props.onRepeat,
    row.props.onRepeat,
  );
  assert.equal(render({ ...props, bottleLog: [] }).data.length, 0);
});
