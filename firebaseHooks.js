import { useState, useEffect } from "react";
import {
	createUserWithEmailAndPassword,
	signInWithEmailAndPassword,
	signInWithCredential,
	GoogleAuthProvider,
	signOut,
	onAuthStateChanged,
	sendPasswordResetEmail,
	deleteUser,
	EmailAuthProvider,
	reauthenticateWithCredential,
} from "firebase/auth";
import {
	collection,
	doc,
	getDoc,
	setDoc,
	addDoc,
	getDocs,
	updateDoc,
	deleteDoc,
	query,
	where,
	serverTimestamp,
	orderBy,
	onSnapshot,
} from "firebase/firestore";
import { auth, db, storage } from "./firebase";
import { ref, uploadString, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

// AUTH STATE
export function useAuth() {
	const [user, setUser] = useState(null);
	const [userDoc, setUserDoc] = useState(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let unsubDoc = null;

		const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
			// Clean up any previous Firestore listener when auth state changes
			if (unsubDoc) { unsubDoc(); unsubDoc = null; }

			setUser(firebaseUser);

			if (firebaseUser) {
				// Real-time listener — picks up the user doc as soon as it's
				// created or updated (fixes the Google sign-in race condition where
				// onAuthStateChanged fires before signInWithGoogle finishes writing
				// the Firestore document).
				// If the document is missing entirely (e.g. existing users caught
				// by the race condition), we recreate it so they aren't stuck null.
				unsubDoc = onSnapshot(
					doc(db, "users", firebaseUser.uid),
					async (snap) => {
						if (snap.exists()) {
							setUserDoc(snap.data());
						} else {
							// Doc missing — write it now. merge:true is safe even if
							// setupNotifications already wrote a pushToken field.
							try {
								await setDoc(
									doc(db, "users", firebaseUser.uid),
									{
										email:     firebaseUser.email,
										plan:      "free",
										createdAt: serverTimestamp(),
									},
									{ merge: true },
								);
								// onSnapshot will fire again automatically with the new doc
							} catch (e) {
								console.error("Failed to create missing user doc:", e);
								setUserDoc(null);
							}
						}
					},
					(e) => { console.error("User doc listener error:", e); setUserDoc(null); },
				);
			} else {
				setUserDoc(null);
			}

			setLoading(false);
		});

		return () => {
			unsubAuth();
			if (unsubDoc) unsubDoc();
		};
	}, []);

	return {
		user,
		userDoc,
		loading,
		isPro: userDoc?.plan === "pro",
	};
}

// SIGN UP
export async function signUp(email, password) {
	const cred = await createUserWithEmailAndPassword(auth, email, password);

	await setDoc(doc(db, "users", cred.user.uid), {
		email,
		plan: "free",
		createdAt: serverTimestamp(),
	});

	return cred.user;
}

// SIGN IN
export async function signIn(email, password) {
	const cred = await signInWithEmailAndPassword(auth, email, password);
	return cred.user;
}

// GOOGLE SIGN-IN
// idToken comes from expo-auth-session Google flow in the calling screen
export async function signInWithGoogle(idToken) {
	if (!idToken) throw new Error("No Google ID token provided.");
	const credential = GoogleAuthProvider.credential(idToken);
	const result = await signInWithCredential(auth, credential);
	const { user } = result;

	// Create or patch Firestore user doc
	const userRef = doc(db, "users", user.uid);
	const snap    = await getDoc(userRef);
	if (!snap.exists()) {
		// Brand-new Google user
		await setDoc(userRef, {
			email:     user.email,
			plan:      "free",
			createdAt: serverTimestamp(),
		});
	} else if (!snap.data().email && user.email) {
		// Existing user whose email was previously saved as null — backfill it
		await updateDoc(userRef, { email: user.email });
	}

	return user;
}

// SIGN OUT
export async function logOut() {
	await signOut(auth);
}

// UPDATE USER PROFILE (photo, display name etc)
export async function updateUserProfile(userId, data) {
	const safeData = { ...data };
	if (safeData.photoURL) {
		try {
			safeData.photoURL = await uploadPhotoIfBase64(
				safeData.photoURL,
				`profilePhotos/${userId}/profile.jpg`,
			);
		} catch (e) {
			console.warn("Profile photo upload failed:", e.message);
			safeData.photoURL = "";
		}
	}
	await updateDoc(doc(db, "users", userId), safeData);
}

// PASSWORD RESET
export async function sendPasswordReset(email) {
	await sendPasswordResetEmail(auth, email);
}

export async function deleteAccount(userId) {
	// Delete the Firebase Auth account FIRST so we fail fast if re-auth is
	// required, before any Firestore data is touched. Deleting the auth user
	// also triggers onAuthStateChanged → the app navigates to the auth screen
	// automatically without needing a manual sign-out call.
	await deleteUser(auth.currentUser);

	// Auth account removed — now clean up all Firestore data (best-effort,
	// non-fatal if individual collections fail)
	const childSnap = await getDocs(
		query(collection(db, "children"), where("userId", "==", userId)),
	);
	await Promise.all(childSnap.docs.map((d) => deleteDoc(d.ref)));

	const logSnap = await getDocs(
		query(collection(db, "foodLog"), where("userId", "==", userId)),
	);
	await Promise.all(logSnap.docs.map((d) => deleteDoc(d.ref)));

	try {
		const favSnap = await getDocs(
			collection(db, "users", userId, "favouriteRecipes"),
		);
		await Promise.all(favSnap.docs.map((d) => deleteDoc(d.ref)));
	} catch (e) {
		console.warn("Could not delete favourite recipes:", e.message);
	}

	try {
		const bottleSnap = await getDocs(
			query(collection(db, "bottleLog"), where("userId", "==", userId)),
		);
		await Promise.all(bottleSnap.docs.map((d) => deleteDoc(d.ref)));
	} catch (e) {
		console.warn("Could not delete bottle log:", e.message);
	}

	try {
		const suggestSnap = await getDocs(
			query(collection(db, "recipeSuggestions"), where("userId", "==", userId)),
		);
		await Promise.all(suggestSnap.docs.map((d) => deleteDoc(d.ref)));
	} catch (e) {
		console.warn("Could not delete recipe suggestions:", e.message);
	}

	try {
		const weightSnap = await getDocs(
			query(collection(db, "weightLog"), where("userId", "==", userId)),
		);
		await Promise.all(weightSnap.docs.map((d) => deleteDoc(d.ref)));
	} catch (e) {
		console.warn("Could not delete weight log:", e.message);
	}

	try {
		await deleteDoc(doc(db, "users", userId));
	} catch (e) {
		console.warn("Could not delete user doc:", e.message);
	}
}

// WEIGHT LOG
export async function fetchWeightLog(userId) {
	const snap = await getDocs(
		query(collection(db, "weightLog"), where("userId", "==", userId)),
	);
	return snap.docs
		.map((d) => ({ id: d.id, ...d.data() }))
		.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
}

export async function addWeightEntry(userId, entry) {
	const ref = await addDoc(collection(db, "weightLog"), { userId, ...entry });
	return ref.id;
}

export async function updateWeightEntry(id, fields) {
	await updateDoc(doc(db, "weightLog", id), fields);
}

export async function deleteWeightEntry(id) {
	await deleteDoc(doc(db, "weightLog", id));
}

// CHILDREN
export async function fetchChildren(userId) {
	// Fetch children owned by this user
	const ownedQuery = query(
		collection(db, "children"),
		where("userId", "==", userId),
	);

	// Fetch children shared with this user
	const sharedQuery = query(
		collection(db, "children"),
		where("sharedWith", "array-contains", userId),
	);

	const [ownedSnap, sharedSnap] = await Promise.all([
		getDocs(ownedQuery),
		getDocs(sharedQuery),
	]);

	// Merge both results, avoiding duplicates
	const allDocs = new Map();
	ownedSnap.docs.forEach((d) =>
		allDocs.set(d.id, { ...d.data(), id: d.id, isOwner: true }),
	);

	// For shared children, also fetch the owner's email so we can display it
	for (const d of sharedSnap.docs) {
		const data = d.data();
		let ownerEmail = null;
		try {
			const ownerSnap = await getDoc(doc(db, "users", data.userId));
			if (ownerSnap.exists()) ownerEmail = ownerSnap.data().email || null;
		} catch (e) {
			// Non-critical — just won't show owner email
		}
		allDocs.set(d.id, { ...data, id: d.id, isOwner: false, ownerEmail });
	}

	return Array.from(allDocs.values());
}

export async function addChild(userId, child) {
	const ref = await addDoc(collection(db, "children"), {
		userId,
		...child,
	});
	return ref.id;
}

export async function updateChild(childId, data) {
	const safeData = { ...data };
	if (safeData.photoUri) {
		const ownerUid = auth.currentUser?.uid || safeData.userId || "unknown";
		try {
			safeData.photoUri = await uploadPhotoIfBase64(
				safeData.photoUri,
				`childPhotos/${ownerUid}/${childId}.jpg`,
			);
		} catch (e) {
			console.warn("Child photo upload failed:", e.message);
			safeData.photoUri = "";
		}
	}
	await updateDoc(doc(db, "children", childId), safeData);
}

export async function deleteChild(childId, userId) {
	await deleteDoc(doc(db, "children", childId));

	try {
		const q = query(
			collection(db, "foodLog"),
			where("userId", "==", userId),
			where("childId", "==", childId),
		);
		const snap = await getDocs(q);
		await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
	} catch (e) {
		console.warn("Could not delete food log entries:", e.message);
	}

	try {
		const q = query(
			collection(db, "bottleLog"),
			where("childId", "==", childId),
		);
		const snap = await getDocs(q);
		await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
	} catch (e) {
		console.warn("Could not delete bottle log entries:", e.message);
	}
}

// FOOD LOG
export async function fetchFoodLog(userId) {
	// Get all children this user has access to (owned + shared)
	const children = await fetchChildren(userId);

	// Fetch food log entries owned by this user
	const ownedQuery = query(
		collection(db, "foodLog"),
		where("userId", "==", userId),
	);
	const ownedSnap = await getDocs(ownedQuery);

	// Fetch ALL food log entries for ALL children this user has access to
	// This catches entries added by OTHER users (e.g. family sharing partner)
	const allChildIds = children.map((c) => c.id);
	let childEntries = [];
	if (allChildIds.length > 0) {
		for (let i = 0; i < allChildIds.length; i += 30) {
			const batch = allChildIds.slice(i, i + 30);
			const childQuery = query(
				collection(db, "foodLog"),
				where("childId", "in", batch),
			);
			const snap = await getDocs(childQuery);
			snap.docs.forEach((d) => childEntries.push({ ...d.data(), id: d.id }));
		}
	}

	// Merge both — childEntries covers partner entries, ownedSnap covers your own
	const allEntries = new Map();
	ownedSnap.docs.forEach((d) =>
		allEntries.set(d.id, { ...d.data(), id: d.id }),
	);
	childEntries.forEach((e) => allEntries.set(e.id, e));

	return Array.from(allEntries.values());
}

// Upload a photo to Firebase Storage and return the download URL.
// Accepts a local file URI (file:// or content://) or a legacy base64 data URL.
// Already-uploaded https:// URLs pass through unchanged.
async function uploadPhotoIfBase64(photoUri, storagePath) {
	if (!photoUri) return "";
	if (photoUri.startsWith("http")) return photoUri; // already an uploaded URL

	const photoRef = ref(storage, storagePath);

	if (photoUri.startsWith("data:")) {
		// Legacy base64 data URL path — strip the prefix and upload as raw base64.
		// This avoids the ArrayBuffer→Blob path that crashes on Hermes.
		const base64 = photoUri.split(",")[1];
		const contentType = photoUri.split(";")[0].split(":")[1] || "image/jpeg";
		await uploadString(photoRef, base64, "base64", { contentType });
	} else {
		// Local file URI (file:// on iOS, content:// on Android).
		// Use XMLHttpRequest to create a native blob — this works correctly in Hermes
		// whereas fetch().blob() and new Blob([ArrayBuffer]) do not.
		const blob = await new Promise((resolve, reject) => {
			const xhr = new XMLHttpRequest();
			xhr.onload = () => resolve(xhr.response);
			xhr.onerror = () => reject(new Error("XHR blob fetch failed"));
			xhr.responseType = "blob";
			xhr.open("GET", photoUri, true);
			xhr.send(null);
		});
		await uploadBytes(photoRef, blob);
		blob.close?.();
	}

	return await getDownloadURL(photoRef);
}

// Check if a base64 string is within Firestore's safe limit (~700kb to leave room)
function isSafeBase64Size(base64str, maxKb = 700) {
	if (!base64str) return true;
	// base64 encodes 3 bytes as 4 chars, so length * 0.75 = bytes
	const bytes = base64str.length * 0.75;
	return bytes < maxKb * 1024;
}

export async function addFoodEntry(userId, entry) {
	const safeEntry = { ...entry };
	// First create the doc to get an ID, then upload photo using that ID
	const docRef = await addDoc(collection(db, "foodLog"), {
		userId,
		...safeEntry,
		photoUri: "", // placeholder while we upload
	});
	if (safeEntry.photoUri) {
		try {
			const url = await uploadPhotoIfBase64(
				safeEntry.photoUri,
				`foodPhotos/${userId}/${docRef.id}.jpg`,
			);
			await updateDoc(docRef, { photoUri: url });
		} catch (e) {
			console.warn("Photo upload failed — entry saved without photo:", e.message);
		}
	}
	return docRef.id;
}

export async function updateFoodEntry(entryId, data) {
	const safeData = { ...data };
	if (safeData.photoUri) {
		// Use the authenticated user's UID for the storage path — this ensures
		// it always matches request.auth.uid in Storage security rules, even
		// if the entry's userId field differs (e.g. family sharing).
		const ownerUid = auth.currentUser?.uid || safeData.userId || "unknown";
		try {
			safeData.photoUri = await uploadPhotoIfBase64(
				safeData.photoUri,
				`foodPhotos/${ownerUid}/${entryId}.jpg`,
			);
		} catch (e) {
			console.warn("Photo upload failed — updating without photo:", e.message);
			safeData.photoUri = "";
		}
	}
	await updateDoc(doc(db, "foodLog", entryId), safeData);
}

export async function deleteFoodEntry(entryId) {
	await deleteDoc(doc(db, "foodLog", entryId));
}

export async function fetchRecipes() {
	const q = query(collection(db, "recipes"), orderBy("order", "asc"));
	const snap = await getDocs(q);
	return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
}

export async function toggleRecipeFavourite(userId, recipeId, isFav) {
	const ref = doc(db, "users", userId, "favouriteRecipes", recipeId);
	if (isFav) {
		await deleteDoc(ref);
	} else {
		await setDoc(ref, { recipeId, savedAt: serverTimestamp() });
	}
}

export async function fetchFavouriteRecipes(userId) {
	const snap = await getDocs(
		collection(db, "users", userId, "favouriteRecipes"),
	);
	return snap.docs.map((d) => d.id); // just the recipe IDs
}

// BOTTLE LOG
export async function fetchBottleLog(userId) {
	const children = await fetchChildren(userId);

	const ownedQuery = query(
		collection(db, "bottleLog"),
		where("userId", "==", userId),
	);
	const ownedSnap = await getDocs(ownedQuery);

	const allChildIds = children.map((c) => c.id);
	let childEntries = [];
	if (allChildIds.length > 0) {
		for (let i = 0; i < allChildIds.length; i += 30) {
			const batch = allChildIds.slice(i, i + 30);
			const childQuery = query(
				collection(db, "bottleLog"),
				where("childId", "in", batch),
			);
			const snap = await getDocs(childQuery);
			snap.docs.forEach((d) => childEntries.push({ ...d.data(), id: d.id }));
		}
	}

	const allEntries = new Map();
	ownedSnap.docs.forEach((d) => allEntries.set(d.id, { ...d.data(), id: d.id }));
	childEntries.forEach((e) => allEntries.set(e.id, e));

	return Array.from(allEntries.values());
}

export async function addBottleEntry(userId, entry) {
	const ref = await addDoc(collection(db, "bottleLog"), { userId, ...entry });
	return ref.id;
}

export async function updateBottleEntry(entryId, data) {
	await updateDoc(doc(db, "bottleLog", entryId), data);
}

export async function deleteBottleEntry(entryId) {
	await deleteDoc(doc(db, "bottleLog", entryId));
}

// ── Push notifications ────────────────────────────────────────────────────────

/**
 * Persist an Expo push token against the user's Firestore document.
 * Uses merge so no other fields are overwritten.
 */
export async function savePushToken(userId, token) {
	await setDoc(
		doc(db, "users", userId),
		{ pushToken: token, pushTokenUpdatedAt: new Date().toISOString() },
		{ merge: true },
	);
}
