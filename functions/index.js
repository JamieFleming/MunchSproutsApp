/**
 * MunchSprouts Cloud Functions
 *
 * Uses OpenAI gpt-4o-mini — fast, cheap, excellent quality.
 * API key stored as a Firebase secret (firebase functions:secrets:set OPENAI_API_KEY).
 *
 * Deploy: firebase deploy --only functions
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret }       = require("firebase-functions/params");
const { initializeApp }      = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const OpenAI                 = require("openai");

initializeApp();

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
const MODEL          = "gpt-4o-mini";

function cleanJson(text) {
	return text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/, "").trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// generateInsights
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function buildInsightsPrompt(data) {
	const { childName, ageMonths, nutrition, trends, milestones, allergenProgress, growth, milk, weightDetail } = data;
	const ageLabel = ageMonths != null ? `${ageMonths} months old` : "age unknown";

	const allergenLine = allergenProgress.count > 0
		? `Allergens introduced: ${allergenProgress.introduced.join(", ")}.${allergenProgress.missing.length ? ` Not yet tried: ${allergenProgress.missing.slice(0, 4).join(", ")}.` : " All introduced!"}`
		: "No allergens logged yet.";

	const trendLine = trends.thisWeekCount === 0 ? "No foods logged this week."
		: `This week: ${trends.thisWeekCount} entries (${trends.uniqueFoodsThis} unique foods).${trends.newFoods.length ? ` New: ${trends.newFoods.join(", ")}.` : ""}`;

	let milkLine = "No milk feeds logged.";
	if (milk && milk.type !== "none") {
		if (milk.type === "breast") {
			milkLine = `Milk: breastfeeding (${milk.avgDailyFeeds} feeds/day avg, trend: ${milk.trend}). Volume unmeasurable — guide only on frequency.`;
		} else if (milk.type === "formula" || milk.type === "mixed") {
			milkLine = `Milk: ${milk.type} (${milk.avgDailyMlThis}ml/day avg${milk.avgDailyMlLast ? `, was ${milk.avgDailyMlLast}ml/day last week` : ""}, trend: ${milk.trend}). NHS target for age: ${milk.nhsTargetMin}–${milk.nhsTargetMax}ml/day. Status: ${milk.status}.`;
		}
	}

	let weightLine = "Weight: insufficient data logged.";
	if (weightDetail && weightDetail.entryCount >= 2 && weightDetail.gPerDay != null) {
		weightLine = `Weight: gaining ~${weightDetail.gPerDay}g/day (NHS expected for age: ${weightDetail.nhsMinGPerDay}–${weightDetail.nhsMaxGPerDay}g/day). Trend: ${weightDetail.trend}. Within expected range: ${weightDetail.withinRange ? "yes" : "outside range — flag gently"}.`;
	} else if (weightDetail && weightDetail.latestKg) {
		weightLine = `Weight: latest recorded ${weightDetail.latestKg}kg but only ${weightDetail.entryCount} entry — trend cannot be calculated yet.`;
	}

	return `You are a friendly baby weaning assistant for MunchSprouts app. Write 5 short personalised insights for a parent. All insights must be warm, encouraging, and based on NHS/WHO guidance.

Baby: ${childName}, ${ageLabel}
Nutrition score: ${nutrition.score}/100
Food groups (14 days): ${nutrition.categoriesFound.join(", ") || "none"}
Missing groups: ${nutrition.missingCategories.join(", ") || "none"}
Top foods: ${nutrition.topFoods.join(", ") || "none"}
${trendLine}
${allergenLine}
Milestones achieved: ${milestones.achieved.join(", ") || "none"}
${milestones.next ? `Next milestone: "${milestones.next.label}"` : "All milestones done!"}
Growth: ${growth.entryCount < 2 ? "insufficient data" : growth.trend}
${weightLine}
${milkLine}

Return ONLY this JSON (no markdown):
{"nutrition":"...","progress":"...","nextSteps":"...","milk":"...","weight":"..."}

Rules:
- Each value: 1–2 sentences, under 60 words, warm and encouraging
- nutrition: comment on food variety and groups
- progress: comment on milestones and overall weaning journey
- nextSteps: practical suggestion for this week (food variety / new textures only — never about milk or feeding amounts)
- milk: describe the observed feeding pattern (type and amount/frequency logged) and how it compares to the NHS reference range as context only. NEVER recommend increasing, reducing, stopping or changing milk feeds in any way. NEVER use phrases like "try giving more", "consider reducing", "baby should be having", "aim for", or any directive language. If feeds appear outside the reference range, simply note this gently and say their health visitor is the right person to speak to. Always end with a brief reminder that this is general guidance only.
- weight: briefly describe the observed growth trend vs the NHS reference range as context only. NEVER recommend any action regarding feeding, diet or weight. If data is insufficient, encourage logging more entries. ALWAYS end with "This is general guidance only — always speak to your health visitor or GP with any concerns." or similar brief disclaimer.

CRITICAL — applies to ALL five fields:
- You are providing observations and context only, NOT medical advice
- NEVER tell a parent to increase, reduce, stop or change any feeding practice (breast, bottle or solid)
- NEVER use directive language: "you should", "try to", "aim for", "make sure", "ensure", "consider giving", "reduce", "increase" in relation to milk or feeding amounts
- If anything appears outside the typical range, always direct the parent to their health visitor or GP — do not suggest the parent act on it themselves
- The app is not a medical device and must never be used as a substitute for professional advice`;
}

exports.generateInsights = onCall(
	{ secrets: [OPENAI_API_KEY], region: "europe-west2" },
	async (request) => {
		if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in.");

		const uid     = request.auth.uid;
		const payload = request.data;
		if (!payload?.childName) throw new HttpsError("invalid-argument", "Missing payload.");

		const childId  = payload.childId || "default";
		const db       = getFirestore();
		const cacheRef = db.doc(`users/${uid}/insights/${childId}`);

		const snap = await cacheRef.get();
		if (snap.exists) {
			const cached = snap.data();
			const age    = Date.now() - (cached.generatedAt?.toMillis?.() || 0);
			if (age < CACHE_TTL_MS && cached.insights) {
				return { insights: cached.insights, cached: true };
			}
		}

		const openai   = new OpenAI({ apiKey: OPENAI_API_KEY.value() });
		let insights;
		try {
			const res  = await openai.chat.completions.create({
				model:       MODEL,
				temperature: 0.7,
				messages:    [{ role: "user", content: buildInsightsPrompt(payload) }],
			});
			insights = JSON.parse(cleanJson(res.choices[0].message.content.trim()));
			if (!insights.nutrition || !insights.progress || !insights.nextSteps) throw new Error("Bad shape");
			// Ensure new fields have defaults if AI omitted them
			if (!insights.milk)   insights.milk   = buildFallbackInsights(payload).milk;
			if (!insights.weight) insights.weight = buildFallbackInsights(payload).weight;
		} catch (err) {
			console.error("[insights] OpenAI error:", err.message);
			insights = buildFallbackInsights(payload);
		}

		await cacheRef.set({ insights, generatedAt: new Date(), ageMonths: payload.ageMonths });
		return { insights, cached: false };
	},
);

// ─────────────────────────────────────────────────────────────────────────────
// generateMealIdeas
// ─────────────────────────────────────────────────────────────────────────────

const DAILY_LIMIT = 3; // Pro only — 3 calls per day, each returns 3 recipes

function todayKey() {
	return new Date().toISOString().split("T")[0];
}

const MEAL_IDEAS_SYSTEM = `You are the Smart Meal Ideas assistant for Munch Sprouts, a baby-led weaning (BLW) app. You follow NHS weaning guidelines precisely.

Generate exactly 3 EXCITING, CREATIVE, SAFE, SIMPLE, AGE-APPROPRIATE meal ideas based on the child's food history and the textureLevel provided. Always return exactly 3 meals in the meals array — no more, no fewer.

CREATIVITY GOALS:
- Suggest meals that are genuinely exciting and varied — think beyond plain vegetables and basic porridge
- Draw inspiration from global cuisines adapted safely for babies (mild Indian dals, Japanese-style rice, Mediterranean flavours, Mexican beans etc)
- Give meals appealing names that make parents excited to try them
- Each of the 3 meals must be from a DIFFERENT food group (e.g. one protein-led, one carb/grain-led, one vegetable-led)
- Think about colour, flavour combinations, and textures that are interesting for the baby
- Make it feel like a treat, not just fuel — parents should want to make these
- Still keep prep time realistic: 15–25 minutes, 4–7 ingredients max

NHS TEXTURE STAGES (follow strictly based on textureLevel in the request):
- Stage 1 (around 6 months, first tastes): Smooth or soft mashed foods AND soft finger foods are both appropriate. Do NOT limit suggestions to purées — NHS and BLW guidance encourages soft finger foods from the very start of weaning. Examples: mashed banana, steamed broccoli florets, soft avocado wedges, baby porridge, smooth butternut squash, soft cooked carrot sticks.
- Stage 2 (7–9 months): Mashed or minced foods with soft lumps, plus a wider variety of soft finger foods. Examples: mashed lentil dhal, well-cooked pasta shapes, scrambled egg, soft toast strips, mashed sweet potato with soft protein.
- Stage 3 (9–12 months): Soft chopped pieces and varied finger foods progressing toward family meals. Examples: diced soft cooked chicken, rice dishes, soft pasta salads, sandwiches cut into strips, family curries (no added salt).
- 12 months+: Full family foods, chopped or broken into manageable pieces. No added salt or sugar.

SAFETY RULES (never break these):
- Strictly follow the texture level in the request — never suggest textures beyond what the baby's stage allows
- Never suggest whole grapes, whole cherry tomatoes, whole nuts, popcorn, marshmallows, hard raw vegetables or fruits, or anything round and firm that could cause choking
- Never suggest honey for babies under 12 months
- Never suggest added salt or sugar in any form
- Never suggest raw or undercooked egg, meat, or fish (runny yolk is fine only at 12m+ with lion-marked eggs)
- Never suggest allergens listed in allergensAvoid
- Introduce only ONE new allergen at a time if allergensNotTried is non-empty
- Never provide medical advice or diagnose allergies
- If previousTitles is provided, do NOT suggest any recipe with the same or very similar name — always suggest fresh, new ideas

RATING FEEDBACK (use this to personalise suggestions):
- ratedRecipes is an array of { title, rating } where rating is 1–5
- Ratings 4–5 = the parent/baby loved this meal. Suggest meals with SIMILAR flavour profiles, textures, cuisines, or main ingredients to those highly rated ones
- Ratings 1–2 = the meal was not enjoyed. AVOID similar flavour profiles, textures, cuisines, or main ingredients to those poorly rated ones
- Rating 3 = neutral — no strong signal, treat as normal
- Use this as inspiration guidance, not a strict rule — still aim for variety across the 3 suggestions

NUTRITION:
- Include approximate nutritional values per serving (calories, protein in grams, carbs in grams) — these are estimates based on typical ingredient quantities and are clearly labelled as approximate

SERVING SUGGESTIONS:
- For each meal include 2–3 short ideas for what could be served alongside it — a side, a pudding, a finger food, a fruit, a drink etc
- Each suggestion must be safe for the baby's age and texture stage, and must not contain any allergens in allergensAvoid
- Keep suggestions short and practical (e.g. "Sliced soft mango", "Natural full-fat yoghurt", "Steamed broccoli florets", "Cooled boiled water")
- Vary the types: aim for at least one savoury side and one sweet/pudding option where appropriate

OUTPUT: Return ONLY valid JSON — no markdown, no explanation:
{
  "meals": [
    {
      "title": "",
      "mealType": "",
      "ageGroup": "",
      "description": "",
      "whySuggested": "",
      "newFood": "",
      "ingredients": [],
      "steps": [],
      "allergens": [],
      "nutrition": { "calories": 0, "protein": 0, "carbs": 0 },
      "servingSuggestions": []
    }
  ],
  "disclaimer": "Smart Meal Ideas are AI-generated suggestions for inspiration only and are not medical or nutritional advice. Nutritional values are approximate estimates. Always follow safe weaning guidance and consult a healthcare professional or registered dietitian regarding allergies, intolerances, or any feeding concerns."
}`;

exports.generateMealIdeas = onCall(
	{ secrets: [OPENAI_API_KEY], region: "europe-west2" },
	async (request) => {
		if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in.");

		const uid     = request.auth.uid;
		const payload = request.data;
		if (!payload || payload.ageMonths == null) throw new HttpsError("invalid-argument", "Missing payload.");

		// Smart Meal Ideas is a Pro-only feature
		if (payload.isPro !== true) {
			throw new HttpsError("permission-denied", "Smart Meal Ideas requires a Pro subscription.");
		}

		const limit = DAILY_LIMIT;
		const db    = getFirestore();

		// Rate limit
		const today     = todayKey();
		const usageRef  = db.doc(`users/${uid}/mealIdeasUsage/${today}`);
		const usageSnap = await usageRef.get();
		const used      = usageSnap.exists ? (usageSnap.data().count || 0) : 0;

		if (used >= limit) {
			return {
				error:   "daily_limit_reached",
				used,
				limit,
				message: `You've used all ${limit} Smart Meal Idea generation${limit !== 1 ? "s" : ""} for today. Come back tomorrow for more!`,
			};
		}

		const userMessage = JSON.stringify({
			ageMonths:         payload.ageMonths,
			mealType:          payload.mealType || "any",
			textureLevel:      payload.textureLevel || "age-appropriate",
			childName:         payload.childName || "Baby",
			likedFoods:        (payload.likedFoods         || []).slice(0, 20),
			dislikedFoods:     (payload.dislikedFoods       || []).slice(0, 10),
			allergensSafe:     payload.allergensSafe        || [],
			allergensAvoid:    payload.allergensAvoid       || [],
			allergensNotTried: payload.allergensNotTried    || [],
			foodsTried:        (payload.foodsTried          || []).slice(0, 30),
			previousTitles:    (payload.previousTitles      || []).slice(0, 50),
			ratedRecipes:      (payload.ratedRecipes         || []).slice(0, 30),
		});

		const openai = new OpenAI({ apiKey: OPENAI_API_KEY.value() });
		let meals, disclaimer;

		try {
			const res    = await openai.chat.completions.create({
				model:       MODEL,
				temperature: 0.8,
				messages: [
					{ role: "system", content: MEAL_IDEAS_SYSTEM },
					{ role: "user",   content: userMessage },
				],
			});
			const result = JSON.parse(cleanJson(res.choices[0].message.content.trim()));
			if (!result.meals || !Array.isArray(result.meals)) throw new Error("Bad shape");
			meals      = result.meals;
			disclaimer = result.disclaimer;
		} catch (err) {
			console.error("[mealIdeas] OpenAI error:", err.message);
			throw new HttpsError("internal", "Could not generate meal ideas. Please try again.");
		}

		await usageRef.set({ count: used + 1, date: today }, { merge: true });

		return {
			meals,
			disclaimer: disclaimer ||
				"Smart Meal Ideas are for inspiration only and are not medical advice. Always follow safe weaning guidance and speak to a healthcare professional regarding allergies or feeding concerns.",
			used:  used + 1,
			limit: DAILY_LIMIT,
		};
	},
);

// ── Fallback insights ────────────────────────────────────────────────────────

function buildFallbackInsights(data) {
	const { childName, nutrition, milestones, trends, milk, weightDetail } = data;

	let milkFallback = "Milk feeds have been logged alongside weaning — milk remains an important part of your baby's diet throughout the first year. This is general guidance only — always speak to your health visitor or GP with any concerns.";
	if (milk && milk.type === "breast") {
		milkFallback = `Breastfeeding is going beautifully — ${milk.avgDailyFeeds ? `around ${milk.avgDailyFeeds} feeds/day have been logged. ` : ""}Your health visitor is the best person to discuss feed frequency and your baby's individual needs. This is general guidance only.`;
	} else if (milk && (milk.type === "formula" || milk.type === "mixed") && milk.avgDailyMlThis > 0) {
		milkFallback = milk.status === "low"
			? `${childName}'s logged milk intake is around ${milk.avgDailyMlThis}ml/day. The NHS reference range for this age is ${milk.nhsTargetMin}–${milk.nhsTargetMax}ml/day. Your health visitor is the right person to discuss this. This is general guidance only.`
			: `${childName}'s logged milk intake is around ${milk.avgDailyMlThis}ml/day, within the NHS reference range. This is general guidance only — always speak to your health visitor or GP with any concerns.`;
	}

	let weightFallback = "Keep logging weight entries so we can track growth over time. This is general guidance only — always speak to your health visitor or GP with any concerns.";
	if (weightDetail && weightDetail.entryCount >= 2 && weightDetail.gPerDay != null) {
		weightFallback = weightDetail.withinRange
			? `${childName}'s growth looks on track — gaining around ${weightDetail.gPerDay}g/day, within NHS expected ranges. This is general guidance only — always speak to your health visitor or GP with any concerns.`
			: `${childName}'s weight gain is outside the typical NHS range — it's worth mentioning at your next health visitor appointment. This is general guidance only — always speak to your health visitor or GP with any concerns.`;
	}

	return {
		nutrition: nutrition.score >= 70
			? `${childName} is trying a great variety across ${nutrition.categoriesFound.length} food groups — keep it up!`
			: nutrition.missingCategories.length
			? `Try introducing some ${nutrition.missingCategories[0].toLowerCase()} this week to boost variety.`
			: `${childName} is building a good range of foods. Keep offering new tastes regularly.`,
		progress: milestones.achieved.length
			? `${childName} has reached ${milestones.achieved.length} weaning milestone${milestones.achieved.length > 1 ? "s" : ""} — wonderful progress!`
			: "You're just getting started — every new food is a milestone in itself!",
		nextSteps: milestones.next
			? milestones.next.tip
			: trends.thisWeekCount === 0
			? "Try logging some meals this week to start tracking weaning progress."
			: "Keep offering a wide range of foods and textures — consistency is key!",
		milk:   milkFallback,
		weight: weightFallback,
	};
}

// ─────────────────────────────────────────────────────────────────────────────
// generateInviteCode
// Creates a unique 6-character alphanumeric invite code for a child.
// Only the child owner can call this. Code expires after 24 hours.
// ─────────────────────────────────────────────────────────────────────────────

exports.generateInviteCode = onCall(async (request) => {
	const uid = request.auth?.uid;
	if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");

	const { childId, role = "caregiver" } = request.data || {};
	if (!childId) throw new HttpsError("invalid-argument", "childId is required.");

	const db = getFirestore();
	const childDoc = await db.collection("children").doc(childId).get();
	if (!childDoc.exists || childDoc.data().userId !== uid) {
		throw new HttpsError("permission-denied", "You don't own this child.");
	}

	// Generate a unique code (retry if collision, though extremely unlikely)
	let code, attempts = 0;
	do {
		code = Math.random().toString(36).slice(2, 8).toUpperCase();
		const existing = await db.collection("inviteCodes").doc(code).get();
		if (!existing.exists || existing.data().used) break;
		attempts++;
	} while (attempts < 5);

	const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

	await db.collection("inviteCodes").doc(code).set({
		childId,
		childName: childDoc.data().name || "",
		ownerUid: uid,
		role: role === "parent" ? "parent" : "caregiver",
		createdAt: FieldValue.serverTimestamp(),
		expiresAt,
		used: false,
	});

	return { code, expiresAt: expiresAt.toISOString() };
});

// ─────────────────────────────────────────────────────────────────────────────
// joinViaInviteCode
// Validates an invite code and grants the calling user access to that child.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// generateWeeklyMealPlan
// AI-powered 7-day meal plan generation. Pro only, 1 generation per day.
// ─────────────────────────────────────────────────────────────────────────────

const DAY_KEYS_PLAN = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
const MEAL_KEYS_PLAN = ["breakfast","lunch","dinner","snacks"];

const WEEKLY_PLAN_SYSTEM = `You are MunchSprouts Weekly Meal Planner — an expert baby weaning assistant following NHS guidelines precisely.

Generate a personalised meal plan (up to 7 days) for a baby or toddler.

REQUIREMENTS:
- Each day in daysToGenerate MUST have exactly ONE item in each slot: breakfast, lunch, dinner, snacks
- Days NOT in daysToGenerate should still appear in the JSON but with empty arrays for all meal slots
- All meals must be age-appropriate, safe, and varied
- Distribute protein, vegetables, fruit, grains, and dairy across the week for nutritional balance
- Keep meals practical: 10–25 minutes prep, 4–7 ingredients max

LEFTOVER OPTIMISATION (important!):
- Cleverly reuse ingredients across days to reduce waste and save time
- Examples: Monday dinner uses salmon → Tuesday lunch uses leftover salmon in rice bowl
- Mark reused-ingredient meals with "isLeftover": true
- Include the source in the title: "Leftover Salmon Rice Bowl", "Chicken & Veggie Pasta (from Sunday's roast)"
- Aim for at least 2–3 leftover connections across the week

PANTRY PRIORITY:
- If pantry items are provided, incorporate them into meals where appropriate

CUSTOM PREFERENCES (apply when provided):
- additionalPreferences: Incorporate these food style/type preferences where natural and safe
- dislikedFoods: Avoid these foods this week (in addition to allergensAvoid)

SAFETY (never break these):
- Never suggest whole grapes, whole nuts, hard raw carrot/apple chunks, popcorn, or any choking hazard
- Never add salt, sugar, honey (for under 12 months), or artificial sweeteners
- Never suggest allergens listed in allergensAvoid
- Age-appropriate textures: under 8m = smooth/soft mashed or soft finger foods; 8–10m = mashed with soft lumps; 10–12m = soft chopped; 12m+ = family foods chopped small
- Never provide medical advice or diagnose allergies

LIKEDFOODS: Incorporate preferred foods where natural and safe.

Return ONLY valid JSON — no markdown fences, no extra text:
{
  "plan": {
    "monday":    {"breakfast":[{"title":"","description":"","ingredients":[],"category":"","isLeftover":false}],"lunch":[...],"dinner":[...],"snacks":[...]},
    "tuesday":   {"breakfast":[...],"lunch":[...],"dinner":[...],"snacks":[...]},
    "wednesday": {"breakfast":[...],"lunch":[...],"dinner":[...],"snacks":[...]},
    "thursday":  {"breakfast":[...],"lunch":[...],"dinner":[...],"snacks":[...]},
    "friday":    {"breakfast":[...],"lunch":[...],"dinner":[...],"snacks":[...]},
    "saturday":  {"breakfast":[...],"lunch":[...],"dinner":[...],"snacks":[...]},
    "sunday":    {"breakfast":[...],"lunch":[...],"dinner":[...],"snacks":[...]}
  },
  "leftoverSummary": "Brief 1–2 sentence description of the leftover strategy used this week",
  "disclaimer": "Meal plans are AI-generated suggestions for inspiration only. Always follow safe weaning guidance and consult a healthcare professional regarding allergies or feeding concerns."
}`;

exports.generateWeeklyMealPlan = onCall(
	{ secrets: [OPENAI_API_KEY], region: "europe-west2" },
	async (request) => {
		if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in.");

		const uid     = request.auth.uid;
		const payload = request.data;

		if (payload.isPro !== true) {
			throw new HttpsError("permission-denied", "Weekly Meal Planner requires a Pro subscription.");
		}
		if (!payload?.ageMonths && payload?.ageMonths !== 0) {
			throw new HttpsError("invalid-argument", "Missing child age.");
		}

		// Rate limit: 1 generation per day
		const db       = getFirestore();
		const today    = todayKey();
		const usageRef = db.doc(`users/${uid}/weeklyPlanUsage/${today}`);
		const usageSnap = await usageRef.get();
		if (usageSnap.exists && (usageSnap.data().count || 0) >= 1) {
			throw new HttpsError("resource-exhausted", "daily_limit — You've already generated a meal plan today. Come back tomorrow!");
		}

		const userMessage = JSON.stringify({
			ageMonths:             payload.ageMonths,
			childName:             payload.childName || "Baby",
			allergensAvoid:        payload.allergensAvoid || [],
			likedFoods:            (payload.likedFoods            || []).slice(0, 20),
			pantryItems:           (payload.pantryItems           || []).slice(0, 30),
			daysToGenerate:        payload.daysToGenerate         || DAY_KEYS_PLAN,
			additionalPreferences: payload.additionalPreferences  || "",
			dislikedFoods:         (payload.dislikedFoods         || []).slice(0, 20),
		});

		const openai = new OpenAI({ apiKey: OPENAI_API_KEY.value() });
		let plan, leftoverSummary, disclaimer;

		try {
			const res    = await openai.chat.completions.create({
				model:       MODEL,
				temperature: 0.75,
				messages: [
					{ role: "system", content: WEEKLY_PLAN_SYSTEM },
					{ role: "user",   content: userMessage },
				],
			});
			const result = JSON.parse(cleanJson(res.choices[0].message.content.trim()));
			if (!result.plan || !result.plan.monday) throw new Error("Bad shape");

			// Validate all 7 days and 4 meal slots exist
			const validatedPlan = {};
			DAY_KEYS_PLAN.forEach((day) => {
				validatedPlan[day] = {};
				MEAL_KEYS_PLAN.forEach((meal) => {
					validatedPlan[day][meal] = Array.isArray(result.plan[day]?.[meal])
						? result.plan[day][meal]
						: [];
				});
			});

			plan           = validatedPlan;
			leftoverSummary = result.leftoverSummary || "";
			disclaimer     = result.disclaimer || "Meal plans are AI-generated suggestions for inspiration only.";
		} catch (err) {
			console.error("[weeklyPlan] OpenAI error:", err.message);
			throw new HttpsError("internal", "Could not generate meal plan. Please try again.");
		}

		await usageRef.set({ count: 1, date: today }, { merge: true });

		return { plan, leftoverSummary, disclaimer };
	},
);

exports.joinViaInviteCode = onCall(async (request) => {
	const uid   = request.auth?.uid;
	const email = request.auth?.token?.email || "";
	if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");

	const { code } = request.data || {};
	if (!code) throw new HttpsError("invalid-argument", "Code is required.");

	const db      = getFirestore();
	const codeRef = db.collection("inviteCodes").doc(code.trim().toUpperCase());
	const codeDoc = await codeRef.get();

	if (!codeDoc.exists) {
		throw new HttpsError("not-found", "Invalid invite code. Please check and try again.");
	}

	const { childId, childName, ownerUid, expiresAt, used, role = "caregiver" } = codeDoc.data();

	if (used) {
		throw new HttpsError("already-exists", "This invite code has already been used.");
	}
	if (expiresAt.toDate() < new Date()) {
		throw new HttpsError("deadline-exceeded", "This invite code has expired. Ask the owner to generate a new one.");
	}
	if (ownerUid === uid) {
		throw new HttpsError("invalid-argument", "You can't use your own invite code.");
	}

	const childRef = db.collection("children").doc(childId);
	const childDoc = await childRef.get();
	if (!childDoc.exists) throw new HttpsError("not-found", "Child not found.");

	if ((childDoc.data().sharedWith || []).includes(uid)) {
		throw new HttpsError("already-exists", `You already have access to ${childName}.`);
	}

	await Promise.all([
		codeRef.update({ used: true, usedByUid: uid, usedByEmail: email }),
		childRef.update({
			sharedWith:                    FieldValue.arrayUnion(uid),
			sharedWithEmails:              FieldValue.arrayUnion(email),
			[`sharedWithRoles.${uid}`]:    role,
		}),
	]);

	return { childName };
});
