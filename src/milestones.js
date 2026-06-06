import { ALLERGENS } from "./constants";

export const CATEGORY_THRESHOLDS = [
	{ count: 1,  icon: "star",        color: "#c49a10", bg: "#fef6d4" },
	{ count: 5,  icon: "starFill",    color: "#9b7fe8", bg: "#ede8f7" },
	{ count: 10, icon: "shieldCheck", color: "#3db87a", bg: "#e6f7ef" },
	{ count: 25, icon: "crown",       color: "#e87a1a", bg: "#fde8d4" },
];

export const TOTAL_FOOD_MILESTONES = [
	{ count: 10,  icon: "star",        color: "#c49a10", bg: "#fef6d4", label: "10 foods!" },
	{ count: 25,  icon: "starFill",    color: "#9b7fe8", bg: "#ede8f7", label: "25 foods!" },
	{ count: 50,  icon: "shieldCheck", color: "#3db87a", bg: "#e6f7ef", label: "50 foods!" },
	{ count: 100, icon: "crown",       color: "#e87a1a", bg: "#fde8d4", label: "100 foods!" },
];

export const ALLERGEN_MILESTONES = ALLERGENS.map((a) => ({
	allergenValue: a.value,
	emoji: a.emoji,
	color: a.color,
	bg: a.bg,
	icon: "shieldCheck",
	label: `First ${a.value}!`,
	type: `first_allergen_${a.value.toLowerCase().replace(/\s+/g, "_")}`,
}));
