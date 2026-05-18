/**
 * MunchSprouts Cloud Functions
 *
 * Uses Vertex AI (Gemini) which authenticates via the Cloud Function's
 * service account — no API key required, billed through the Firebase
 * project's existing billing account.
 *
 * Deploy: firebase deploy --only functions
 * Requires: Vertex AI API enabled at console.cloud.google.com
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp }      = require("firebase-admin/app");
const { getFirestore }       = require("firebase-admin/firestore");
const { VertexAI }           = require("@google-cloud/vertexai");

initializeApp();

const PROJECT  = "munchsprouts";
const LOCATION = "europe-west2";
const MODEL    = "gemini-2.0-flash-001";

const vertex = new VertexAI({ project: PROJECT, location: LOCATION });

// ── Shared helper: strip markdown fences Gemini sometimes adds ───────────────
function cleanJson(text) {
	return text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/, "").trim();
}

// ── Cache TTL — regenerate insights after 24 hours ───────────────────────────
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────
// generateInsights
// ─────────────────────────────────────────────────────────────────────────────

function buildInsightsPrompt(data) {
	const {
		childName, ageMonths, nutrition, trends,
		milestones, allergenProgress, growth,
	} = data;

	const ageLabel = ageMonths != null ? `${ageMonths} months old` : "age unknown";

	const allergenLine = allergenProgress.count > 0
		? `Allergens introduced so far: ${allergenProgress.introduced.join(", ")}.` +
		  (allergenProgress.missing.length
			? ` Not yet tried: ${allergenProgress.missing.slice(0, 4).join(", ")}.`
			: " All main allergens introduced!")
		: "No allergens have been logged yet.";

	const milestoneLine = milestones.achieved.length
		? `Milestones achieved: ${milestones.achieved.join(", ")}.`
		: "No milestones completed yet.";

	const trendLine = trends.thisWeekCount === 0
		? "No foods logged this week."
		: `This week: ${trends.thisWeekCount} food entries (${trends.uniqueFoodsThis} unique foods).` +
		  (trends.lastWeekCount > 0 ? ` Last week: ${trends.lastWeekCount} entries. Trend: ${trends.trend}.` : "") +
		  (trends.newFoods.length ? ` New foods tried: ${trends.newFoods.join(", ")}.` : "");

	const growthLine = growth.entryCount < 2
		? "Not enough weight entries to assess growth trend yet."
		: `Weight trend: ${growth.trend}.`;

	return `You are a friendly, knowledgeable baby weaning assistant for an app called MunchSprouts.
Write 3 short, warm, encouraging personalised insights for a parent.

Baby: ${childName}, ${ageLabel}
Nutrition variety score: ${nutrition.score}/100
Food groups tried (last 14 days): ${nutrition.categoriesFound.join(", ") || "none"}
Missing food groups: ${nutrition.missingCategories.join(", ") || "none — great variety!"}
Most tried foods: ${nutrition.topFoods.join(", ") || "none yet"}
${trendLine}
${allergenLine}
${milestoneLine}
${milestones.next ? `Next milestone: "${milestones.next.label}".` : "All tracked milestones completed!"}
${growthLine}

Return ONLY a JSON object with exactly these keys (no markdown, no extra text):
{
  "nutrition": "one insight about food variety (1-2 sentences, under 50 words)",
  "progress": "one insight about weaning progress and milestones (1-2 sentences, under 50 words)",
  "nextSteps": "one practical actionable suggestion for this week (1-2 sentences, under 50 words)"
}

Rules: use ${childName}'s name naturally, be warm and encouraging, base on NHS/BLW guidelines.`;
}

exports.generateInsights = onCall(
	{ region: "europe-west2" },
	async (request) => {
		if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in.");

		const uid     = request.auth.uid;
		const payload = request.data;
		if (!payload?.childName) throw new HttpsError("invalid-argument", "Missing payload.");

		const childId  = payload.childId || "default";
		const db       = getFirestore();
		const cacheRef = db.doc(`users/${uid}/insights/${childId}`);

		// Check cache
		const snap = await cacheRef.get();
		if (snap.exists) {
			const cached = snap.data();
			const age    = Date.now() - (cached.generatedAt?.toMillis?.() || 0);
			if (age < CACHE_TTL_MS && cached.insights) {
				return { insights: cached.insights, cached: true };
			}
		}

		// Call Gemini via Vertex AI
		const model  = vertex.getGenerativeModel({ model: MODEL });
		const prompt = buildInsightsPrompt(payload);

		let insights;
		try {
			const result   = await model.generateContent(prompt);
			const text     = result.response.candidates[0].content.parts[0].text.trim();
			insights       = JSON.parse(cleanJson(text));
			if (!insights.nutrition || !insights.progress || !insights.nextSteps) {
				throw new Error("Unexpected shape");
			}
		} catch (err) {
			console.error("[insights] Gemini error:", err.message);
			insights = buildFallbackInsights(payload);
		}

		await cacheRef.set({ insights, generatedAt: new Date(), ageMonths: payload.ageMonths });
		return { insights, cached: false };
	},
);

// ─────────────────────────────────────────────────────────────────────────────
// generateMealIdeas
// ─────────────────────────────────────────────────────────────────────────────

const FREE_DAILY_LIMIT = 3;
const PRO_DAILY_LIMIT  = 10;

function todayKey() {
	return new Date().toISOString().split("T")[0];
}

const MEAL_IDEAS_SYSTEM_PROMPT = `You are the Smart Meal Ideas assistant for Munch Sprouts, a baby feeding and baby-led weaning app for parents.

Your role is to generate SAFE, SIMPLE, REALISTIC and AGE-APPROPRIATE meal ideas for babies and toddlers based on the child's feeding history, likes/dislikes, allergens and foods already introduced.

IMPORTANT SAFETY RULES:
- Prioritise safety and practicality over creativity.
- Only suggest foods suitable for the baby's age and texture stage.
- Never suggest choking hazards.
- Never suggest whole nuts, popcorn, marshmallows, whole grapes, hard raw vegetables or unsafe textures.
- Never suggest honey under 12 months.
- Never suggest excessive salt or sugar.
- Never suggest unsafe or undercooked egg, meat or fish.
- Never suggest allergens listed in allergensAvoid.
- Only introduce ONE new allergen at a time when appropriate.
- Avoid recommending multiple new foods together where possible.
- Keep meals realistic for busy parents.
- Use simple ingredients and preparation methods.
- Never provide medical advice or diagnose allergies.
- Always remain supportive, calm and family-friendly.

GOALS:
- Suggest meals based on foods the baby already likes.
- Gently encourage variety and introduce new foods safely.
- Suggest balanced meals where possible.
- Recommend age-appropriate textures.
- Make feeding feel easier and less overwhelming.

MEAL IDEA RULES:
- Use familiar foods plus optionally one gentle new food.
- Keep ingredient lists short (4-6 items max).
- Prefer practical family ingredients.
- Avoid overcomplicated recipes.

OUTPUT: Return ONLY valid JSON, no markdown, no extra text.
Return exactly this structure:
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
      "allergens": []
    }
  ],
  "disclaimer": "Smart Meal Ideas are for inspiration only and are not medical advice. Always follow safe weaning guidance and speak to a healthcare professional regarding allergies or feeding concerns."
}`;

exports.generateMealIdeas = onCall(
	{ region: "europe-west2" },
	async (request) => {
		if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in.");

		const uid     = request.auth.uid;
		const payload = request.data;
		if (!payload || payload.ageMonths == null) {
			throw new HttpsError("invalid-argument", "Missing payload.");
		}

		const isPro = payload.isPro === true;
		const limit = isPro ? PRO_DAILY_LIMIT : FREE_DAILY_LIMIT;
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
				message: isPro
					? `You've reached today's limit of ${limit} Smart Meal Ideas. Try again tomorrow.`
					: `You've reached today's limit of ${limit} free ideas today. Upgrade to Pro for up to ${PRO_DAILY_LIMIT} per day.`,
			};
		}

		// Build user prompt
		const userPrompt = JSON.stringify({
			ageMonths:      payload.ageMonths,
			mealType:       payload.mealType || "any",
			textureLevel:   payload.textureLevel || "age-appropriate",
			childName:      payload.childName || "Baby",
			likedFoods:     (payload.likedFoods    || []).slice(0, 20),
			dislikedFoods:  (payload.dislikedFoods  || []).slice(0, 10),
			allergensSafe:  payload.allergensSafe  || [],
			allergensAvoid: payload.allergensAvoid || [],
			allergensNotTried: payload.allergensNotTried || [],
			foodsTried:     (payload.foodsTried    || []).slice(0, 30),
		});

		// Call Gemini via Vertex AI with system instruction
		const model = vertex.getGenerativeModel({
			model: MODEL,
			systemInstruction: { parts: [{ text: MEAL_IDEAS_SYSTEM_PROMPT }] },
		});

		let meals, disclaimer;
		try {
			const response = await model.generateContent({
				contents: [{ role: "user", parts: [{ text: userPrompt }] }],
			});
			const text   = response.response.candidates[0].content.parts[0].text.trim();
			const result = JSON.parse(cleanJson(text));
			if (!result.meals || !Array.isArray(result.meals)) throw new Error("Bad shape");
			meals      = result.meals;
			disclaimer = result.disclaimer;
		} catch (err) {
			console.error("[mealIdeas] Gemini error:", err.message);
			throw new HttpsError("internal", "Could not generate meal ideas. Please try again.");
		}

		// Increment usage
		await usageRef.set({ count: used + 1, date: today }, { merge: true });

		return {
			meals,
			disclaimer: disclaimer || "Smart Meal Ideas are for inspiration only and are not medical advice. Always follow safe weaning guidance and speak to a healthcare professional regarding allergies or feeding concerns.",
			used:  used + 1,
			limit,
		};
	},
);

// ── Fallback insights when Gemini unavailable ────────────────────────────────

function buildFallbackInsights(data) {
	const { childName, nutrition, milestones, trends } = data;
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
	};
}
