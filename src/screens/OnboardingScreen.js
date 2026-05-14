import React, { useState } from "react";
import {
	View,
	Text,
	TextInput,
	TouchableOpacity,
	ScrollView,
	KeyboardAvoidingView,
	Platform,
	Image,
	Alert,
	ActivityIndicator,
	StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { doc, updateDoc, addDoc, collection } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { db, auth } from "../../firebase";
import { useTheme } from "../ThemeContext";
import { DateField } from "../components/DatePickerModal";
import { pickImageAsBase64 } from "../helpers";
import { updateUserProfile } from "../../firebaseHooks";

// ── Step indicator ─────────────────────────────────────────────────────────────

function StepDots({ step }) {
	const { C } = useTheme();
	return (
		<View style={{ flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", marginBottom: 28 }}>
			{[0, 1].map((i) => (
				<View
					key={i}
					style={{
						width: i === step ? 24 : 8,
						height: 8,
						borderRadius: 4,
						backgroundColor: i === step ? C.primaryPurple : C.borderLight,
					}}
				/>
			))}
		</View>
	);
}

// ── Step 1: Name + profile photo ───────────────────────────────────────────────

function StepName({ user, onNext }) {
	const { C } = useTheme();
	const [name, setName]   = useState(user?.displayName || "");
	const [photo, setPhoto] = useState(user?.photoURL   || "");
	const [saving, setSaving] = useState(false);

	const handlePhoto = async () => {
		const uri = await pickImageAsBase64([1, 1]);
		if (uri) setPhoto(uri);
	};

	const handleContinue = async () => {
		const trimmed = name.trim();
		if (!trimmed) {
			Alert.alert("Name required", "Please enter your name to continue.");
			return;
		}
		setSaving(true);
		try {
			const profileData = { name: trimmed };
			if (photo) profileData.photoURL = photo;
			await updateUserProfile(user.uid, profileData);
			// Also update Firebase Auth display name immediately
			try { await updateProfile(auth.currentUser, { displayName: trimmed }); } catch { /* non-fatal */ }
			onNext({ name: trimmed, photo });
		} catch (e) {
			Alert.alert("Error", "Could not save your name. Please try again.");
			console.error(e);
		} finally {
			setSaving(false);
		}
	};

	return (
		<KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
			<ScrollView
				contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 28, paddingBottom: 40 }}
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}>

				{/* Emoji header */}
				<Text style={{ fontSize: 56, textAlign: "center", marginBottom: 8 }}>👋</Text>
				<Text style={[styles.title, { color: C.primaryPinkDark }]}>Welcome to MunchSprouts!</Text>
				<Text style={[styles.subtitle, { color: C.mutedText }]}>
					Let's get your account set up. First, tell us a little about yourself.
				</Text>

				{/* Profile photo picker */}
				<TouchableOpacity onPress={handlePhoto} activeOpacity={0.8} style={{ alignItems: "center", marginBottom: 28 }}>
					<View style={[styles.avatar, { backgroundColor: C.bgPurple, borderColor: photo ? C.primaryPurple : C.borderLight }]}>
						{photo ? (
							<Image source={{ uri: photo }} style={styles.avatarImg} resizeMode="cover" />
						) : (
							<Text style={{ fontSize: 42 }}>🧑</Text>
						)}
					</View>
					<Text style={{ fontSize: 13, color: C.primaryPurple, fontWeight: "700", marginTop: 8 }}>
						{photo ? "Change photo" : "Add a profile photo (optional)"}
					</Text>
				</TouchableOpacity>

				{/* Name input */}
				<Text style={[styles.label, { color: C.mutedText }]}>Your name</Text>
				<TextInput
					value={name}
					onChangeText={(v) => setName(v ? v.charAt(0).toUpperCase() + v.slice(1) : v)}
					placeholder="e.g. Jamie"
					placeholderTextColor={C.mutedText}
					style={[styles.input, { borderColor: C.borderLight, backgroundColor: C.white, color: C.textCharcoal }]}
					autoComplete="name"
					autoCorrect={false}
					returnKeyType="done"
				/>

				{/* CTA */}
				<TouchableOpacity
					onPress={handleContinue}
					disabled={saving}
					style={[styles.btn, { backgroundColor: C.primaryPurple, shadowColor: C.primaryPurple, marginTop: 12 }]}
					activeOpacity={0.85}>
					{saving ? (
						<ActivityIndicator color="#fff" />
					) : (
						<Text style={styles.btnText}>Continue →</Text>
					)}
				</TouchableOpacity>
			</ScrollView>
		</KeyboardAvoidingView>
	);
}

// ── Step 2: Add first child ────────────────────────────────────────────────────

function StepChild({ user, onFinish }) {
	const { C } = useTheme();
	const [name, setName]       = useState("");
	const [dob, setDob]         = useState("");
	const [weanStart, setWean]  = useState("");
	const [photo, setPhoto]     = useState("");
	const [saving, setSaving]   = useState(false);

	const handlePhoto = async () => {
		const uri = await pickImageAsBase64([1, 1]);
		if (uri) setPhoto(uri);
	};

	const handleAdd = async () => {
		if (!name.trim()) {
			Alert.alert("Name required", "Please enter your child's name.");
			return;
		}
		if (!dob) {
			Alert.alert("Date of birth required", "Please select your child's date of birth.");
			return;
		}
		setSaving(true);
		try {
			const childData = {
				userId: user.uid,
				name:   name.trim(),
				dob,
			};
			if (weanStart) childData.weaningStart = weanStart;
			if (photo)     childData.photoUri     = photo;
			await addDoc(collection(db, "children"), childData);
			await updateDoc(doc(db, "users", user.uid), { onboardingComplete: true });
			onFinish();
		} catch (e) {
			Alert.alert("Error", "Could not add your child. Please try again.");
			console.error(e);
		} finally {
			setSaving(false);
		}
	};

	const handleSkip = async () => {
		try {
			await updateDoc(doc(db, "users", user.uid), { onboardingComplete: true });
		} catch { /* non-fatal — Root will re-check onSnapshot */ }
		onFinish();
	};

	return (
		<KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
			<ScrollView
				contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 28, paddingBottom: 40 }}
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}>

				<Text style={{ fontSize: 56, textAlign: "center", marginBottom: 8 }}>🥦</Text>
				<Text style={[styles.title, { color: C.primaryPinkDark }]}>Add your little one</Text>
				<Text style={[styles.subtitle, { color: C.mutedText }]}>
					Set up your child's profile so you can start tracking their food journey straight away.
				</Text>

				{/* Child photo picker */}
				<TouchableOpacity onPress={handlePhoto} activeOpacity={0.8} style={{ alignItems: "center", marginBottom: 24 }}>
					<View style={[styles.avatar, { backgroundColor: C.bgPurple, borderColor: photo ? C.primaryPurple : C.borderLight }]}>
						{photo ? (
							<Image source={{ uri: photo }} style={styles.avatarImg} resizeMode="cover" />
						) : (
							<Text style={{ fontSize: 42 }}>👶</Text>
						)}
					</View>
					<Text style={{ fontSize: 13, color: C.primaryPurple, fontWeight: "700", marginTop: 8 }}>
						{photo ? "Change photo" : "Add a photo (optional)"}
					</Text>
				</TouchableOpacity>

				{/* Child name */}
				<Text style={[styles.label, { color: C.mutedText }]}>Child's name</Text>
				<TextInput
					value={name}
					onChangeText={(v) => setName(v ? v.charAt(0).toUpperCase() + v.slice(1) : v)}
					placeholder="e.g. Eleia"
					placeholderTextColor={C.mutedText}
					style={[styles.input, { borderColor: C.borderLight, backgroundColor: C.white, color: C.textCharcoal, marginBottom: 16 }]}
					autoComplete="off"
					autoCorrect={false}
					returnKeyType="done"
				/>

				{/* Date of birth */}
				<DateField
					label="Date of birth"
					value={dob}
					onChange={setDob}
					minYear={2018}
					maxYear={new Date().getFullYear()}
				/>

				{/* Weaning start date */}
				<View style={{ marginTop: 16 }}>
					<DateField
						label="Weaning start date (optional)"
						value={weanStart}
						onChange={setWean}
						minYear={2018}
						maxYear={new Date().getFullYear() + 1}
					/>
				</View>

				{/* Add child CTA */}
				<TouchableOpacity
					onPress={handleAdd}
					disabled={saving}
					style={[styles.btn, { backgroundColor: C.primaryPurple, shadowColor: C.primaryPurple, marginTop: 24 }]}
					activeOpacity={0.85}>
					{saving ? (
						<ActivityIndicator color="#fff" />
					) : (
						<Text style={styles.btnText}>Add Child & Get Started 🚀</Text>
					)}
				</TouchableOpacity>

				{/* Skip link */}
				<TouchableOpacity onPress={handleSkip} style={{ alignItems: "center", marginTop: 18 }} activeOpacity={0.7}>
					<Text style={{ color: C.mutedText, fontSize: 14, fontWeight: "600" }}>
						I'll add them later →
					</Text>
				</TouchableOpacity>
			</ScrollView>
		</KeyboardAvoidingView>
	);
}

// ── Main OnboardingScreen ──────────────────────────────────────────────────────

export function OnboardingScreen({ user }) {
	const { C } = useTheme();
	const [step, setStep] = useState(0);

	return (
		<SafeAreaView style={{ flex: 1, backgroundColor: C.screen }}>
			{/* Progress dots — shown above each step */}
			<View style={{ paddingTop: 20 }}>
				<StepDots step={step} />
			</View>

			{step === 0 ? (
				<StepName user={user} onNext={() => setStep(1)} />
			) : (
				<StepChild user={user} onFinish={() => {
					// onSnapshot in useAuth will pick up onboardingComplete: true
					// and Root will automatically re-render to MainApp
				}} />
			)}
		</SafeAreaView>
	);
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
	title: {
		fontSize: 26,
		fontWeight: "800",
		textAlign: "center",
		marginBottom: 10,
		letterSpacing: 0.2,
	},
	subtitle: {
		fontSize: 15,
		textAlign: "center",
		lineHeight: 22,
		marginBottom: 32,
		fontWeight: "500",
	},
	label: {
		fontSize: 12,
		fontWeight: "700",
		textTransform: "uppercase",
		letterSpacing: 0.5,
		marginBottom: 6,
	},
	input: {
		borderWidth: 1.5,
		borderRadius: 14,
		paddingHorizontal: 16,
		paddingVertical: 13,
		fontWeight: "600",
		fontSize: 15,
		shadowColor: "#9b7fe8",
		shadowOpacity: 0.08,
		shadowRadius: 6,
		shadowOffset: { width: 0, height: 2 },
		elevation: 2,
	},
	btn: {
		borderRadius: 16,
		paddingVertical: 16,
		alignItems: "center",
		justifyContent: "center",
		shadowOpacity: 0.35,
		shadowRadius: 12,
		shadowOffset: { width: 0, height: 6 },
		elevation: 6,
	},
	btnText: {
		color: "#fff",
		fontWeight: "700",
		fontSize: 16,
		letterSpacing: 0.3,
	},
	avatar: {
		width: 100,
		height: 100,
		borderRadius: 50,
		alignItems: "center",
		justifyContent: "center",
		overflow: "hidden",
		borderWidth: 2.5,
	},
	avatarImg: {
		width: 100,
		height: 100,
	},
});
