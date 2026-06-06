/**
 * smartInsights.js
 *
 * All client-side computation for Smart Insights.
 * These run for free — AI is only used for the narrative text layer
 * which lives in the generateInsights Cloud Function.
 */

import { toMl } from "./helpers";

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
// 5. Milk intake insight
// ─────────────────────────────────────────────────────────────────────────────

function getNhsMilkTarget(ageMonths) {
  if (ageMonths < 1)  return { minMl: 450, maxMl: 600,  minFeeds: 6, maxFeeds: 10, note: "very frequent feeding on demand" };
  if (ageMonths < 3)  return { minMl: 600, maxMl: 900,  minFeeds: 6, maxFeeds: 8,  note: "around 150–200ml per formula feed, 6–8 feeds/day" };
  if (ageMonths < 6)  return { minMl: 600, maxMl: 1000, minFeeds: 5, maxFeeds: 7,  note: "around 180–240ml per formula feed, 5–7 feeds/day" };
  if (ageMonths < 9)  return { minMl: 500, maxMl: 600,  minFeeds: 3, maxFeeds: 5,  note: "NHS recommends at least 500–600ml/day formula alongside solids" };
  if (ageMonths < 12) return { minMl: 400, maxMl: 500,  minFeeds: 3, maxFeeds: 4,  note: "400–500ml formula as solid meals increase" };
  return                     { minMl: 300, maxMl: 400,  minFeeds: 0, maxFeeds: 0,  note: "300–400ml whole cows milk from 12 months, formula no longer needed" };
}

export function computeMilkInsight(bottleLog = [], ageMonths = 6) {
  if (!bottleLog || bottleLog.length === 0) {
    return { hasData: false };
  }

  const today   = new Date();
  const cut7    = new Date(today); cut7.setDate(today.getDate() - 7);
  const cut14   = new Date(today); cut14.setDate(today.getDate() - 14);

  const todayStr = dateStr(today);
  const cut7Str  = dateStr(cut7);
  const cut14Str = dateStr(cut14);

  const week1 = bottleLog.filter((e) => e.date >= cut7Str && e.date <= todayStr);
  const week2 = bottleLog.filter((e) => e.date >= cut14Str && e.date < cut7Str);

  if (week1.length === 0) return { hasData: false };

  const hasFormula = week1.some((e) => e.type === "formula" || e.type === "specialised");
  const hasBreast  = week1.some((e) => e.type === "breast");
  const milkType   = hasFormula && hasBreast ? "mixed" : hasFormula ? "formula" : "breast";

  const daysLogged1 = Math.max(1, new Set(week1.map((e) => e.date)).size);
  const daysLogged2 = Math.max(1, new Set(week2.map((e) => e.date)).size);

  // Formula/expressed ml totals
  const formulaEntries1 = week1.filter((e) => e.type === "formula" || e.type === "specialised" || (e.type === "breast" && e.breastSide === "expressed"));
  const formulaEntries2 = week2.filter((e) => e.type === "formula" || e.type === "specialised" || (e.type === "breast" && e.breastSide === "expressed"));
  const totalMl1 = formulaEntries1.reduce((s, e) => s + toMl(e.amount, e.unit), 0);
  const totalMl2 = formulaEntries2.reduce((s, e) => s + toMl(e.amount, e.unit), 0);
  const avgDailyMlThis = totalMl1 > 0 ? Math.round(totalMl1 / daysLogged1) : 0;
  const avgDailyMlLast = week2.length > 0 && totalMl2 > 0 ? Math.round(totalMl2 / daysLogged2) : null;

  // Direct breast feeds
  const directBreast1 = week1.filter((e) => e.type === "breast" && e.breastSide && e.breastSide !== "expressed");
  const directBreast2 = week2.filter((e) => e.type === "breast" && e.breastSide && e.breastSide !== "expressed");
  const avgDailyFeeds = Math.round((week1.length / daysLogged1) * 10) / 10;
  const avgDailyFeedsLast = week2.length > 0 ? Math.round((week2.length / daysLogged2) * 10) / 10 : null;

  // Trend
  let trend = "stable";
  if (avgDailyMlThis > 0 && avgDailyMlLast != null) {
    if (avgDailyMlThis > avgDailyMlLast * 1.15) trend = "up";
    else if (avgDailyMlThis < avgDailyMlLast * 0.85) trend = "down";
  } else if (avgDailyFeedsLast != null) {
    if (avgDailyFeeds > avgDailyFeedsLast * 1.15) trend = "up";
    else if (avgDailyFeeds < avgDailyFeedsLast * 0.85) trend = "down";
  }

  const target = getNhsMilkTarget(ageMonths);

  // Status vs NHS target (formula/expressed only)
  let status = "unknown";
  if (avgDailyMlThis > 0) {
    if      (avgDailyMlThis < target.minMl * 0.8) status = "low";
    else if (avgDailyMlThis > target.maxMl * 1.2) status = "high";
    else                                            status = "ok";
  } else if (milkType === "breast") {
    status = "breast_unmeasured";
  }

  return {
    hasData:       true,
    milkType,
    hasFormula,
    hasBreast,
    avgDailyMlThis,
    avgDailyMlLast,
    avgDailyFeeds,
    avgDailyFeedsLast,
    trend,
    status,
    nhsTarget:     target,
    daysLogged:    daysLogged1,
    totalFeeds:    week1.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Bundle everything into the payload sent to the Cloud Function.
//    Keeps the AI prompt small by only sending computed summaries.
// ─────────────────────────────────────────────────────────────────────────────

export function buildInsightPayload(child, foodLog, weightLog, bottleLog = []) {
	const nutrition = computeNutritionScore(foodLog);
	const trends    = computeTrends(foodLog);
	const { milestones, nextMilestone, allergenProgress } = computeMilestones(foodLog, child);
	const growth    = computeGrowthSnapshot(weightLog);

	// Age
	const dob    = child?.dob ? new Date(child.dob) : null;
	const months = dob
		? Math.floor((Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
		: null;

	const milk = computeMilkInsight(bottleLog, months ?? 6);

	// NHS expected weight gain for age
	const nhsWeightGain =
		months < 3  ? { minGPerDay: 20, maxGPerDay: 35 } :
		months < 6  ? { minGPerDay: 14, maxGPerDay: 21 } :
		months < 12 ? { minGPerDay: 8,  maxGPerDay: 14 } :
		              { minGPerDay: 3,  maxGPerDay: 8  };

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
		milk: milk.hasData ? {
			type:            milk.milkType,
			avgDailyMlThis:  milk.avgDailyMlThis,
			avgDailyMlLast:  milk.avgDailyMlLast,
			avgDailyFeeds:   milk.avgDailyFeeds,
			trend:           milk.trend,
			status:          milk.status,
			nhsTargetMin:    milk.nhsTarget.minMl,
			nhsTargetMax:    milk.nhsTarget.maxMl,
			nhsTargetNote:   milk.nhsTarget.note,
			daysLogged:      milk.daysLogged,
		} : { type: "none", note: "No milk feeds logged in the last 7 days" },
		weightDetail: {
			trend:           growth.trend,
			latestKg:        growth.latestKg,
			gPerDay:         growth.gPerDay ?? null,
			nhsMinGPerDay:   nhsWeightGain.minGPerDay,
			nhsMaxGPerDay:   nhsWeightGain.maxGPerDay,
			entryCount:      growth.entryCount,
			withinRange:     growth.gPerDay != null
				? (growth.gPerDay >= nhsWeightGain.minGPerDay && growth.gPerDay <= nhsWeightGain.maxGPerDay)
				: null,
		},
	};
}
