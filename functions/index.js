/**
 * MunchSprouts — generateInsights Cloud Function
 *
 * Receives a computed data payload from the app, generates personalised
 * AI narrative insights using Gemini Flash, caches the result in Firestore
 * for 24 hours, and returns the text to the client.
 *
 * Deploy: firebase deploy --only functions
 * Set key: firebase functions:secrets:set GEMINI_API_KEY
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret }       = require("firebase-functions/params");
const { initializeApp }      = require("firebase-admin/app");
const { getFirestore }        = require("firebase-admin/firestore");
const { GoogleGenerativeAI }  = require("@google/generative-ai");

initializeApp();

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

// ── Cache TTL — regenerate after 24 hours ────────────────────────────────────
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// ── Build the prompt ─────────────────────────────────────────────────────────

function buildPrompt(data) {
	const {
		childName, ageMonths, nutrition, trends,
		milestones, allergenProgress, growth,
	} = data;

	const ageLabel = ageMonths != null
		? `${ageMonths} months old`
		: "age unknown";

	const allergenLine = allergenProgress.count > 0
		? `Allergens introduced so far: ${allergenProgress.introduced.join(", ")}.` +
		  (allergenProgress.missing.length
			? ` Not yet tried: ${allergenProgress.missing.slice(0, 4).join(", ")}.`
			: " All main allergens introduced!")
		: "No allergens have been logged yet.";

	const milestoneLine = milestones.achieved.length
		? `Milestones achieved: ${milestones.achieved.join(", ")}.`
		: "No milestones completed yet.";

	const nextMilestoneLine = milestones.next
		? `Next milestone to aim for: "${milestones.next.label}".`
		: "All tracked milestones completed!";

	const trendLine = trends.thisWeekCount === 0
		? "No foods logged this week."
		: `This week: ${trends.thisWeekCount} food entries (${trends.uniqueFoodsThis} unique foods).` +
		  (trends.lastWeekCount > 0
			? ` Last week: ${trends.lastWeekCount} entries. Trend: ${trends.trend}.`
			: "") +
		  (trends.newFoods.length
			? ` New foods tried this week: ${trends.newFoods.join(", ")}.`
			: "");

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
${nextMilestoneLine}
${growthLine}

Write exactly 3 insights as a JSON object with these keys:
- "nutrition": one insight about food variety and nutrition (1-2 sentences, specific to the data above)
- "progress": one insight about weaning progress and milestones (1-2 sentences)
- "nextSteps": one practical, actionable suggestion for this week (1-2 sentences)

Rules:
- Use ${childName}'s name naturally (not in every sentence)
- Be warm, specific, and encouraging — never alarming
- Base suggestions on NHS/BLW guidelines for ${ageLabel}
- Keep each insight under 50 words
- Return ONLY valid JSON, no markdown, no extra text`;
}

// ── Cloud Function ───────────────────────────────────────────────────────────

exports.generateInsights = onCall(
	{ secrets: [GEMINI_API_KEY], region: "europe-west2" },
	async (request) => {
		// ── Auth guard ───────────────────────────────────────────────────────
		if (!request.auth) {
			throw new HttpsError("unauthenticated", "Must be signed in.");
		}

		const uid     = request.auth.uid;
		const payload = request.data;

		if (!payload || !payload.childName) {
			throw new HttpsError("invalid-argument", "Missing insight payload.");
		}

		const childId  = payload.childId || "default";
		const db       = getFirestore();
		const cacheRef = db.doc(`users/${uid}/insights/${childId}`);

		// ── Check cache ──────────────────────────────────────────────────────
		const cacheSnap = await cacheRef.get();
		if (cacheSnap.exists()) {
			const cached = cacheSnap.data();
			const age    = Date.now() - (cached.generatedAt?.toMillis?.() || 0);
			if (age < CACHE_TTL_MS && cached.insights) {
				console.log(`[insights] cache hit for ${uid}/${childId} (${Math.round(age / 60000)}m old)`);
				return { insights: cached.insights, cached: true };
			}
		}

		// ── Call Gemini ──────────────────────────────────────────────────────
		const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
		const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

		const prompt = buildPrompt(payload);

		let insights;
		try {
			const result   = await model.generateContent(prompt);
			const text     = result.response.text().trim();
			// Strip markdown code fences if Gemini adds them
			const jsonText = text.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
			insights       = JSON.parse(jsonText);

			// Validate shape
			if (!insights.nutrition || !insights.progress || !insights.nextSteps) {
				throw new Error("Unexpected response shape");
			}
		} catch (err) {
			console.error("[insights] Gemini error:", err.message);
			// Graceful fallback — return rule-based defaults rather than crashing
			insights = buildFallbackInsights(payload);
		}

		// ── Cache result ─────────────────────────────────────────────────────
		await cacheRef.set({
			insights,
			generatedAt: new Date(),
			ageMonths:   payload.ageMonths,
		});

		return { insights, cached: false };
	},
);

// ── Fallback when Gemini is unavailable / rate-limited ───────────────────────

function buildFallbackInsights(data) {
	const { childName, nutrition, milestones, trends } = data;

	const nutritionText = nutrition.score >= 70
		? `${childName} is trying a great variety of foods across ${nutrition.categoriesFound.length} food groups — keep it up!`
		: nutrition.missingCategories.length
		? `Try introducing some ${nutrition.missingCategories[0].toLowerCase()} this week to boost ${childName}'s food variety.`
		: `${childName} is building a good range of foods. Keep offering new tastes regularly.`;

	const progressText = milestones.achieved.length
		? `${childName} has reached ${milestones.achieved.length} weaning milestone${milestones.achieved.length > 1 ? "s" : ""} — wonderful progress!`
		: "You're just getting started — every new food is a milestone in itself!";

	const nextText = milestones.next
		? milestones.next.tip
		: trends.thisWeekCount === 0
		? "Try logging some meals this week to start tracking weaning progress."
		: "Keep offering a wide range of foods and textures — consistency is key!";

	return {
		nutrition:  nutritionText,
		progress:   progressText,
		nextSteps:  nextText,
	};
}
