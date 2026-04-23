import React, { useState } from "react";
import {
	View,
	Text,
	TextInput,
	TouchableOpacity,
	StyleSheet,
	KeyboardAvoidingView,
	Platform,
	Alert,
	ScrollView,
	ActivityIndicator,
} from "react-native";
import { signIn, signUp, sendPasswordReset } from "./firebaseHooks";

const C = {
	bgMain: "#fdf5e2",
	bgPurple: "#ede8f7",
	bgGreen: "#e8f7ee",
	bgWarning: "#fff4e5",
	primaryPurple: "#9b7fe8",
	secondaryPurple: "#c4b0f0",
	primaryPinkDark: "#5a2d7a",
	textCharcoal: "#3d3d3d",
	warningStroke: "#e07b39",
	white: "#ffffff",
	border: "#d9d0f0",
	borderLight: "#ece8f9",
	mutedText: "#8a7aaa",
};

export default function AuthScreen() {
	// mode: "signin" | "signup" | "forgot"
	const [mode, setMode] = useState("signin");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [loading, setLoading] = useState(false);

	const handleSignIn = async () => {
		if (!email.trim() || !password.trim()) {
			Alert.alert("Missing Fields", "Please enter your email and password.");
			return;
		}
		setLoading(true);
		try {
			await signIn(email.trim(), password);
		} catch (e) {
			const messages = {
				"auth/user-not-found": "No account found with that email.",
				"auth/wrong-password": "Incorrect password.",
				"auth/invalid-credential": "Incorrect email or password.",
				"auth/invalid-email": "Please enter a valid email address.",
				"auth/too-many-requests": "Too many attempts. Please try again later.",
				"auth/network-request-failed": "No internet connection.",
			};
			Alert.alert("Error", messages[e.code] || e.message);
		}
		setLoading(false);
	};

	const handleSignUp = async () => {
		if (!email.trim() || !password.trim()) {
			Alert.alert("Missing Fields", "Please enter your email and password.");
			return;
		}
		if (password !== confirm) {
			Alert.alert("Password Mismatch", "Passwords do not match.");
			return;
		}
		if (password.length < 6) {
			Alert.alert("Weak Password", "Password must be at least 6 characters.");
			return;
		}
		setLoading(true);
		try {
			await signUp(email.trim(), password);
		} catch (e) {
			const messages = {
				"auth/email-already-in-use":
					"An account with that email already exists.",
				"auth/invalid-email": "Please enter a valid email address.",
				"auth/weak-password": "Password must be at least 6 characters.",
				"auth/network-request-failed": "No internet connection.",
			};
			Alert.alert("Error", messages[e.code] || e.message);
		}
		setLoading(false);
	};

	const handleForgotPassword = async () => {
		if (!email.trim()) {
			Alert.alert("Email Required", "Please enter your email address above.");
			return;
		}
		setLoading(true);
		try {
			await sendPasswordReset(email.trim());
			Alert.alert(
				"Email Sent",
				`A password reset link has been sent to ${email.trim()}. Check your inbox and spam folder.`,
				[{ text: "Back to Sign In", onPress: () => setMode("signin") }],
			);
		} catch (e) {
			const messages = {
				"auth/user-not-found": "No account found with that email.",
				"auth/invalid-email": "Please enter a valid email address.",
				"auth/network-request-failed": "No internet connection.",
			};
			Alert.alert("Error", messages[e.code] || e.message);
		}
		setLoading(false);
	};

	// ── Forgot Password screen ──
	if (mode === "forgot") {
		return (
			<KeyboardAvoidingView
				behavior={Platform.OS === "ios" ? "padding" : "height"}
				style={styles.container}>
				<ScrollView
					contentContainerStyle={styles.scroll}
					keyboardShouldPersistTaps="handled"
					showsVerticalScrollIndicator={false}>
					<View style={styles.logoArea}>
						<Text style={styles.logoText}>🌱</Text>
						<Text style={styles.appName}>Munch Sprouts</Text>
						<Text style={styles.tagline}>Reset Your Password</Text>
					</View>
					<View style={styles.card}>
						<Text style={styles.cardTitle}>Forgot Password</Text>
						<Text style={styles.cardSubtitle}>
							Enter your email address and we'll send you a link to reset your
							password.
						</Text>
						<View style={styles.fieldGroup}>
							<Text style={styles.label}>Email Address</Text>
							<TextInput
								value={email}
								onChangeText={setEmail}
								placeholder="you@example.com"
								keyboardType="email-address"
								autoCapitalize="none"
								autoCorrect={false}
								style={styles.input}
								placeholderTextColor={C.mutedText}
							/>
						</View>
						<TouchableOpacity
							onPress={handleForgotPassword}
							disabled={loading}
							style={[styles.btnPrimary, loading && { opacity: 0.6 }]}
							activeOpacity={0.8}>
							{loading ? (
								<ActivityIndicator color={C.white} />
							) : (
								<Text style={styles.btnPrimaryText}>Send Reset Email</Text>
							)}
						</TouchableOpacity>
						<TouchableOpacity
							onPress={() => setMode("signin")}
							style={styles.toggleBtn}>
							<Text style={styles.toggleText}>
								<Text style={styles.toggleTextBold}>← Back to Sign In</Text>
							</Text>
						</TouchableOpacity>
					</View>
				</ScrollView>
			</KeyboardAvoidingView>
		);
	}

	// ── Sign In / Sign Up screen ──
	return (
		<KeyboardAvoidingView
			behavior={Platform.OS === "ios" ? "padding" : "height"}
			style={styles.container}>
			<ScrollView
				contentContainerStyle={styles.scroll}
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}>
				<View style={styles.logoArea}>
					<Text style={styles.logoText}>🌱</Text>
					<Text style={styles.appName}>Munch Sprouts</Text>
					<Text style={styles.tagline}>Baby Led Weaning Tracker</Text>
				</View>
				<View style={styles.card}>
					<Text style={styles.cardTitle}>
						{mode === "signin" ? "Welcome back" : "Create your account"}
					</Text>
					<Text style={styles.cardSubtitle}>
						{mode === "signin"
							? "Sign in to sync your data across all devices"
							: "Free account — track unlimited foods and children"}
					</Text>
					<View style={styles.fieldGroup}>
						<Text style={styles.label}>Email Address</Text>
						<TextInput
							value={email}
							onChangeText={setEmail}
							placeholder="you@example.com"
							keyboardType="email-address"
							autoCapitalize="none"
							autoCorrect={false}
							style={styles.input}
							placeholderTextColor={C.mutedText}
						/>
					</View>
					<View style={styles.fieldGroup}>
						<Text style={styles.label}>Password</Text>
						<TextInput
							value={password}
							onChangeText={setPassword}
							placeholder={
								mode === "signup" ? "At least 6 characters" : "Your password"
							}
							secureTextEntry
							style={styles.input}
							placeholderTextColor={C.mutedText}
						/>
					</View>
					{mode === "signup" && (
						<View style={styles.fieldGroup}>
							<Text style={styles.label}>Confirm Password</Text>
							<TextInput
								value={confirm}
								onChangeText={setConfirm}
								placeholder="Repeat your password"
								secureTextEntry
								style={styles.input}
								placeholderTextColor={C.mutedText}
							/>
						</View>
					)}
					{/* Forgot password link — only on sign in */}
					{mode === "signin" && (
						<TouchableOpacity
							onPress={() => setMode("forgot")}
							style={{ alignSelf: "flex-end", marginTop: -4, marginBottom: 4 }}>
							<Text
								style={{
									fontSize: 13,
									color: C.primaryPurple,
									fontWeight: "700",
								}}>
								Forgot password?
							</Text>
						</TouchableOpacity>
					)}
					<TouchableOpacity
						onPress={mode === "signin" ? handleSignIn : handleSignUp}
						disabled={loading}
						style={[styles.btnPrimary, loading && { opacity: 0.6 }]}
						activeOpacity={0.8}>
						{loading ? (
							<ActivityIndicator color={C.white} />
						) : (
							<Text style={styles.btnPrimaryText}>
								{mode === "signin" ? "Sign In" : "Create Account"}
							</Text>
						)}
					</TouchableOpacity>
					<TouchableOpacity
						onPress={() => {
							setMode((m) => (m === "signin" ? "signup" : "signin"));
							setPassword("");
							setConfirm("");
						}}
						style={styles.toggleBtn}>
						<Text style={styles.toggleText}>
							{mode === "signin"
								? "Don't have an account? "
								: "Already have an account? "}
							<Text style={styles.toggleTextBold}>
								{mode === "signin" ? "Sign up free" : "Sign in"}
							</Text>
						</Text>
					</TouchableOpacity>
				</View>
				<View style={styles.proBadge}>
					<Text style={styles.proBadgeText}>
						🔒 Pro accounts unlock all BLW recipes — £4.99
					</Text>
				</View>
				<Text style={styles.footer}>
					Your data is stored securely and privately.{"\n"}
					Sign in on any device to access your logs.
				</Text>
			</ScrollView>
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: C.bgMain },
	scroll: {
		flexGrow: 1,
		justifyContent: "center",
		paddingHorizontal: 24,
		paddingVertical: 40,
		gap: 20,
	},
	logoArea: { alignItems: "center", gap: 6, marginBottom: 8 },
	logoText: { fontSize: 56 },
	appName: {
		fontSize: 28,
		fontWeight: "700",
		color: C.primaryPinkDark,
		textTransform: "uppercase",
		letterSpacing: 1,
	},
	tagline: { fontSize: 14, color: C.mutedText, fontWeight: "600" },
	card: {
		backgroundColor: C.white,
		borderRadius: 20,
		padding: 24,
		borderWidth: 2,
		borderColor: C.borderLight,
		shadowColor: "#9b7fe8",
		shadowOpacity: 0.1,
		shadowRadius: 12,
		shadowOffset: { width: 0, height: 4 },
		elevation: 4,
		gap: 16,
	},
	cardTitle: {
		fontSize: 20,
		fontWeight: "700",
		color: C.primaryPinkDark,
		textTransform: "uppercase",
		letterSpacing: 0.5,
	},
	cardSubtitle: {
		fontSize: 13,
		color: C.mutedText,
		lineHeight: 20,
		marginTop: -8,
	},
	fieldGroup: { gap: 6 },
	label: {
		fontSize: 11,
		fontWeight: "700",
		color: C.mutedText,
		textTransform: "uppercase",
		letterSpacing: 0.7,
	},
	input: {
		borderWidth: 2,
		borderColor: C.border,
		borderRadius: 12,
		paddingHorizontal: 14,
		paddingVertical: 12,
		backgroundColor: C.bgMain,
		color: C.textCharcoal,
		fontWeight: "600",
		fontSize: 15,
	},
	btnPrimary: {
		backgroundColor: C.primaryPurple,
		borderRadius: 12,
		paddingVertical: 15,
		alignItems: "center",
		justifyContent: "center",
		marginTop: 4,
		shadowColor: C.primaryPurple,
		shadowOpacity: 0.35,
		shadowRadius: 8,
		shadowOffset: { width: 0, height: 4 },
		elevation: 4,
	},
	btnPrimaryText: {
		color: C.white,
		fontWeight: "700",
		fontSize: 14,
		textTransform: "uppercase",
		letterSpacing: 0.6,
	},
	toggleBtn: { alignItems: "center", paddingVertical: 4 },
	toggleText: { fontSize: 13, color: C.mutedText },
	toggleTextBold: { color: C.primaryPurple, fontWeight: "700" },
	proBadge: {
		backgroundColor: C.bgWarning,
		borderColor: C.warningStroke,
		borderWidth: 1.5,
		borderRadius: 12,
		paddingVertical: 10,
		paddingHorizontal: 16,
		alignItems: "center",
	},
	proBadgeText: { fontSize: 13, fontWeight: "700", color: C.warningStroke },
	footer: {
		textAlign: "center",
		fontSize: 12,
		color: C.mutedText,
		lineHeight: 18,
	},
});
