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
	Linking,
} from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import Constants from "expo-constants";
import { signIn, signUp, sendPasswordReset, signInWithGoogle, signInWithApple } from "../firebaseHooks";
// expo-apple-authentication and expo-crypto are loaded dynamically so the app
// doesn't crash on binaries that don't have the native modules compiled in yet.
import { GOOGLE_WEB_CLIENT_ID, GOOGLE_IOS_CLIENT_ID, GOOGLE_ANDROID_CLIENT_ID } from "../firebase";

WebBrowser.maybeCompleteAuthSession();

const LEGAL_URLS = {
	privacy: "https://munchsprouts.co.uk/privacy-policy",
	terms:   "https://munchsprouts.co.uk/terms-of-use",
};

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
	bgMain:          "#fbf7ef",
	bgPurple:        "#f0ecfc",
	primaryPurple:   "#9b7fe8",
	primaryPinkDark: "#2e2440",
	textCharcoal:    "#2e2440",
	mutedText:       "#8a7aaa",
	white:           "#ffffff",
	border:          "#ede8fb",
	borderLight:     "#ede8fb",
	secondaryPurple: "#c4b0f0",
	warningStroke:   "#e07b39",
	bgGreen:         "#e8f7ee",
	bgWarning:       "#fff4e5",
};

function EyeIcon({ visible }) {
	const stroke = C.mutedText;
	const p = { stroke, strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" };
	if (visible) {
		return (
			<Svg width={20} height={20} viewBox="0 0 24 24">
				<Path {...p} d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
				<Circle {...p} cx="12" cy="12" r="3" />
			</Svg>
		);
	}
	return (
		<Svg width={20} height={20} viewBox="0 0 24 24">
			<Path {...p} d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
			<Path {...p} d="M1 1l22 22" />
		</Svg>
	);
}

export default function AuthScreen() {
	// mode: "signin" | "signup" | "forgot"
	const [mode, setMode] = useState("signin");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [loading, setLoading] = useState(false);
	const [googleLoading, setGoogleLoading] = useState(false);
	const [appleLoading,   setAppleLoading]   = useState(false);
	const [appleAvailable, setAppleAvailable] = useState(false);
	const [AppleAuth,      setAppleAuth]      = useState(null);
	const [showPassword, setShowPassword] = useState(false);

	// ── Apple Sign-In — load native module lazily so the app doesn't crash on
	//    binaries that don't have expo-apple-authentication compiled in yet ──
	useEffect(() => {
		if (Platform.OS !== "ios") return;
		import("expo-apple-authentication")
			.then((mod) =>
				mod.isAvailableAsync()
					.then((available) => { if (available) { setAppleAuth(mod); setAppleAvailable(true); } })
					.catch(() => {}),
			)
			.catch(() => {});
	}, []);

	const handleAppleSignIn = async () => {
		if (!AppleAuth) return;
		try {
			setAppleLoading(true);

			const rawNonce = Array.from({ length: 32 }, () =>
				Math.floor(Math.random() * 36).toString(36)).join("");

			// Load expo-crypto dynamically — same reason as above
			const hashedNonce = await import("expo-crypto").then((Crypto) =>
				Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce),
			);

			const credential = await AppleAuth.signInAsync({
				requestedScopes: [
					AppleAuth.AppleAuthenticationScope.FULL_NAME,
					AppleAuth.AppleAuthenticationScope.EMAIL,
				],
				nonce: hashedNonce,
			});

			await signInWithApple(
				credential.identityToken,
				rawNonce,
				credential.fullName,
				credential.email,
			);
		} catch (e) {
			if (e.code !== "ERR_REQUEST_CANCELED") {
				Alert.alert("Apple Sign-In Failed", e.message || "Could not sign in with Apple.");
			}
		} finally {
			setAppleLoading(false);
		}
	};
	const [showConfirm, setShowConfirm] = useState(false);


	// ── Google OAuth via expo-auth-session ──
	const [request, response, promptAsync] = Google.useAuthRequest({
		webClientId:     GOOGLE_WEB_CLIENT_ID,
		iosClientId:     GOOGLE_IOS_CLIENT_ID,
		androidClientId: GOOGLE_ANDROID_CLIENT_ID,
		redirectUri,
		scopes: ["openid", "profile", "email"],
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

	// Password rules — evaluated live as the user types
	const passwordChecks = {
		length:    password.length >= 8,
		uppercase: /[A-Z]/.test(password),
		lowercase: /[a-z]/.test(password),
		number:    /[0-9]/.test(password),
		special:   /[^A-Za-z0-9]/.test(password),
	};
	const allChecksPassed = Object.values(passwordChecks).every(Boolean);

	const handleSignUp = async () => {
		if (!email.trim() || !password.trim()) {
			Alert.alert("Missing Fields", "Please enter your email and password.");
			return;
		}
		if (!allChecksPassed) {
			const failed = [
				!passwordChecks.length    && "• At least 8 characters",
				!passwordChecks.uppercase && "• One uppercase letter (A–Z)",
				!passwordChecks.lowercase && "• One lowercase letter (a–z)",
				!passwordChecks.number    && "• One number (0–9)",
				!passwordChecks.special   && "• One special character (e.g. !@#$%)",
			].filter(Boolean).join("\n");
			Alert.alert(
				"Password doesn't meet requirements",
				`Please fix the following:\n\n${failed}`,
			);
			return;
		}
		if (password !== confirm) {
			Alert.alert("Password Mismatch", "Passwords do not match.");
			return;
		}
		setLoading(true);
		try {
			await signUp(email.trim(), password);
		} catch (e) {
			if (e.code === "auth/weak-password") {
				// Show the same specific breakdown as the client-side check
				const failed = [
					!passwordChecks.length    && "• At least 8 characters",
					!passwordChecks.uppercase && "• One uppercase letter (A–Z)",
					!passwordChecks.lowercase && "• One lowercase letter (a–z)",
					!passwordChecks.number    && "• One number (0–9)",
					!passwordChecks.special   && "• One special character (e.g. !@#$%)",
				].filter(Boolean);
				Alert.alert(
					"Password doesn't meet requirements",
					failed.length > 0
						? `Your password needs:\n\n${failed.join("\n")}`
						: "Please choose a stronger password.",
				);
			} else {
				const messages = {
					"auth/email-already-in-use":   "An account with that email already exists.",
					"auth/invalid-email":           "Please enter a valid email address.",
					"auth/network-request-failed":  "No internet connection.",
				};
				Alert.alert("Error", messages[e.code] || e.message);
			}
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
					<View style={{ alignItems: "center", marginBottom: 32 }}>
						<Svg width={64} height={64} viewBox="0 0 64 64">
							<Circle cx="32" cy="32" r="30" fill={C.bgPurple} />
							<Path stroke="#7dcf9e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" d="M32 52 L32 28" />
							<Path stroke="#7dcf9e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="#7dcf9e30" d="M32 40 Q20 36 18 24 Q30 22 32 34 Z" />
							<Path stroke="#7dcf9e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="#7dcf9e30" d="M32 36 Q44 32 46 20 Q34 18 32 30 Z" />
						</Svg>
						<Text style={{ fontFamily: "PlusJakartaSans_700Bold", fontSize: 26, color: C.primaryPinkDark, marginTop: 12, letterSpacing: 0.3 }}>MunchSprouts</Text>
						<Text style={{ fontFamily: "NunitoSans_400Regular", fontSize: 14, color: C.mutedText, marginTop: 4 }}>Reset Your Password</Text>
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
				<View style={{ alignItems: "center", marginBottom: 32 }}>
					<Svg width={64} height={64} viewBox="0 0 64 64">
						<Circle cx="32" cy="32" r="30" fill={C.bgPurple} />
						<Path stroke="#7dcf9e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" d="M32 52 L32 28" />
						<Path stroke="#7dcf9e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="#7dcf9e30" d="M32 40 Q20 36 18 24 Q30 22 32 34 Z" />
						<Path stroke="#7dcf9e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="#7dcf9e30" d="M32 36 Q44 32 46 20 Q34 18 32 30 Z" />
					</Svg>
					<Text style={{ fontFamily: "PlusJakartaSans_700Bold", fontSize: 26, color: C.primaryPinkDark, marginTop: 12, letterSpacing: 0.3 }}>MunchSprouts</Text>
					<Text style={{ fontFamily: "NunitoSans_400Regular", fontSize: 14, color: C.mutedText, marginTop: 4 }}>Your baby's food journey</Text>
				</View>
				<View style={styles.card}>
					<View style={{ flexDirection: "row", backgroundColor: C.bgPurple, borderRadius: 12, padding: 4, marginBottom: 24 }}>
						{["Sign In", "Sign Up"].map((label, i) => {
							const active = (i === 0 && mode === "signin") || (i === 1 && mode === "signup");
							return (
								<TouchableOpacity key={label} onPress={() => setMode(i === 0 ? "signin" : "signup")}
									style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: active ? C.white : "transparent", alignItems: "center",
										shadowColor: active ? "#2e2440" : "transparent", shadowOpacity: active ? 0.08 : 0, shadowRadius: 6, elevation: active ? 2 : 0 }}>
									<Text style={{ fontFamily: "NunitoSans_700Bold", fontSize: 14, color: active ? C.primaryPinkDark : C.mutedText }}>{label}</Text>
								</TouchableOpacity>
							);
						})}
					</View>
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
						<View style={styles.inputWrapper}>
							<TextInput
								value={password}
								onChangeText={setPassword}
								placeholder={
									mode === "signup" ? "Create a strong password" : "Your password"
								}
								secureTextEntry={!showPassword}
								style={[styles.input, styles.inputWithEye]}
								placeholderTextColor={C.mutedText}
							/>
							<TouchableOpacity
								onPress={() => setShowPassword((v) => !v)}
								style={styles.eyeBtn}
								hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
								activeOpacity={0.6}>
								<EyeIcon visible={showPassword} />
							</TouchableOpacity>
						</View>
					</View>

					{/* Live password requirements — only shown during sign-up */}
					{mode === "signup" && password.length > 0 && (
						<View style={styles.passwordRules}>
							{[
								{ key: "length",    label: "At least 8 characters" },
								{ key: "uppercase", label: "One uppercase letter (A–Z)" },
								{ key: "lowercase", label: "One lowercase letter (a–z)" },
								{ key: "number",    label: "One number (0–9)" },
								{ key: "special",   label: "One special character (!@#$%…)" },
							].map(({ key, label }) => {
								const passed = passwordChecks[key];
								return (
									<View key={key} style={styles.passwordRuleRow}>
										<Text style={[styles.passwordRuleDot, { color: passed ? "#2ecc71" : C.warningStroke }]}>
											{passed ? "✓" : "✗"}
										</Text>
										<Text style={[styles.passwordRuleText, { color: passed ? "#2ecc71" : C.mutedText }]}>
											{label}
										</Text>
									</View>
								);
							})}
						</View>
					)}

					{mode === "signup" && (
						<View style={styles.fieldGroup}>
							<Text style={styles.label}>Confirm Password</Text>
							<View style={styles.inputWrapper}>
								<TextInput
									value={confirm}
									onChangeText={setConfirm}
									placeholder="Repeat your password"
									secureTextEntry={!showConfirm}
									style={[styles.input, styles.inputWithEye]}
									placeholderTextColor={C.mutedText}
								/>
								<TouchableOpacity
									onPress={() => setShowConfirm((v) => !v)}
									style={styles.eyeBtn}
									hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
									activeOpacity={0.6}>
									<EyeIcon visible={showConfirm} />
								</TouchableOpacity>
							</View>
						</View>
					)}
					{/* Forgot password link — only on sign in */}
					{mode === "signin" && (
						<TouchableOpacity
							onPress={() => setMode("forgot")}
							style={{ alignSelf: "flex-end", marginTop: -4, marginBottom: 4 }}>
							<Text
								style={{
									fontFamily: "NunitoSans_600SemiBold",
									fontSize: 13,
									color: C.primaryPurple,
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
					<View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 18 }}>
						<View style={{ flex: 1, height: 1, backgroundColor: C.borderLight }} />
						<Text style={{ fontFamily: "NunitoSans_600SemiBold", fontSize: 12, color: C.mutedText }}>or</Text>
						<View style={{ flex: 1, height: 1, backgroundColor: C.borderLight }} />
					</View>

					{/* ── Google Sign-In ── */}
					<TouchableOpacity
						onPress={() => promptAsync()}
						disabled={isExpoGo || !request || googleLoading}
						style={[{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
							backgroundColor: C.white, borderRadius: 16, paddingVertical: 14,
							borderWidth: 1.5, borderColor: C.borderLight }, (isExpoGo || !request || googleLoading) && { opacity: 0.5 }]}
						activeOpacity={0.85}>
						{googleLoading ? (
							<ActivityIndicator color={C.textCharcoal} />
						) : (
							<>
								<GoogleLogo size={20} />
								<Text style={{ fontFamily: "NunitoSans_700Bold", fontSize: 14, color: C.textCharcoal }}>
									{isExpoGo ? "Google Sign-In (not available in Expo Go)" : "Sign in with Google"}
								</Text>
							</>
						)}
					</TouchableOpacity>

					{/* ── Apple Sign-In (iOS only, only when native module is available) ── */}
					{Platform.OS === "ios" && appleAvailable && AppleAuth && (
						<AppleAuth.AppleAuthenticationButton
							buttonType={mode === "signup"
								? AppleAuth.AppleAuthenticationButtonType.SIGN_UP
								: AppleAuth.AppleAuthenticationButtonType.SIGN_IN}
							buttonStyle={AppleAuth.AppleAuthenticationButtonStyle.BLACK}
							cornerRadius={14}
							style={styles.btnApple}
							onPress={handleAppleSignIn}
						/>
					)}

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
					<Text style={styles.proBadgeTitle}>🌟 Unlock Pro</Text>
					<Text style={styles.proBadgeSubtitle}>All recipes · Milestones · Multi-child</Text>
					<View style={styles.proPricingRow}>
						<View style={styles.proPricingItem}>
							<Text style={styles.proPricingAmount}>£2.99</Text>
							<Text style={styles.proPricingLabel}>/ month</Text>
						</View>
						<View style={styles.proPricingDivider} />
						<View style={styles.proPricingItem}>
							<Text style={styles.proPricingAmount}>£19.99</Text>
							<Text style={styles.proPricingLabel}>/ year</Text>
						</View>
						<View style={styles.proPricingDivider} />
						<View style={styles.proPricingItem}>
							<Text style={styles.proPricingAmount}>£39.99</Text>
							<Text style={styles.proPricingLabel}>lifetime</Text>
						</View>
					</View>
				</View>
				<Text style={styles.footer}>
					Your data is stored securely and privately.{"\n"}
					Sign in on any device to access your logs.
				</Text>
				<View style={{ flexDirection: "row", justifyContent: "center", gap: 16, marginTop: 4 }}>
					<TouchableOpacity onPress={() => Linking.openURL(LEGAL_URLS.privacy)}>
						<Text style={{ fontFamily: "NunitoSans_600SemiBold", fontSize: 11, color: C.primaryPurple }}>Privacy Policy</Text>
					</TouchableOpacity>
					<Text style={{ fontFamily: "NunitoSans_400Regular", fontSize: 11, color: C.mutedText }}>·</Text>
					<TouchableOpacity onPress={() => Linking.openURL(LEGAL_URLS.terms)}>
						<Text style={{ fontFamily: "NunitoSans_600SemiBold", fontSize: 11, color: C.primaryPurple }}>Terms of Use</Text>
					</TouchableOpacity>
				</View>
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
		fontFamily: "PlusJakartaSans_700Bold",
		fontSize: 26,
		color: C.primaryPinkDark,
		letterSpacing: 0.3,
		marginTop: 12,
	},
	tagline: { fontFamily: "NunitoSans_400Regular", fontSize: 14, color: C.mutedText, marginTop: 4 },
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
		fontFamily: "PlusJakartaSans_700Bold",
		fontSize: 20,
		color: C.primaryPinkDark,
		letterSpacing: 0.3,
	},
	cardSubtitle: {
		fontFamily: "NunitoSans_400Regular",
		fontSize: 13,
		color: C.mutedText,
		lineHeight: 20,
		marginTop: -8,
	},
	fieldGroup: { gap: 6 },
	label: {
		fontFamily: "NunitoSans_700Bold",
		fontSize: 11,
		color: C.mutedText,
		textTransform: "uppercase",
		letterSpacing: 0.7,
	},
	input: {
		borderWidth: 1.5,
		borderColor: C.borderLight,
		borderRadius: 16,
		paddingHorizontal: 16,
		paddingVertical: 13,
		backgroundColor: C.white,
		color: C.textCharcoal,
		fontFamily: "NunitoSans_600SemiBold",
		fontSize: 15,
	},
	inputWrapper: {
		position: "relative",
		justifyContent: "center",
	},
	inputWithEye: {
		paddingRight: 46,
	},
	eyeBtn: {
		position: "absolute",
		right: 14,
		top: 0,
		bottom: 0,
		justifyContent: "center",
	},
	btnPrimary: {
		backgroundColor: C.primaryPurple,
		borderRadius: 18,
		paddingVertical: 15,
		alignItems: "center",
		justifyContent: "center",
		marginTop: 4,
		shadowColor: C.primaryPurple,
		shadowOpacity: 0.35,
		shadowRadius: 10,
		shadowOffset: { width: 0, height: 5 },
		elevation: 5,
	},
	btnPrimaryText: {
		color: "#fff",
		fontFamily: "NunitoSans_700Bold",
		fontSize: 15,
		letterSpacing: 0.3,
	},
	toggleBtn: { alignItems: "center", paddingVertical: 4 },
	toggleText: { fontFamily: "NunitoSans_400Regular", fontSize: 13, color: C.mutedText },
	toggleTextBold: { fontFamily: "NunitoSans_700Bold", color: C.primaryPurple },
	btnApple: {
		width: "100%",
		height: 50,
		borderRadius: 14,
	},
	passwordRules: {
		backgroundColor: "#f9f7ff",
		borderRadius: 10,
		padding: 12,
		gap: 6,
		borderWidth: 1,
		borderColor: C.borderLight,
	},
	passwordRuleRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	passwordRuleDot: {
		fontFamily: "NunitoSans_700Bold",
		fontSize: 13,
		width: 16,
		textAlign: "center",
	},
	passwordRuleText: {
		fontFamily: "NunitoSans_600SemiBold",
		fontSize: 12,
	},
	proBadge: {
		backgroundColor: C.bgWarning,
		borderColor: C.warningStroke,
		borderWidth: 1.5,
		borderRadius: 16,
		paddingVertical: 14,
		paddingHorizontal: 16,
		alignItems: "center",
		gap: 6,
	},
	proBadgeTitle: {
		fontFamily: "PlusJakartaSans_700Bold",
		fontSize: 15,
		color: C.warningStroke,
	},
	proBadgeSubtitle: {
		fontFamily: "NunitoSans_600SemiBold",
		fontSize: 12,
		color: C.warningStroke,
		opacity: 0.8,
	},
	proPricingRow: {
		flexDirection: "row",
		alignItems: "center",
		marginTop: 4,
		gap: 0,
	},
	proPricingItem: {
		flex: 1,
		alignItems: "center",
	},
	proPricingDivider: {
		width: 1,
		height: 28,
		backgroundColor: C.warningStroke,
		opacity: 0.25,
	},
	proPricingAmount: {
		fontFamily: "PlusJakartaSans_700Bold",
		fontSize: 15,
		color: C.warningStroke,
	},
	proPricingLabel: {
		fontFamily: "NunitoSans_600SemiBold",
		fontSize: 11,
		color: C.warningStroke,
		opacity: 0.75,
	},
	footer: {
		fontFamily: "NunitoSans_400Regular",
		textAlign: "center",
		fontSize: 12,
		color: C.mutedText,
		lineHeight: 18,
	},
});
