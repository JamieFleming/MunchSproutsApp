const { test } = require("node:test");
const assert = require("node:assert/strict");
const harness = require("./support/appHarness.cjs");
test("Today selects the local date from a historical calendar selection", () => {
  const h = harness();
  const Calendar = h.load(
    "src/components/ActivityCalendar.js",
  ).ActivityCalendar;
  const localDay = h.load("src/activityCalendar.js").localDay;
  const selected = [];
  const flatten = (node) =>
    Array.isArray(node)
      ? node.flatMap(flatten)
      : node && typeof node === "object"
        ? [node, ...flatten(node.props?.children)]
        : [];
  const nodes = flatten(
    Calendar({
      foodLog: [],
      bottleLog: [],
      weightLog: [],
      selectedDate: "2020-01-01",
      onSelect: (date) => selected.push(date),
    }),
  );
  nodes
    .find((node) => node.props.accessibilityLabel === "Show today’s activity")
    .props.onPress();
  assert.deepEqual(selected, [localDay()]);
});
