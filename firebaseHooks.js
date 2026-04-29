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
} from "firebase/firestore";
import { auth, db } from "./firebase";

// AUTH STATE
export function useAuth() {
	const [user, setUser] = useState(null);
	const [userDoc, setUserDoc] = useState(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
			setUser(firebaseUser);

			if (firebaseUser) {
				try {
					const snap = await getDoc(doc(db, "users", firebaseUser.uid));
					setUserDoc(snap.exists() ? snap.data() : null);
				} catch (e) {
					console.error("Error fetching user doc:", e);
					setUserDoc(null);
				}
			} else {
				setUserDoc(null);
			}

			setLoading(false);
		});

		return unsubscribe;
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

	// Create Firestore user doc if this is a new Google user
	const userRef = doc(db, "users", user.uid);
	const snap = await getDoc(userRef);
	if (!snap.exists()) {
		await setDoc(userRef, {
			email: user.email,
			plan: "free",
			createdAt: serverTimestamp(),
		});
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
	if (safeData.photoURL && !isSafeBase64Size(safeData.photoURL)) {
		console.warn(
			"Profile photo too large for Firestore — saving without photo.",
		);
		safeData.photoURL = "";
	}
	await updateDoc(doc(db, "users", userId), safeData);
}

// PASSWORD RESET
export async function sendPasswordReset(email) {
	await sendPasswordResetEmail(auth, email);
}

export async function deleteAccount(userId) {
	// Delete all children
	const childSnap = await getDocs(
		query(collection(db, "children"), where("userId", "==", userId)),
	);
	await Promise.all(childSnap.docs.map((d) => deleteDoc(d.ref)));

	// Delete all food log entries
	const logSnap = await getDocs(
		query(collection(db, "foodLog"), where("userId", "==", userId)),
	);
	await Promise.all(logSnap.docs.map((d) => deleteDoc(d.ref)));

	// Delete favourite recipes subcollection
	try {
		const favSnap = await getDocs(
			collection(db, "users", userId, "favouriteRecipes"),
		);
		await Promise.all(favSnap.docs.map((d) => deleteDoc(d.ref)));
	} catch (e) {
		console.warn("Could not delete favourite recipes:", e.message);
	}

	// Delete bottle log entries
	try {
		const bottleSnap = await getDocs(
			query(collection(db, "bottleLog"), where("userId", "==", userId)),
		);
		await Promise.all(bottleSnap.docs.map((d) => deleteDoc(d.ref)));
	} catch (e) {
		console.warn("Could not delete bottle log entries:", e.message);
	}

	// Delete any recipe suggestions
	try {
		const suggestSnap = await getDocs(
			query(collection(db, "recipeSuggestions"), where("userId", "==", userId)),
		);
		await Promise.all(suggestSnap.docs.map((d) => deleteDoc(d.ref)));
	} catch (e) {
		console.warn("Could not delete recipe suggestions:", e.message);
	}

	// Delete user document
	await deleteDoc(doc(db, "users", userId));

	// Delete the Firebase Auth account itself
	await deleteUser(auth.currentUser);
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
	if (safeData.photoUri && !isSafeBase64Size(safeData.photoUri)) {
		console.warn("Child photo too large for Firestore — saving without photo.");
		safeData.photoUri = "";
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

// Check if a base64 string is within Firestore's safe limit (~700kb to leave room)
function isSafeBase64Size(base64str, maxKb = 700) {
	if (!base64str) return true;
	// base64 encodes 3 bytes as 4 chars, so length * 0.75 = bytes
	const bytes = base64str.length * 0.75;
	return bytes < maxKb * 1024;
}

export async function addFoodEntry(userId, entry) {
	const safeEntry = { ...entry };
	// If photo is too large for Firestore, store without it and warn
	if (safeEntry.photoUri && !isSafeBase64Size(safeEntry.photoUri)) {
		console.warn(
			"Photo too large for Firestore — storing entry without photo.",
		);
		safeEntry.photoUri = "";
	}
	const ref = await addDoc(collection(db, "foodLog"), {
		userId,
		...safeEntry,
	});
	return ref.id;
}

export async function updateFoodEntry(entryId, data) {
	const safeData = { ...data };
	if (safeData.photoUri && !isSafeBase64Size(safeData.photoUri)) {
		console.warn(
			"Photo too large for Firestore — updating entry without photo.",
		);
		safeData.photoUri = "";
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
