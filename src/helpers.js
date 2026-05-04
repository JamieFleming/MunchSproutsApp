import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { REACTIONS, MONTHS } from "./constants";

/**
 * Weekly featured recipe rotation.
 *
 * In Firestore, mark any recipe with `featured: true` to add it to the pool.
 * This function picks one recipe from the pool per week (rotating automatically),
 * sets it as featured and free (locked: false), and hides the rest from the
 * featured section until their week comes around.
 *
 * Week number is based on days since Unix epoch ÷ 7, so it flips every Monday UTC.
 */
export function applyWeeklyFeaturedRotation(recipes) {
	const weekNum = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
	const pool = recipes.filter((r) => r.featured);
	if (pool.length === 0) return recipes;

	// Sort pool by document order so rotation is deterministic across devices
	const sorted = [...pool].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

	// Pick 5 consecutive recipes this week, wrapping around the pool
	const WEEKLY_COUNT = 5;
	const startIndex = (weekNum * WEEKLY_COUNT) % sorted.length;
	const thisWeekIds = new Set(
		Array.from({ length: WEEKLY_COUNT }, (_, i) => sorted[(startIndex + i) % sorted.length].id),
	);

	return recipes.map((r) => {
		if (thisWeekIds.has(r.id)) {
			// This week's picks — show as featured and make them free
			return { ...r, featured: true, locked: false };
		}
		if (r.featured) {
			// In the pool but not this week — hide from featured section
			return { ...r, featured: false };
		}
		return r;
	});
}

/**
 * For each allergen in allergenList, scan foodLog entries to determine status.
 * Returns an array of allergen objects extended with:
 *   status: "Safe" | "In Progress" | "Reaction" | "Not Tried"
 *   firstDate: string | null
 *   lastDate: string | null
 *   count: number (entries containing this allergen)
 */
export function computeAllergenStatus(foodLog, allergenList) {
	return allergenList.map((allergen) => {
		const entries = foodLog.filter(
			(e) => Array.isArray(e.allergens) && e.allergens.includes(allergen.value),
		);

		if (entries.length === 0) {
			return { ...allergen, status: "Not Tried", firstDate: null, lastDate: null, count: 0 };
		}

		const hasReaction = entries.some((e) => e.reaction === "Allergic");
		const hasSafe = entries.some(
			(e) => e.reaction === "Loved" || e.reaction === "Good",
		);

		const dates = entries
			.filter((e) => e.date)
			.map((e) => e.date)
			.sort();

		const firstDate = dates[0] || null;
		const lastDate = dates[dates.length - 1] || null;

		let status;
		if (hasReaction) status = "Reaction";
		else if (hasSafe) status = "Safe";
		else status = "In Progress";

		return { ...allergen, status, firstDate, lastDate, count: entries.length };
	});
}

export function calcAgeWeeks(dob) {
	if (!dob) return null;
	return Math.floor((Date.now() - new Date(dob)) / (7 * 24 * 60 * 60 * 1000));
}

export function calcAgeMonths(dob) {
	if (!dob) return null;
	const b = new Date(dob),
		n = new Date();
	return (
		(n.getFullYear() - b.getFullYear()) * 12 + (n.getMonth() - b.getMonth())
	);
}

export function formatDate(d) {
	if (!d) return "";
	return new Date(d).toLocaleDateString("en-GB", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

export function normalize(s) {
	return s.toLowerCase().trim();
}

export function groupByFood(log) {
	const g = {};
	log.forEach((e) => {
		const k = normalize(e.name);
		if (!g[k])
			g[k] = {
				key: k,
				name: e.name,
				category: e.category || (e.categories?.[0] ?? ""),
				attempts: [],
			};
		g[k].attempts.push(e);
	});
	Object.values(g).forEach((food) => {
		food.attempts.sort((a, b) => {
			const da = new Date((a.date || "1970-01-01") + "T" + (a.time || "00:00"));
			const db2 = new Date((b.date || "1970-01-01") + "T" + (b.time || "00:00"));
			return da - db2;
		});
	});
	return g;
}

export function reactionCfg(r) {
	return REACTIONS.find((x) => x.value === r) || REACTIONS[2];
}

export function getDaysInMonth(m, y) {
	return new Date(y, m, 0).getDate();
}

export function buildYears(from, to) {
	const y = [];
	for (let i = to; i >= from; i--) y.push(String(i));
	return y;
}

export function buildDays(m, y) {
	const n = getDaysInMonth(m, y),
		d = [];
	for (let i = 1; i <= n; i++) d.push(String(i).padStart(2, "0"));
	return d;
}

export function formatTime(time) {
	if (!time) return "";
	const [h, m] = time.split(":");
	const hour = parseInt(h, 10);
	const ampm = hour >= 12 ? "pm" : "am";
	const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
	return `${h12}:${m}${ampm}`;
}

export function toMl(amount, unit) {
	const n = parseFloat(amount) || 0;
	return unit === "oz" ? Math.round(n * 29.5735) : Math.round(n);
}

export function buildHours() {
	return Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
}

export function buildMinutes() {
	return ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];
}

export async function pickImageAsBase64(aspect = [4, 3]) {
	const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();

	if (!perm.granted) {
		Alert.alert(
			"Permission needed",
			"Please allow access to your photo library in Settings.",
		);
		return null;
	}

	const result = await ImagePicker.launchImageLibraryAsync({
		mediaTypes: ["images"],
		allowsEditing: true,
		aspect,
		quality: 0.3,
		base64: true,
		exif: false,
	});

	if (result.canceled || !result.assets?.[0]) return null;

	const asset = result.assets[0];
	if (!asset.base64) return null;

	const ext = asset.uri.split(".").pop()?.toLowerCase() || "jpg";
	const mimeType = ext === "png" ? "image/png" : "image/jpeg";
	return `data:${mimeType};base64,${asset.base64}`;
}
