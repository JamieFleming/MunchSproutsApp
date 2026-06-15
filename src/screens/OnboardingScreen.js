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
import { db, auth } from "../firebase";
import { useTheme } from "../ThemeContext";
import { DateField } from "../components/DatePickerModal";
import { pickImageAsBase64, uploadChildPhoto, isLocalUri } from "../helpers";
import { updateUserProfile } from "../firebaseHooks";
import Svg, { Circle, Path } from "react-native-svg";
import { Icon } from "../components/Icon";

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

				{/* SVG header illustration */}
				<View style={{ alignItems: "center", marginBottom: 12 }}>
					<Svg width={80} height={80} viewBox="0 0 80 80">
						<Circle cx="40" cy="40" r="38" fill={C.bgPurple} />
						{/* Waving hand path */}
						<Path fill={C.primaryPurple} d="M38 52 Q34 46 30 40 Q28 36 32 34 Q35 32 37 36 L38 38 L38 26 Q38 23 41 23 Q44 23 44 26 L44 36 L44 26 Q44 23 47 23 Q50 23 50 26 L50 34 L50 26 Q50 23 53 23 Q56 23 56 26 L56 36 Q58 33 61 35 Q64 37 62 41 L56 52 Q52 58 46 58 L42 58 Q40 58 38 52 Z" opacity="0.85"/>
						{/* Sparkles */}
						<Path stroke="#f9a825" strokeWidth="1.5" strokeLinecap="round" fill="none" d="M18 22 L18 17 M15 19 L21 19" />
						<Path stroke="#7dcf9e" strokeWidth="1.5" strokeLinecap="round" fill="none" d="M64 20 L64 15 M61 17 L67 17" />
					</Svg>
				</View>
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
							<Icon name="baby" size={38} color={C.mutedText} />
						)}
					</View>
					<Text style={{ fontSize: 13, color: C.primaryPurple, fontFamily: "NunitoSans_700Bold", marginTop: 8 }}>
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
			// Don't store local URI — upload to Storage first
			const docRef = await addDoc(collection(db, "children"), childData);
			if (photo && isLocalUri(photo)) {
				try {
					const url = await uploadChildPhoto(photo, user.uid, docRef.id);
					await updateDoc(docRef, { photoUri: url });
				} catch (uploadErr) {
					console.warn("[onboarding] photo upload failed:", uploadErr.message);
					// Photo is skipped — child is saved without it
				}
			} else if (photo) {
				await updateDoc(docRef, { photoUri: photo });
			}
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

				<View style={{ alignItems: "center", marginBottom: 12 }}>
					<Svg width={80} height={80} viewBox="0 0 80 80">
						<Circle cx="40" cy="40" r="38" fill={C.bgPurple} />
						{/* Stem */}
						<Path stroke="#7dcf9e" strokeWidth="3" strokeLinecap="round" fill="none" d="M40 62 L40 36" />
						{/* Left leaf */}
						<Path stroke="#7dcf9e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="#7dcf9e40" d="M40 48 Q28 44 26 32 Q38 30 40 42 Z" />
						{/* Right leaf */}
						<Path stroke="#7dcf9e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="#7dcf9e40" d="M40 44 Q52 40 54 28 Q42 26 40 38 Z" />
						{/* Soil */}
						<Path stroke={C.primaryPurple} strokeWidth="2.5" strokeLinecap="round" fill={C.primaryPurple + "20"} d="M28 62 Q40 58 52 62 Q50 68 40 69 Q30 68 28 62 Z" />
						<Path stroke="#f9a825" strokeWidth="1.5" strokeLinecap="round" fill="none" d="M20 30 L20 25 M17 27 L23 27" />
						<Path stroke={C.primaryPurple} strokeWidth="1.5" strokeLinecap="round" fill="none" d="M62 36 L62 31 M59 33 L65 33" />
					</Svg>
				</View>
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
							<Icon name="baby" size={38} color={C.mutedText} />
						)}
					</View>
					<Text style={{ fontSize: 13, color: C.primaryPurple, fontFamily: "NunitoSans_700Bold", marginTop: 8 }}>
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
						<Text style={styles.btnText}>Add Child & Get Started</Text>
					)}
				</TouchableOpacity>

				{/* Skip link */}
				<TouchableOpacity onPress={handleSkip} style={{ alignItems: "center", marginTop: 18 }} activeOpacity={0.7}>
					<Text style={{ color: C.mutedText, fontSize: 14, fontFamily: "NunitoSans_600SemiBold" }}>
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
		<SafeAreaView style={{ flex: 1, backgroundColor: C.bgMain }}>
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
		fontFamily: "PlusJakartaSans_700Bold",
		textAlign: "center",
		marginBottom: 10,
		letterSpacing: 0.2,
	},
	subtitle: {
		fontSize: 15,
		textAlign: "center",
		lineHeight: 22,
		marginBottom: 32,
		fontFamily: "NunitoSans_400Regular",
	},
	label: {
		fontSize: 12,
		fontFamily: "NunitoSans_700Bold",
		textTransform: "uppercase",
		letterSpacing: 0.5,
		marginBottom: 6,
	},
	input: {
		borderWidth: 1.5,
		borderRadius: 14,
		paddingHorizontal: 16,
		paddingVertical: 13,
		fontFamily: "NunitoSans_600SemiBold",
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
		fontFamily: "NunitoSans_700Bold",
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
