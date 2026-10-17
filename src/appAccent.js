import { DASHBOARD_COLOURS, dashboardSettings } from "./dashboardModel";

function blend(hex, target, amount) {
  const channels = [1, 3, 5].map((offset) => {
    const source = parseInt(hex.slice(offset, offset + 2), 16);
    return Math.round(source * (1 - amount) + target * amount)
      .toString(16)
      .padStart(2, "0");
  });
  return `#${channels.join("")}`;
}

// Keep semantic colours (allergies, reactions, milk and achievements) intact.
// Existing shared colour tokens now follow the account's chosen accent.
export function applyAppAccent(base, theme, preferences) {
  const palette = DASHBOARD_COLOURS[dashboardSettings(preferences).heroColour];
  const dark = theme === "dark";
  const accessible = theme === "accessible";
  return {
    ...base,
    primaryPurple: dark
      ? palette.background
      : accessible
        ? palette.ink
        : blend(palette.accent, 0, 0.12),
    primaryPurpleDark: dark ? palette.background : palette.ink,
    secondaryPurple: dark
      ? blend(palette.accent, 255, 0.4)
      : blend(palette.accent, 255, 0.5),
    plum: dark ? palette.background : palette.ink,
    bgPurple: dark ? blend(palette.accent, 0, 0.7) : palette.background,
    primaryPinkDark: dark ? palette.background : palette.ink,
    border: accessible
      ? base.border
      : dark
        ? blend(palette.accent, 0, 0.35)
        : blend(palette.accent, 255, 0.7),
    borderLight: accessible
      ? base.borderLight
      : dark
        ? blend(palette.accent, 0, 0.55)
        : blend(palette.accent, 255, 0.85),
  };
}
