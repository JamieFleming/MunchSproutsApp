const { test } = require("node:test");
const assert = require("node:assert/strict");
const h = require("./support/appHarness.cjs")();
const { applyAppAccent } = h.load("src/appAccent.js");
const { THEMES } = h.load("src/constants.js");
const { DASHBOARD_COLOURS } = h.load("src/dashboardModel.js");
function luminance(hex) {
  const c = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
}
function contrast(a, b) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
test("every accent preserves semantic colours and readable shared highlights in each theme", () => {
  for (const [theme, base] of Object.entries(THEMES)) {
    for (const heroColour of Object.keys(DASHBOARD_COLOURS)) {
      const result = applyAppAccent(base, theme, { heroColour });
      for (const key of [
        "statRedBg",
        "statRedText",
        "warningStroke",
        "statGreenBg",
        "statBlueBg",
        "screen",
        "textCharcoal",
      ])
        assert.equal(result[key], base[key]);
      assert.ok(
        contrast(result.primaryPurple, result.bgPurple) >= 4.5,
        `${theme}/${heroColour} highlight contrast`,
      );
      assert.ok(
        contrast(result.primaryPinkDark, result.screen) >= 4.5,
        `${theme}/${heroColour} title contrast`,
      );
    }
  }
});
test("missing or invalid saved accents fall back without mutating the shared theme", () => {
  const original = { ...THEMES.default };
  assert.deepEqual(
    applyAppAccent(THEMES.default, "default", { heroColour: "invalid" }),
    applyAppAccent(THEMES.default, "default", {}),
  );
  assert.deepEqual(THEMES.default, original);
  assert.notEqual(
    applyAppAccent(THEMES.default, "default", { heroColour: "sky" })
      .primaryPurple,
    applyAppAccent(THEMES.default, "default", { heroColour: "blush" })
      .primaryPurple,
  );
});
