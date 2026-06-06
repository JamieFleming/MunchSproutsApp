import { Alert, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase";
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
	const todayMs = new Date().setHours(0, 0, 0, 0);

	const daysSinceDate = (dateStr) => {
		if (!dateStr) return null;
		const ms = new Date(dateStr).setHours(0, 0, 0, 0);
		return Math.floor((todayMs - ms) / (1000 * 60 * 60 * 24));
	};

	return allergenList.map((allergen) => {
		const entries = foodLog.filter(
			(e) => Array.isArray(e.allergens) && e.allergens.includes(allergen.value),
		);

		if (entries.length === 0) {
			return {
				...allergen,
				status: "Not Tried",
				firstDate: null,
				lastDate: null,
				count: 0,
				daysSinceFirst: null,
				daysSinceFirstIntro: null,
				needsCheckIn: false,
				awaitingWindow: false,
			};
		}

		const hasReaction = entries.some((e) => e.reaction === "Allergic");

		// "Mature safe" = explicitly confirmed via the 48-hour delayed-reaction check-in
		const hasMatureSafe = entries.some(
			(e) => (e.reaction === "Loved" || e.reaction === "Good") && !!e.isAllergenCheckin,
		);

		// First positive-reaction entry that hasn't been confirmed yet via check-in.
		// Only the very first introduction requires the 48-hour delayed-reaction window —
		// subsequent logs of the same allergen don't re-trigger the check-in.
		const firstUnconfirmedPositive = entries
			.filter(
				(e) =>
					(e.reaction === "Loved" || e.reaction === "Good") && !e.isAllergenCheckin,
			)
			.sort((a, b) => (a.date || "").localeCompare(b.date || ""))[0]; // earliest first

		const daysSinceFirstIntro = firstUnconfirmedPositive
			? daysSinceDate(firstUnconfirmedPositive.date)
			: null;

		// "Awaiting window" = first positive intro logged < 2 days ago, waiting for the 48-hr window
		const awaitingWindow =
			!hasReaction &&
			!hasMatureSafe &&
			!!firstUnconfirmedPositive &&
			(daysSinceFirstIntro ?? 999) < 2;

		// "Needs check-in" = first positive intro was >= 2 days ago and not yet confirmed
		// (ask about delayed reaction in the 48-hr window)
		const needsCheckIn =
			!hasReaction &&
			!hasMatureSafe &&
			!!firstUnconfirmedPositive &&
			(daysSinceFirstIntro ?? 0) >= 2;

		const dates = entries.filter((e) => e.date).map((e) => e.date).sort();
		const firstDate = dates[0] || null;
		const lastDate = dates[dates.length - 1] || null;

		let status;
		if (hasReaction) status = "Reaction";
		else if (hasMatureSafe) status = "Safe";
		else status = "In Progress";

		const daysSinceFirst = firstDate ? daysSinceDate(firstDate) : null;

		return {
			...allergen,
			status,
			firstDate,
			lastDate,
			count: entries.length,
			daysSinceFirst,
			daysSinceFirstIntro,
			needsCheckIn,
			awaitingWindow,
		};
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
			const dateA = new Date((a.date || "1970-01-01") + "T" + (a.time || "00:00"));
			const dateB = new Date((b.date || "1970-01-01") + "T" + (b.time || "00:00"));
			return dateA - dateB;
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

/**
 * Format a weight stored in kg into a human-readable string.
 * unit = "kg"  → "7.50 kg"
 * unit = "lbs" → "7lb 8oz"  (rounds to nearest oz)
 */
export function formatWeight(valueKg, unit = "lbs") {
	if (valueKg == null || valueKg === "") return "";
	const kg = parseFloat(valueKg);
	if (isNaN(kg)) return "";
	if (unit === "kg") {
		return `${(Math.round(kg * 100) / 100).toFixed(2)} kg`;
	}
	// Convert kg → total ounces, then split into lb + oz
	const totalOz = Math.round(kg * 35.27396);
	const lb = Math.floor(totalOz / 16);
	const oz = totalOz % 16;
	return oz === 0 ? `${lb}lb` : `${lb}lb ${oz}oz`;
}

// ── Milestone thresholds ───────────────────────────────────────────────────
const MILESTONE_THRESHOLDS = [
	{ count: 1,  icon: "star",        color: "#c49a10", bg: "#fef6d4" },
	{ count: 5,  icon: "starFill",    color: "#9b7fe8", bg: "#ede8f7" },
	{ count: 10, icon: "shieldCheck", color: "#3db87a", bg: "#e6f7ef" },
	{ count: 25, icon: "crown",       color: "#e87a1a", bg: "#fde8d4" },
];

/**
 * Returns a map of { [entryId]: milestone[] } where each milestone has:
 *   { type, label, icon, color, bg, category?, count? }
 */
export function computeMilestones(foodLog) {
	const sorted = [...foodLog]
		.filter((e) => e.id && e.name)
		.sort((a, b) => {
			const da = `${a.date || "1970-01-01"}T${a.time || "00:00"}`;
			const db = `${b.date || "1970-01-01"}T${b.time || "00:00"}`;
			return da.localeCompare(db);
		});

	const result = {};
	const seenEver = new Set();
	const seenPerCat = {};

	for (const entry of sorted) {
		const food = normalize(entry.name);
		const cats =
			Array.isArray(entry.categories) && entry.categories.length
				? entry.categories
				: entry.category
					? [entry.category]
					: [];

		const badges = [];

		// First food ever
		if (seenEver.size === 0) {
			badges.push({
				type: "first_ever",
				label: "First food logged!",
				icon: "star",
				color: "#c49a10",
				bg: "#fef6d4",
			});
		}
		seenEver.add(food);

		// Per-category milestones (only on the first log of each unique food name per category)
		for (const cat of cats) {
			if (!seenPerCat[cat]) seenPerCat[cat] = new Set();
			if (!seenPerCat[cat].has(food)) {
				seenPerCat[cat].add(food);
				const n = seenPerCat[cat].size;
				const threshold = MILESTONE_THRESHOLDS.find((t) => t.count === n);
				if (threshold) {
					badges.push({
						type: `${n}_${cat}`,
						label: n === 1 ? `First ${cat}!` : `${n} ${cat} tried!`,
						category: cat,
						count: n,
						icon: threshold.icon,
						color: threshold.color,
						bg: threshold.bg,
					});
				}
			}
		}

		if (badges.length) result[entry.id] = badges;
	}

	return result;
}

export function buildHours() {
	return Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
}

export function buildMinutes() {
	return ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];
}

/**
 * Returns true if a URI is a local device path (file:// or content://)
 * that cannot be read by other devices or after a reinstall.
 */
export function isLocalUri(uri) {
	return typeof uri === "string" && (uri.startsWith("file://") || uri.startsWith("content://"));
}

/**
 * Uploads a local image URI to Firebase Storage and returns the public download URL.
 *
 * @param {string} localUri  - file:// or content:// URI from the image picker
 * @param {string} userId    - the owning user's UID (used for the storage path)
 * @param {string} filename  - filename within childPhotos/{userId}/ (no extension needed)
 * @returns {Promise<string>} Firebase Storage download URL
 */
export async function uploadChildPhoto(localUri, userId, filename) {
	const base64 = await FileSystem.readAsStringAsync(localUri, {
		encoding: FileSystem.EncodingType.Base64,
	});
	const storageRef = ref(storage, `childPhotos/${userId}/${filename}.jpg`);
	await uploadString(storageRef, base64, "base64", { contentType: "image/jpeg" });
	return await getDownloadURL(storageRef);
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
		quality: 0.6,
		base64: false,
		exif: false,
	});

	if (result.canceled || !result.assets?.[0]) return null;

	const asset = result.assets[0];
	if (!asset.uri) return null;

	// Android returns a content:// URI which can cause TransactionTooLargeException
	// when the OS serialises the Activity's saved-instance-state bundle as the
	// image-picker Activity launches.  Copying to a local file:// URI in the app
	// cache avoids passing a content-provider reference through the Binder IPC.
	if (Platform.OS === "android") {
		try {
			const localUri = `${FileSystem.cacheDirectory}picked_${Date.now()}.jpg`;
			await FileSystem.copyAsync({ from: asset.uri, to: localUri });
			return localUri;
		} catch (e) {
			console.warn("[pickImage] cache copy failed, using original URI:", e?.message);
		}
	}

	return asset.uri;
}

/**
 * parseIngredient(raw)
 *
 * Splits a free-text recipe ingredient string into a clean { name, quantity }.
 *
 * Examples:
 *   "1 ripe avocado"          → { name: "Avocado",          quantity: "1"       }
 *   "1 tsp cinnamon"          → { name: "Cinnamon",         quantity: "1 tsp"   }
 *   "2 tbsp olive oil"        → { name: "Olive oil",        quantity: "2 tbsp"  }
 *   "100g sweet potato"       → { name: "Sweet potato",     quantity: "100 g"   }
 *   "2 large free-range eggs" → { name: "Free-range eggs",  quantity: "2"       }
 *   "A pinch of salt"         → { name: "Salt",             quantity: "1 pinch" }
 *   "2 cloves of garlic"      → { name: "Garlic",           quantity: "2 cloves"}
 *   "Black pepper, to taste"  → { name: "Black pepper",     quantity: ""        }
 */
export function parseIngredient(raw) {
	// ── 1. Normalise unicode fractions ───────────────────────────────────────
	let s = (raw || "").trim()
		.replace(/½/g, "1/2").replace(/¼/g, "1/4").replace(/¾/g, "3/4")
		.replace(/⅓/g, "1/3").replace(/⅔/g, "2/3").replace(/⅛/g, "1/8")
		.replace(/⅜/g, "3/8").replace(/⅝/g, "5/8").replace(/⅞/g, "7/8");

	// ── 2. Extract leading numeric quantity ──────────────────────────────────
	// Matches: "1", "2.5", "1/2", "1 1/2"
	const qtyMatch = s.match(/^(\d+\.?\d*(?:\s*\/\s*\d+)?(?:\s+\d+\/\d+)?)/);
	let qty = "";
	if (qtyMatch) {
		qty = qtyMatch[1].trim();
		s   = s.slice(qtyMatch[1].length).trim();
	} else {
		// "a" / "an" → treat as quantity 1
		const aMatch = s.match(/^an?\s+/i);
		if (aMatch) { qty = "1"; s = s.slice(aMatch[0].length).trim(); }
	}

	// ── 3. Extract measurement unit ──────────────────────────────────────────
	const UNIT_RE = new RegExp(
		"^(tablespoons?|tbsps?|teaspoons?|tsps?" +
		"|cups?|fl\\.?\\s*oz|fluid\\s+ounces?|ounces?|oz" +
		"|pounds?|lbs?|lb|kilograms?|kg|grams?|g(?=[\\s,]|$)" +
		"|milligrams?|mg|millilitres?|milliliters?|ml" +
		"|litres?|liters?|l(?=[\\s,]|$)" +
		"|handfuls?|bunches?|bunch|cloves?|sprigs?|heads?" +
		"|pinch(?:es)?|dash(?:es)?|cans?|bags?|slices?" +
		"|pieces?|pcs?|sticks?|sheets?)",
		"i",
	);
	let unit = "";
	const unitMatch = s.match(UNIT_RE);
	if (unitMatch) { unit = unitMatch[1]; s = s.slice(unitMatch[1].length).trim(); }

	// ── 4. Strip "of" / "of the" connector ──────────────────────────────────
	s = s.replace(/^of\s+(the\s+)?/i, "").trim();

	// ── 5. Drop trailing parenthetical notes e.g. "(about 2 cups)" ──────────
	s = s.replace(/\s*\([^)]*\)/g, "").trim();

	// ── 6. Trim at first comma — "avocado, mashed" → "avocado" ─────────────
	const ci = s.indexOf(",");
	if (ci > 0) s = s.slice(0, ci).trim();

	// ── 7. Strip "to taste", "as needed", "optional" etc. ───────────────────
	s = s.replace(/\s*(to taste|as needed|if desired|optional)\b.*/i, "").trim();

	// ── 8. Remove common descriptive words ───────────────────────────────────
	const DESCRIPTORS = [
		"ripe", "unripe", "fresh", "freshly", "frozen", "dried", "cooked", "raw",
		"peeled", "unpeeled", "deseeded", "seeded", "pitted", "stoned",
		"roughly", "finely", "thinly", "thickly", "lightly", "coarsely",
		"chopped", "diced", "sliced", "grated", "minced", "crushed", "ground",
		"halved", "quartered", "cubed", "shredded", "mashed", "pureed", "puréed",
		"blended", "softened", "melted", "beaten", "sifted", "roasted", "toasted",
		"large", "medium", "small", "whole",
	];
	for (const d of DESCRIPTORS) {
		s = s.replace(new RegExp(`\\b${d}\\b\\s*`, "gi"), "");
	}
	s = s.replace(/\s+/g, " ").trim();

	// ── 9. Capitalise first letter ────────────────────────────────────────────
	const name     = s ? s[0].toUpperCase() + s.slice(1) : (raw || "").trim();
	const quantity = unit ? (qty ? `${qty} ${unit}` : unit) : qty;

	return { name, quantity };
}
