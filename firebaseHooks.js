import { useState, useEffect } from "react";
import {
	createUserWithEmailAndPassword,
	signInWithEmailAndPassword,
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

// SIGN OUT
export async function logOut() {
	await signOut(auth);
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
	sharedSnap.docs.forEach((d) =>
		allDocs.set(d.id, { ...d.data(), id: d.id, isOwner: false }),
	);

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
	await updateDoc(doc(db, "children", childId), data);
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
}

// FOOD LOG
export async function fetchFoodLog(userId) {
	// Get all children this user has access to (owned + shared)
	const children = await fetchChildren(userId);
	const childIds = children.map((c) => c.id);

	// Fetch food log entries owned by this user
	const ownedQuery = query(
		collection(db, "foodLog"),
		where("userId", "==", userId),
	);
	const ownedSnap = await getDocs(ownedQuery);

	// Fetch food log entries for shared children
	// Firestore doesn't support array queries with more than 30 items
	// so we batch the childId queries if needed
	const sharedChildIds = children.filter((c) => !c.isOwner).map((c) => c.id);

	let sharedEntries = [];
	if (sharedChildIds.length > 0) {
		// Batch into groups of 30 (Firestore "in" query limit)
		for (let i = 0; i < sharedChildIds.length; i += 30) {
			const batch = sharedChildIds.slice(i, i + 30);
			const sharedQuery = query(
				collection(db, "foodLog"),
				where("childId", "in", batch),
			);
			const snap = await getDocs(sharedQuery);
			snap.docs.forEach((d) => sharedEntries.push({ ...d.data(), id: d.id }));
		}
	}

	// Merge owned and shared, avoiding duplicates
	const allEntries = new Map();
	ownedSnap.docs.forEach((d) =>
		allEntries.set(d.id, { ...d.data(), id: d.id }),
	);
	sharedEntries.forEach((e) => allEntries.set(e.id, e));

	return Array.from(allEntries.values());
}

export async function addFoodEntry(userId, entry) {
	const ref = await addDoc(collection(db, "foodLog"), {
		userId,
		...entry,
	});
	return ref.id;
}

export async function updateFoodEntry(entryId, data) {
	await updateDoc(doc(db, "foodLog", entryId), data);
}

export async function deleteFoodEntry(entryId) {
	await deleteDoc(doc(db, "foodLog", entryId));
}
