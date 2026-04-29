import React, { useState, useEffect } from "react";
import {
	View,
	Text,
	Image,
	TextInput,
	TouchableOpacity,
	StyleSheet,
	KeyboardAvoidingView,
	Platform,
	Alert,
	ScrollView,
	ActivityIndicator,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import Constants from "expo-constants";
import { signIn, signUp, sendPasswordReset, signInWithGoogle } from "./firebaseHooks";
import { GOOGLE_WEB_CLIENT_ID, GOOGLE_IOS_CLIENT_ID, GOOGLE_ANDROID_CLIENT_ID } from "./firebase";

WebBrowser.maybeCompleteAuthSession();

// "storeClient" = running inside Expo Go
const isExpoGo = Constants.executionEnvironment === "storeClient";

// Each platform needs its own reverse-client-ID scheme as the redirect URI.
// Expo Go can't register native schemes, so it uses the (now-deprecated) proxy as a fallback.
const ANDROID_REDIRECT = "com.googleusercontent.apps.406023036087-71leqh6hjhigatatn3akjsvf3ml97eir:/";
const IOS_REDIRECT     = "com.googleusercontent.apps.406023036087-4ci5jet3el9aqgnuetadrocdp3d3s2jr:/";

const redirectUri = isExpoGo
	? "https://auth.expo.io/@fleming1411/MunchSproutsNative"
	: Platform.OS === "android"
		? ANDROID_REDIRECT
		: IOS_REDIRECT;

// Google "G" logo in official colours
function GoogleLogo({ size = 20 }) {
	return (
		<Svg width={size} height={size} viewBox="0 0 48 48">
			<Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
			<Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
			<Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
			<Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
			<Path fill="none" d="M0 0h48v48H0z"/>
		</Svg>
	);
}

const C = {
	// bgMain: "#fdf5e2",
	bgMain: "#fff",
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
	const [googleLoading, setGoogleLoading] = useState(false);

	// ── Google OAuth via expo-auth-session ──
	const [request, response, promptAsync] = Google.useAuthRequest({
		webClientId: GOOGLE_WEB_CLIENT_ID,
		iosClientId: GOOGLE_IOS_CLIENT_ID,
		androidClientId: GOOGLE_ANDROID_CLIENT_ID,
		redirectUri,
	});

	useEffect(() => {
		if (response?.type === "success") {
			const idToken = response.authentication?.idToken;
			if (idToken) {
				setGoogleLoading(true);
				signInWithGoogle(idToken)
					.catch((e) => Alert.alert("Google Sign-In Failed", e.message || "Could not sign in with Google."))
					.finally(() => setGoogleLoading(false));
			} else {
				Alert.alert("Google Sign-In Failed", "No ID token received. Please try again.");
			}
		} else if (response?.type === "error") {
			Alert.alert("Google Sign-In Failed", response.error?.message || "Authentication error.");
		}
	}, [response]);

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
						{/* <Text style={styles.logoText}>🌱</Text> */}
						<Image
							source={require("./assets/logo.png")}
							style={{ width: 100, height: 100, borderRadius: 10 }}
							resizeMode="contain"
						/>
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
					{/* <Text style={styles.logoText}>🌱</Text> */}
					<Image
						source={require("./assets/logo.png")}
						style={{ width: 100, height: 100, borderRadius: 10 }}
						resizeMode="contain"
					/>
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

					{/* ── Divider ── */}
					<View style={styles.dividerRow}>
						<View style={styles.dividerLine} />
						<Text style={styles.dividerText}>or continue with</Text>
						<View style={styles.dividerLine} />
					</View>

					{/* ── Google Sign-In ── */}
					<TouchableOpacity
						onPress={() => promptAsync()}
						disabled={isExpoGo || !request || googleLoading}
						style={[styles.btnGoogle, (isExpoGo || !request || googleLoading) && { opacity: 0.5 }]}
						activeOpacity={0.85}>
						{googleLoading ? (
							<ActivityIndicator color={C.textCharcoal} />
						) : (
							<>
								<GoogleLogo size={20} />
								<Text style={styles.btnGoogleText}>
									{isExpoGo ? "Google Sign-In (not available in Expo Go)" : "Sign in with Google"}
								</Text>
							</>
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
	dividerRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
	},
	dividerLine: {
		flex: 1,
		height: 1,
		backgroundColor: C.borderLight,
	},
	dividerText: {
		fontSize: 12,
		color: C.mutedText,
		fontWeight: "600",
	},
	btnGoogle: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 12,
		backgroundColor: C.white,
		borderWidth: 2,
		borderColor: C.border,
		borderRadius: 12,
		paddingVertical: 14,
		shadowColor: "#000",
		shadowOpacity: 0.06,
		shadowRadius: 6,
		shadowOffset: { width: 0, height: 2 },
		elevation: 2,
	},
	btnGoogleText: {
		fontSize: 14,
		fontWeight: "700",
		color: C.textCharcoal,
	},
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
