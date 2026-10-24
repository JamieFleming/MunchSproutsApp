const { test } = require("node:test");
const assert = require("node:assert/strict");
const harness = require("./support/appHarness.cjs");

// Retain hook state across screen renders to check reference stability and
// invalidation. Native scrolling/frame timing still requires a device profiler.
function screenHarness(file, name, wholeTree = false) {
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
  react.useRef = (initial) => react.useMemo(() => ({ current: initial }), []);
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
    const tree = Screen(props);
    return wholeTree ? tree : findList(tree).props;
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

test("date groups keep expansion state when scrolling and default to the newest day", () => {
  const render = screenHarness("src/screens/LogScreen.js", "LogScreen");
  const props = {
    foodLog: [
      { id: "1", name: "Banana", date: "2026-10-21" },
      { id: "2", name: "Toast", date: "2026-10-20" },
    ],
  };
  let list = render(props);
  const newest = list.renderItem({ item: "2026-10-21" });
  assert.equal(newest.props.dayOpen, true);
  assert.equal(list.renderItem({ item: "2026-10-20" }).props.dayOpen, false);
  newest.props.onToggleDay("2026-10-21");
  list = render(props);
  assert.equal(list.renderItem({ item: "2026-10-21" }).props.dayOpen, false);
  list.renderItem({ item: "2026-10-20" }).props.onToggleDay("2026-10-20");
  list = render(props);
  assert.equal(list.renderItem({ item: "2026-10-20" }).props.dayOpen, true);
});

test("calendar date selection filters food history and All dates restores it", () => {
  const render = screenHarness("src/screens/LogScreen.js", "LogScreen", true);
  const props = {
    foodLog: [
      { id: "1", name: "Banana", date: "2026-10-21" },
      { id: "2", name: "Toast", date: "2026-10-20" },
    ],
  };
  const flat = (node) =>
    Array.isArray(node)
      ? node.flatMap(flat)
      : node && typeof node === "object"
        ? [node, ...flat(node.props?.children)]
        : [];
  let nodes = flat(render(props));
  const calendar = () =>
    nodes.find((node) => node.type?.name === "ActivityCalendar");
  const list = () => nodes.find((node) => node.type === "FlatList");
  calendar().props.onSelect("2026-10-20");
  nodes = flat(render(props));
  assert.deepEqual(list().props.data, ["2026-10-20"]);
  assert.equal(
    list().props.renderItem({ item: "2026-10-20" }).props.dayOpen,
    true,
  );
  calendar().props.onSelect("2026-10-19");
  nodes = flat(render(props));
  assert.deepEqual(list().props.data, []);
  calendar().props.onSelect(null);
  nodes = flat(render(props));
  assert.deepEqual(list().props.data, ["2026-10-21", "2026-10-20"]);
});

test("food log hides controls on downward drag, retains pills, and reveals on upward drag", () => {
  const render = screenHarness("src/screens/LogScreen.js", "LogScreen", true);
  const props = { foodLog: [{ id: "f1", name: "Banana", date: "2026-10-24" }] };
  const flatten = (n) =>
    Array.isArray(n)
      ? n.flatMap(flatten)
      : n && typeof n === "object"
        ? [n, ...flatten(n.props?.children)]
        : [];
  const read = () => {
    const nodes = flatten(render(props));
    return {
      list: nodes.find((n) => n.type === "FlatList").props,
      header: nodes.find((n) => n.props.importantForAccessibility),
      pills: nodes.filter((n) => n.type === "ScrollView" && n.props.horizontal),
    };
  };
  const event = (y) => ({ nativeEvent: { contentOffset: { y } } });
  let view = read();
  view.list.onScroll(event(100));
  assert.equal(read().header.props.progress.value, 1);
  view.list.onScrollBeginDrag(event(0));
  view.list.onScroll(event(10));
  let partial = read().header.props.progress.value;
  assert.ok(partial < 1 && partial > 0.9);
  view.list.onScroll(event(65));
  assert.ok(read().header.props.progress.value > 0.8);
  for (let y = 85; y <= 305; y += 20) view.list.onScroll(event(y));
  view = read();
  assert.equal(view.header.props.accessibilityElementsHidden, true);
  assert.ok(view.pills.length > 0);
  view.list.onScrollEndDrag();
  view.list.onScroll(event(0));
  assert.equal(read().header.props.progress.value, 0);
  view.list.onScrollBeginDrag(event(300));
  view.list.onScroll(event(280));
  view = read();
  assert.equal(view.header.props.accessibilityElementsHidden, false);
  assert.ok(
    view.header.props.progress.value > 0 &&
      view.header.props.progress.value < 0.1,
  );
});
