/**
 * MunchSprouts — Broadcast push notification
 *
 * Reads all user push tokens from Firestore and sends via Expo's push API.
 * Uses the Firebase Admin SDK with the migration service account key.
 *
 * Run: node scripts/sendPushNotification.js
 */

const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore }         = require("firebase-admin/firestore");
const https                    = require("https");

// ── Config ────────────────────────────────────────────────────────────────────

const SERVICE_ACCOUNT_PATH = "../../migration/serviceAccountKey.json";

const NOTIFICATION = {
	title: "🌟 50% Off MunchSprouts Pro — Today Only!",
	body:  "Unlock lifetime Pro access for just £19.99 (was £39.99)! All recipes, AI meal ideas, smart insights & more — yours forever. Tap to claim your exclusive discount 🎉",
	data:  { type: "announcement", url: "https://apps.apple.com/redeem?ctx=offercodes&id=6763142582&code=MUNCHSPROUTS50" },
};

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const CHUNK_SIZE    = 100; // Expo recommends max 100 per request

// ── Firebase init ─────────────────────────────────────────────────────────────

initializeApp({ credential: cert(require(SERVICE_ACCOUNT_PATH)) });
const db = getFirestore();

// ── Helpers ───────────────────────────────────────────────────────────────────

function chunk(arr, size) {
	const chunks = [];
	for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
	return chunks;
}

function sendChunk(messages) {
	return new Promise((resolve, reject) => {
		const body = JSON.stringify(messages);
		const options = {
			hostname: "exp.host",
			path:     "/--/api/v2/push/send",
			method:   "POST",
			headers:  {
				"Content-Type":   "application/json",
				"Accept":         "application/json",
				"Accept-Encoding": "gzip, deflate",
				"Content-Length": Buffer.byteLength(body),
			},
		};
		const req = https.request(options, (res) => {
			let data = "";
			res.on("data", (d) => { data += d; });
			res.on("end", () => {
				try { resolve(JSON.parse(data)); }
				catch { resolve({ raw: data }); }
			});
		});
		req.on("error", reject);
		req.write(body);
		req.end();
	});
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
	console.log("Fetching push tokens from Firestore…");

	const snapshot = await db.collection("users").get();

	const rawTokens = [];
	snapshot.forEach((doc) => {
		const token = doc.data().pushToken;
		if (token && token.startsWith("ExponentPushToken[")) {
			rawTokens.push(token);
		}
	});

	// Deduplicate — same device can appear across multiple user accounts
	const tokens = [...new Set(rawTokens)];
	console.log(`Found ${rawTokens.length} token${rawTokens.length !== 1 ? "s" : ""}, ${tokens.length} unique after deduplication.`);

	if (tokens.length === 0) {
		console.log("No tokens to send to. Exiting.");
		return;
	}

	const messages = tokens.map((to) => ({
		to,
		title:         NOTIFICATION.title,
		body:          NOTIFICATION.body,
		data:          NOTIFICATION.data,
		sound:         "default",
		priority:      "high",
		channelId:     "default",
	}));

	const chunks = chunk(messages, CHUNK_SIZE);
	console.log(`Sending in ${chunks.length} batch${chunks.length !== 1 ? "es" : ""} of up to ${CHUNK_SIZE}…\n`);

	let totalOk = 0, totalErr = 0;

	for (let i = 0; i < chunks.length; i++) {
		process.stdout.write(`  Batch ${i + 1}/${chunks.length}… `);
		try {
			const result = await sendChunk(chunks[i]);
			const data   = result.data || [];
			const ok     = data.filter((r) => r.status === "ok").length;
			const errs   = data.filter((r) => r.status !== "ok");
			totalOk  += ok;
			totalErr += errs.length;
			console.log(`✓  ${ok} sent${errs.length ? `, ${errs.length} errors` : ""}`);
			if (errs.length) errs.forEach((e) => console.log(`     ⚠ ${JSON.stringify(e)}`));
		} catch (err) {
			console.log(`✗  Request failed: ${err.message}`);
			totalErr += chunks[i].length;
		}
	}

	console.log(`\nDone! ${totalOk} delivered, ${totalErr} failed.`);
}

main().catch((err) => { console.error("Fatal error:", err); process.exit(1); });
