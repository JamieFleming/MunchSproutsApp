/**
 * Run with: node scripts/checkPhotos.js
 *
 * Reports the state of all photoUri fields in your foodLog collection.
 * Requires: npm install firebase-admin
 * Requires: a Firebase service account key saved as scripts/serviceAccount.json
 *   (Firebase Console → Project Settings → Service accounts → Generate new private key)
 */

const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccount.json");

admin.initializeApp({
	credential: admin.credential.cert(serviceAccount),
	projectId: "munchsprouts",
});

const db = admin.firestore();

async function main() {
	const snap = await db.collection("foodLog").get();

	const results = {
		total: snap.size,
		uploaded: [],   // https:// — already fine
		base64: [],     // data:   — could potentially migrate
		localFile: [],  // file:// — unrecoverable
		empty: [],      // ""      — no photo
	};

	snap.docs.forEach((d) => {
		const { photoUri, userId, name } = d.data();
		const entry = { id: d.id, userId, name, photoUri };
		if (!photoUri) {
			results.empty.push(entry);
		} else if (photoUri.startsWith("https://")) {
			results.uploaded.push(entry);
		} else if (photoUri.startsWith("data:")) {
			results.base64.push(entry);
		} else if (photoUri.startsWith("file://")) {
			results.localFile.push(entry);
		} else {
			results.localFile.push(entry); // unknown — treat as unrecoverable
		}
	});

	console.log("\n📊 Photo URI breakdown:");
	console.log(`  Total entries:       ${results.total}`);
	console.log(`  ✅ Uploaded (https): ${results.uploaded.length}`);
	console.log(`  ⚠️  Base64 (data:):  ${results.base64.length}  ← could migrate`);
	console.log(`  ❌ Local file:       ${results.localFile.length}  ← unrecoverable`);
	console.log(`  ➖ No photo:         ${results.empty.length}`);

	if (results.localFile.length > 0) {
		console.log("\n❌ Unrecoverable local file paths:");
		results.localFile.forEach((e) => console.log(`  ${e.id} (${e.name}) — ${e.photoUri?.slice(0, 60)}`));
	}

	if (results.base64.length > 0) {
		console.log("\n⚠️  Base64 entries that could be migrated:");
		results.base64.forEach((e) => console.log(`  ${e.id} (${e.name})`));
	}
}

main().catch(console.error).finally(() => process.exit());
