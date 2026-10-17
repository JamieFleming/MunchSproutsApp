const { test } = require("node:test");
const assert = require("node:assert/strict");
const harness = require("./support/appHarness.cjs");
const h = harness();
const model = h.load("src/dashboardModel.js");
const { DashboardScreen } = h.load("src/screens/DashboardScreen.js");
const flatten = (node) =>
  Array.isArray(node)
    ? node.flatMap(flatten)
    : node && typeof node === "object"
      ? [node, ...flatten(node.props?.children)]
      : [];
const props = {
  child: {
    id: "child",
    name: "Sprout",
    dob: "2026-01-01",
    knownAllergens: ["Dairy"],
  },
  foodLog: [],
  bottleLog: [],
  onNavigate: () => {},
  onNavigateFiltered: () => {},
};
test("dashboard preferences migrate old accounts and preserve explicit hidden sections", () => {
  assert.equal(model.dashboardSettings().heroColour, "lavender");
  const saved = model.dashboardSettings({
    showMilk: false,
    showAllergens: false,
    heroColour: "unknown",
  });
  assert.equal(saved.showMilk, false);
  assert.equal(saved.showAllergens, false);
  assert.equal(saved.showRecent, true);
  assert.equal(saved.heroColour, "lavender");
});
test("preference writes change only one nested field and reject invalid settings", () => {
  assert.deepEqual(model.dashboardPreferencePatch("heroColour", "blush"), {
    "dashboardPreferences.heroColour": "blush",
  });
  assert.deepEqual(model.dashboardPreferencePatch("showRecent", false), {
    "dashboardPreferences.showRecent": false,
  });
  assert.throws(() => model.dashboardPreferencePatch("plan", "pro"));
  assert.throws(() => model.dashboardPreferencePatch("heroColour", "unknown"));
  assert.throws(() => model.dashboardPreferencePatch("showMilk", "false"));
});
test("hiding all optional sections keeps child profile, logging and customisation available", () => {
  const preferences = Object.fromEntries(
    model.DASHBOARD_SECTIONS.map(([key]) => [key, false]),
  );
  const nodes = h.render(
    h.react.createElement(DashboardScreen, { ...props, preferences }),
  );
  for (const id of [
    "dashboard-milk",
    "dashboard-allergens",
    "dashboard-progress",
    "dashboard-recent",
    "dashboard-recipes",
  ])
    assert.equal(
      nodes.find((node) => node.props?.testID === id),
      undefined,
    );
  for (const label of [
    "Log food",
    "Log milk",
    "Customise dashboard",
    "View child profile",
  ])
    assert.ok(nodes.find((node) => node.props?.accessibilityLabel === label));
});
test("pastel choices colour the hero without changing navigation actions or child data", () => {
  for (const [heroColour, palette] of Object.entries(model.DASHBOARD_COLOURS)) {
    const nodes = flatten(
      DashboardScreen({ ...props, preferences: { heroColour } }),
    );
    assert.equal(
      nodes.find((node) => node.props?.testID === "child-day-card").props.style
        .backgroundColor,
      palette.background,
    );
  }
});
test("recent activity interleaves foods and milk by date/time and honours hidden milk", () => {
  const food = [
    { id: "food", name: "Banana", date: "2026-10-17", time: "12:00" },
    { id: "check", isAllergenCheckin: true, date: "2026-10-18" },
  ];
  const milk = [{ id: "milk", date: "2026-10-17", time: "13:00" }];
  assert.deepEqual(
    model.recentDashboardActivity(food, milk).map((item) => item.id),
    ["milk", "food"],
  );
  assert.deepEqual(
    model.recentDashboardActivity(food, milk, false).map((item) => item.id),
    ["food"],
  );
});
test("known allergies are visible without an onboarding priority and are not described as foods to introduce", () => {
  const nodes = h.render(h.react.createElement(DashboardScreen, props));
  const text = nodes.filter((node) => typeof node === "string").join(" ");
  assert.match(text, /Known allergies/);
  assert.match(text, /Dairy/);
  assert.doesNotMatch(
    text,
    /still to introduce|All allergens introduced|Try next/,
  );
});
test("milk priority leads with milk logging and no-child screen routes to child setup", () => {
  const nodes = flatten(DashboardScreen({ ...props, priority: "milk" }));
  assert.ok(
    nodes.findIndex((node) => node.props?.accessibilityLabel === "Log milk") <
      nodes.findIndex((node) => node.props?.accessibilityLabel === "Log food"),
  );
  let target;
  const empty = flatten(
    DashboardScreen({
      ...props,
      child: null,
      onNavigate: (page) => {
        target = page;
      },
    }),
  );
  empty
    .find((node) => node.props?.accessibilityLabel === "Add your child")
    .props.onPress();
  assert.equal(target, "children");
});
test("customisation controls save colour and visibility through the provided persistence callback", async () => {
  const calls = [];
  const { DashboardPreferences } = h.load(
    "src/components/DashboardPreferences.js",
  );
  const nodes = flatten(
    DashboardPreferences({
      value: { heroColour: "blush" },
      onSave: async (...args) => calls.push(args),
    }),
  );
  assert.equal(
    nodes.find((node) => node.props?.accessibilityLabel === "Blush pink").props
      .accessibilityState.selected,
    true,
  );
  await nodes
    .find((node) => node.props?.accessibilityLabel === "Sky blue")
    .props.onPress();
  await nodes
    .find((node) => node.props?.accessibilityLabel === "Recent activity")
    .props.onValueChange(false);
  assert.deepEqual(calls, [
    ["heroColour", "sky"],
    ["showRecent", false],
  ]);
});
test("pastel palettes retain readable text and button contrast", () => {
  const luminance = (hex) => {
    const rgb = hex
      .slice(1)
      .match(/../g)
      .map((v) => parseInt(v, 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  for (const palette of Object.values(model.DASHBOARD_COLOURS)) {
    assert.ok(
      (luminance(palette.background) + 0.05) /
        (luminance(palette.ink) + 0.05) >=
        4.5,
    );
    assert.ok(1.05 / (luminance(palette.accent) + 0.05) >= 4.5);
  }
});
test("today uses the local calendar date", () => {
  assert.equal(model.dashboardDay(new Date(2026, 9, 17, 0, 1)), "2026-10-17");
});
