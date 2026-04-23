import { useState, useEffect } from "react";
import {
	createUserWithEmailAndPassword,
	signInWithEmailAndPassword,
	signOut,
	onAuthStateChanged,
	sendPasswordResetEmail,
	deleteUser,
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

// ─── AUTH STATE ───────────────────────────────────────────────────────────────
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

	return { user, userDoc, loading, isPro: userDoc?.plan === "pro" };
}

// ─── SIGN UP ──────────────────────────────────────────────────────────────────
export async function signUp(email, password) {
	const cred = await createUserWithEmailAndPassword(auth, email, password);
	await setDoc(doc(db, "users", cred.user.uid), {
		email,
		plan: "free",
		createdAt: serverTimestamp(),
	});
	return cred.user;
}

// ─── ACCOUNT DELETION ─────────────────────────────────────────────────────────
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

// ─── PASSWORD RESET ───────────────────────────────────────────────────────────
export async function sendPasswordReset(email) {
	await sendPasswordResetEmail(auth, email);
}

// ─── SIGN IN ──────────────────────────────────────────────────────────────────
export async function signIn(email, password) {
	const cred = await signInWithEmailAndPassword(auth, email, password);
	return cred.user;
}

// ─── SIGN OUT ─────────────────────────────────────────────────────────────────
export async function logOut() {
	await signOut(auth);
}

// ─── CHILDREN ─────────────────────────────────────────────────────────────────
export async function fetchChildren(userId) {
	const q = query(collection(db, "children"), where("userId", "==", userId));
	const snap = await getDocs(q);
	return snap.docs.map((d) => {
		const data = d.data();
		return { ...data, id: d.id }; // id: d.id LAST so it overwrites any stored id field
	});
}

export async function addChild(userId, child) {
	const ref = await addDoc(collection(db, "children"), { userId, ...child });
	return ref.id;
}

export async function updateChild(childId, data) {
	await updateDoc(doc(db, "children", childId), data);
}

export async function deleteChild(childId, userId) {
	// Delete the child document first
	await deleteDoc(doc(db, "children", childId));

	// Query food log by userId (which rules allow) then delete matching childId entries
	try {
		const q = query(
			collection(db, "foodLog"),
			where("userId", "==", userId),
			where("childId", "==", childId),
		);
		const snap = await getDocs(q);
		console.log("Food entries found to delete:", snap.docs.length);
		await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
		console.log("Food log cleaned up successfully");
	} catch (e) {
		console.warn("Could not delete food log entries:", e.message);
	}
}

// ─── FOOD LOG ─────────────────────────────────────────────────────────────────
export async function fetchFoodLog(userId) {
	const q = query(collection(db, "foodLog"), where("userId", "==", userId));
	const snap = await getDocs(q);
	return snap.docs.map((d) => {
		const data = d.data();
		return { ...data, id: d.id }; // same fix
	});
}

export async function addFoodEntry(userId, entry) {
	const ref = await addDoc(collection(db, "foodLog"), { userId, ...entry });
	return ref.id;
}

export async function updateFoodEntry(entryId, data) {
	await updateDoc(doc(db, "foodLog", entryId), data);
}

export async function deleteFoodEntry(entryId) {
	await deleteDoc(doc(db, "foodLog", entryId));
}
