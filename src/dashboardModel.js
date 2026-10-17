export const DASHBOARD_COLOURS = {
  lavender: {
    label: "Lavender",
    background: "#e8e0fa",
    ink: "#493663",
    accent: "#7655aa",
  },
  blush: {
    label: "Blush pink",
    background: "#f9e1e9",
    ink: "#65354a",
    accent: "#a65376",
  },
  sky: {
    label: "Sky blue",
    background: "#dfeefa",
    ink: "#2b4c68",
    accent: "#38698e",
  },
  mint: {
    label: "Mint",
    background: "#e0f1e8",
    ink: "#315642",
    accent: "#3d7055",
  },
  peach: {
    label: "Peach",
    background: "#fbe9db",
    ink: "#67462e",
    accent: "#8c5c38",
  },
};
export const DASHBOARD_SECTIONS = [
  ["showMilk", "Milk today"],
  ["showAllergens", "Allergen tracker & check-ins"],
  ["showProgress", "Food journey totals"],
  ["showRecent", "Recent activity"],
  ["showRecipes", "Recipe inspiration"],
  ["showWeight", "Latest weight on the day card"],
];
export function dashboardSettings(saved = {}) {
  return {
    ...Object.fromEntries(
      DASHBOARD_SECTIONS.map(([key]) => [
        key,
        typeof saved?.[key] === "boolean" ? saved[key] : true,
      ]),
    ),
    heroColour: Object.hasOwn(DASHBOARD_COLOURS, saved?.heroColour)
      ? saved.heroColour
      : "lavender",
  };
}
export function dashboardPreferencePatch(key, value) {
  const valid =
    key === "heroColour"
      ? Object.hasOwn(DASHBOARD_COLOURS, value)
      : DASHBOARD_SECTIONS.some(([field]) => field === key) &&
        typeof value === "boolean";
  if (!valid) throw new Error("Invalid dashboard preference");
  return { [`dashboardPreferences.${key}`]: value };
}
export function dashboardDay(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
export function recentDashboardActivity(
  foodLog = [],
  bottleLog = [],
  includeMilk = true,
) {
  return [
    ...foodLog
      .filter((entry) => !entry.isAllergenCheckin)
      .map((entry) => ({ ...entry, kind: "food" })),
    ...(includeMilk
      ? bottleLog.map((entry) => ({ ...entry, kind: "milk" }))
      : []),
  ]
    .sort((a, b) =>
      `${b.date || ""} ${b.time || ""}`.localeCompare(
        `${a.date || ""} ${a.time || ""}`,
      ),
    )
    .slice(0, 3);
}
