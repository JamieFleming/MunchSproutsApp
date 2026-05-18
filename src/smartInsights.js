/**
 * smartInsights.js
 *
 * All client-side computation for Smart Insights.
 * These run for free — AI is only used for the narrative text layer
 * which lives in the generateInsights Cloud Function.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function dateStr(d) {
	return d.toISOString().split("T")[0];
}

function daysAgo(n) {
	const d = new Date();
	d.setDate(d.getDate() - n);
	return dateStr(d);
}

function entriesInRange(foodLog, from, to) {
	return foodLog.filter((e) => e.date >= from && e.date <= to);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Nutrition Variety Score  (0–100)
//    Based on how many of the 6 scored food groups have been tried in the
//    last 14 days.  Liquids and Other are excluded from the score so they
//    can't inflate it artificially.
// ─────────────────────────────────────────────────────────────────────────────

const SCORED_CATEGORIES = [
	"Vegetables",
	"Fruits",
	"Grains",
	"Proteins",
	"Dairy",
	"Legumes",
];

export function computeNutritionScore(foodLog) {
	const cutoff = daysAgo(14);
	const recent = foodLog.filter((e) => e.date >= cutoff);

	const found = new Set();
	recent.forEach((e) => {
		const cats = Array.isArray(e.categories) && e.categories.length
			? e.categories
			: e.category ? [e.category] : [];
		cats.forEach((c) => {
			if (SCORED_CATEGORIES.includes(c)) found.add(c);
		});
	});

	const score = Math.round((found.size / SCORED_CATEGORIES.length) * 100);

	// Unique foods tried in last 14 days (normalised to lowercase)
	const uniqueFoods = new Set(recent.map((e) => (e.name || "").toLowerCase().trim()));

	// Top 3 most-tried foods
	const foodCounts = {};
	recent.forEach((e) => {
		const n = (e.name || "").trim();
		if (n) foodCounts[n] = (foodCounts[n] || 0) + 1;
	});
	const topFoods = Object.entries(foodCounts)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 3)
		.map(([name]) => name);

	// Missing categories
	const missing = SCORED_CATEGORIES.filter((c) => !found.has(c));

	return {
		score,
		categoriesFound: [...found],
		categoriesTotal: SCORED_CATEGORIES.length,
		missingCategories: missing,
		uniqueFoodsCount: uniqueFoods.size,
		topFoods,
	};
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Weekly Trend Analysis
//    Compare the last 7 days against the 7 days before that.
// ─────────────────────────────────────────────────────────────────────────────

export function computeTrends(foodLog) {
	const today     = dateStr(new Date());
	const week1From = daysAgo(7);   // last 7 days
	const week2From = daysAgo(14);  // prior 7 days
	const week2To   = daysAgo(8);

	const thisWeek = entriesInRange(foodLog, week1From, today);
	const lastWeek = entriesInRange(foodLog, week2From, week2To);

	const uniqueThis = new Set(thisWeek.map((e) => (e.name || "").toLowerCase().trim()));
	const uniqueLast = new Set(lastWeek.map((e) => (e.name || "").toLowerCase().trim()));

	// New foods tried this week that weren't tried last week
	const newFoods = [...uniqueThis].filter((n) => !uniqueLast.has(n)).filter(Boolean);

	// Reaction breakdown this week
	const reactions = { Loved: 0, Good: 0, Neutral: 0, Rejected: 0, Allergic: 0 };
	thisWeek.forEach((e) => {
		if (e.reaction && reactions[e.reaction] !== undefined) {
			reactions[e.reaction]++;
		}
	});

	const positiveCount = reactions.Loved + reactions.Good;
	const totalReacted  = thisWeek.filter((e) => e.reaction).length;
	const positiveRate  = totalReacted > 0
		? Math.round((positiveCount / totalReacted) * 100)
		: null;

	// Trend direction
	const trend =
		thisWeek.length > lastWeek.length ? "up" :
		thisWeek.length < lastWeek.length ? "down" : "same";

	return {
		thisWeekCount:    thisWeek.length,
		lastWeekCount:    lastWeek.length,
		uniqueFoodsThis:  uniqueThis.size,
		uniqueFoodsLast:  uniqueLast.size,
		newFoods,
		reactions,
		positiveRate,
		trend,
	};
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Weaning Milestones
//    Based on NHS / BLW guidelines. Each milestone is auto-detected from the
//    food log and child data.
// ─────────────────────────────────────────────────────────────────────────────

export const MILESTONES = [
	{
		id:      "started",
		label:   "First foods",
		detail:  "Began the weaning journey",
		ageHint: 6,
		tip:     "Start with soft single-ingredient foods — vegetables and fruits are ideal first choices.",
	},
	{
		id:      "textures",
		label:   "Texture variety",
		detail:  "Tried purée, mashed & soft foods",
		ageHint: 7,
		tip:     "Progress through textures gradually — purée → mashed → soft/cut pieces.",
	},
	{
		id:      "allergens",
		label:   "Allergens explored",
		detail:  "Introduced key allergens one at a time",
		ageHint: 8,
		tip:     "Introduce the 9 main allergens one at a time, a few days apart, watching for reactions.",
	},
	{
		id:      "variety",
		label:   "Food variety",
		detail:  "5+ food groups tried",
		ageHint: 9,
		tip:     "A wide variety of foods now helps build a healthy relationship with eating.",
	},
	{
		id:      "fingerFoods",
		label:   "Finger foods",
		detail:  "Self-feeding finger foods confidently",
		ageHint: 10,
		tip:     "Soft finger foods encourage independence and develop fine motor skills.",
	},
	{
		id:      "familyFoods",
		label:   "Family foods",
		detail:  "Joining family mealtimes",
		ageHint: 12,
		tip:     "By 12 months, aim for 3 meals a day alongside the family with a range of textures.",
	},
];

export function computeMilestones(foodLog, child) {
	const weaningStart = child?.weaningStart;
	const hasLog = foodLog.length > 0;

	// All allergens ever logged (regardless of reaction)
	const allergensTried = new Set();
	foodLog.forEach((e) => (e.allergens || []).forEach((a) => allergensTried.add(a)));

	// All forms ever used
	const formsTried = new Set(foodLog.map((e) => e.form).filter(Boolean));

	// All categories ever tried
	const categoriesTried = new Set();
	foodLog.forEach((e) => {
		const cats = Array.isArray(e.categories) && e.categories.length
			? e.categories
			: e.category ? [e.category] : [];
		cats.forEach((c) => categoriesTried.add(c));
	});

	const scoredCatsTried = SCORED_CATEGORIES.filter((c) => categoriesTried.has(c));

	const achieved = {
		started:     !!(weaningStart || hasLog),
		textures:    ["Purée", "Mashed", "Soft/Cut"].some((f) => formsTried.has(f)),
		allergens:   allergensTried.size >= 3,
		variety:     scoredCatsTried.length >= 5,
		fingerFoods: formsTried.has("Finger Food"),
		familyFoods: formsTried.has("Mixed Texture") || formsTried.has("Finger Food") && scoredCatsTried.length >= 5,
	};

	// Which milestone is next (first unachieved)
	const nextMilestone = MILESTONES.find((m) => !achieved[m.id]) || null;

	// Allergen progress (out of 9)
	const ALLERGEN_NAMES = ["Gluten", "Dairy", "Eggs", "Peanuts", "Tree Nuts", "Fish", "Shellfish", "Soy", "Sesame"];
	const allergensIntroduced = ALLERGEN_NAMES.filter((a) => allergensTried.has(a));
	const allergensMissing    = ALLERGEN_NAMES.filter((a) => !allergensTried.has(a));

	return {
		milestones: MILESTONES.map((m) => ({ ...m, achieved: !!achieved[m.id] })),
		nextMilestone,
		allergenProgress: {
			introduced: allergensIntroduced,
			missing:    allergensMissing,
			count:      allergensIntroduced.length,
			total:      ALLERGEN_NAMES.length,
		},
	};
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Growth snapshot (from weightLog)
// ─────────────────────────────────────────────────────────────────────────────

export function computeGrowthSnapshot(weightLog) {
	const sorted = [...weightLog]
		.filter((w) => w.value_kg && w.date)
		.sort((a, b) => a.date.localeCompare(b.date));

	if (sorted.length < 2) {
		return { trend: "unknown", latestKg: sorted[0]?.value_kg || null, entryCount: sorted.length };
	}

	const latest = sorted[sorted.length - 1];
	const prev   = sorted[sorted.length - 2];
	const diffKg = latest.value_kg - prev.value_kg;

	// Days between last two measurements
	const daysDiff = Math.max(1,
		(new Date(latest.date) - new Date(prev.date)) / (1000 * 60 * 60 * 24),
	);
	const gPerDay = (diffKg * 1000) / daysDiff;

	// Healthy gain is roughly 5–30g/day depending on age; flag if negative
	const trend =
		gPerDay < 0  ? "decreasing" :
		gPerDay < 2  ? "stable" :
		gPerDay < 40 ? "gaining" : "rapid";

	return {
		trend,
		latestKg:   latest.value_kg,
		latestDate: latest.date,
		gPerDay:    Math.round(gPerDay),
		entryCount: sorted.length,
	};
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Bundle everything into the payload sent to the Cloud Function.
//    Keeps the AI prompt small by only sending computed summaries.
// ─────────────────────────────────────────────────────────────────────────────

export function buildInsightPayload(child, foodLog, weightLog) {
	const nutrition = computeNutritionScore(foodLog);
	const trends    = computeTrends(foodLog);
	const { milestones, nextMilestone, allergenProgress } = computeMilestones(foodLog, child);
	const growth    = computeGrowthSnapshot(weightLog);

	// Age
	const dob    = child?.dob ? new Date(child.dob) : null;
	const months = dob
		? Math.floor((Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
		: null;

	return {
		childName:    child?.name || "Baby",
		ageMonths:    months,
		nutrition: {
			score:             nutrition.score,
			categoriesFound:   nutrition.categoriesFound,
			missingCategories: nutrition.missingCategories,
			topFoods:          nutrition.topFoods,
			uniqueFoodsCount:  nutrition.uniqueFoodsCount,
		},
		trends: {
			thisWeekCount:   trends.thisWeekCount,
			lastWeekCount:   trends.lastWeekCount,
			newFoods:        trends.newFoods.slice(0, 5),
			positiveRate:    trends.positiveRate,
			trend:           trends.trend,
		},
		milestones: {
			achieved: milestones.filter((m) => m.achieved).map((m) => m.label),
			pending:  milestones.filter((m) => !m.achieved).map((m) => m.label),
			next:     nextMilestone ? { label: nextMilestone.label, tip: nextMilestone.tip } : null,
		},
		allergenProgress: {
			introduced: allergenProgress.introduced,
			missing:    allergenProgress.missing,
			count:      allergenProgress.count,
			total:      allergenProgress.total,
		},
		growth: {
			trend:      growth.trend,
			entryCount: growth.entryCount,
		},
	};
}
