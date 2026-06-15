import React, { useState, useRef } from "react";
import {
	View, Text, TextInput, TouchableOpacity, Modal,
	ScrollView, KeyboardAvoidingView, Platform,
	ActivityIndicator, Share, Alert,
} from "react-native";
import { useTheme, useStyles } from "../ThemeContext";
import { Icon } from "./Icon";

// ── Avatar helpers ────────────────────────────────────────────────────────────

const AVATAR_PALETTE = ["#7c3aed", "#2a5f8f", "#16a34a", "#c2410c", "#7a2d6a", "#a85a1a", "#0891b2"];

function avatarColor(str = "") {
	let h = 0;
	for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
	return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}
function displayName(email = "") {
	const local = email.split("@")[0] || email;
	return local.charAt(0).toUpperCase() + local.slice(1);
}
function initial(email = "") {
	return (email.split("@")[0] || email || "?").charAt(0).toUpperCase();
}

// ── Role selector ─────────────────────────────────────────────────────────────

const ROLES = [
	{ id: "parent",    label: "Parent",    emoji: "👨‍👩‍👧" },
	{ id: "caregiver", label: "Caregiver", emoji: "🤝" },
];

function RoleSelector({ value, onChange }) {
	const { C } = useTheme();
	return (
		<View style={{ flexDirection: "row", gap: 8 }}>
			{ROLES.map((r) => {
				const active = value === r.id;
				return (
					<TouchableOpacity key={r.id} onPress={() => onChange(r.id)} activeOpacity={0.8}
						style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 11, borderRadius: 14, backgroundColor: active ? C.primaryPurple : C.white, borderWidth: 2, borderColor: active ? C.primaryPurple : C.borderLight }}>
						<Text style={{ fontSize: 16 }}>{r.emoji}</Text>
						<Text style={{ fontSize: 14, fontFamily: "NunitoSans_700Bold", color: active ? "#fff" : C.mutedText }}>{r.label}</Text>
					</TouchableOpacity>
				);
			})}
		</View>
	);
}

// ── Member card ───────────────────────────────────────────────────────────────

const ROLE_STYLES = {
	parent:    { bg: "#ede8f7", color: "#7c3aed", label: "Parent" },
	caregiver: { bg: "#fef0f8", color: "#7a2d6a", label: "Caregiver" },
	owner:     { bg: "#ede8f7", color: "#7c3aed", label: "Parent" },
};

function MemberCard({ email, isYou, role, onRemove }) {
	const { C } = useTheme();
	const color    = avatarColor(email);
	const name     = isYou ? "You" : displayName(email);
	const roleStyle = ROLE_STYLES[role] || ROLE_STYLES.caregiver;

	return (
		<View style={{
			backgroundColor: C.white, borderRadius: 18, padding: 16,
			flexDirection: "row", alignItems: "center", gap: 14,
			shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 10,
			shadowOffset: { width: 0, height: 3 }, elevation: 2,
			marginBottom: 10,
		}}>
			{/* Avatar */}
			<View style={{
				width: 56, height: 56, borderRadius: 28,
				backgroundColor: color + "18",
				borderWidth: 2.5, borderColor: color + "33",
				alignItems: "center", justifyContent: "center",
			}}>
				<Text style={{ fontSize: 22, fontFamily: "PlusJakartaSans_700Bold", color }}>{initial(email)}</Text>
			</View>

			{/* Name + role */}
			<View style={{ flex: 1 }}>
				<Text style={{ fontSize: 16, fontFamily: "NunitoSans_800ExtraBold", color: C.textCharcoal, marginBottom: 2 }}>{name}</Text>
				{!isYou && <Text style={{ fontSize: 12, fontFamily: "NunitoSans_400Regular", color: C.mutedText }}>{email}</Text>}
				<View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 5 }}>
					<View style={{ borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: roleStyle.bg }}>
						<Text style={{ fontSize: 11, fontFamily: "NunitoSans_700Bold", color: roleStyle.color }}>{roleStyle.label}</Text>
					</View>
				</View>
			</View>

			{/* Right side */}
			<View style={{ alignItems: "flex-end", gap: 8 }}>
				<View style={{ backgroundColor: "#dcfce7", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, flexDirection: "row", alignItems: "center", gap: 4 }}>
					<View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#16a34a" }} />
					<Text style={{ fontSize: 11, fontFamily: "NunitoSans_700Bold", color: "#16a34a" }}>Active</Text>
				</View>
				{!!onRemove && (
					<TouchableOpacity
						onPress={onRemove}
						style={{ borderWidth: 1.5, borderColor: "#e0758a", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 }}>
						<Text style={{ fontSize: 11, fontFamily: "NunitoSans_700Bold", color: "#c0392b" }}>Remove</Text>
					</TouchableOpacity>
				)}
			</View>
		</View>
	);
}

// ── 6-box invite code input ───────────────────────────────────────────────────

function CodeInput({ value, onChange, disabled }) {
	const { C } = useTheme();
	const refs  = useRef(Array.from({ length: 6 }, () => React.createRef())).current;
	const chars = value.padEnd(6, " ").split("").slice(0, 6);

	const onKey = (i, char, key) => {
		const arr = value.split("").slice(0, 6);
		while (arr.length < 6) arr.push("");
		if (key === "Backspace") {
			if (arr[i]) { arr[i] = ""; onChange(arr.join("").trimEnd()); }
			else if (i > 0) { arr[i - 1] = ""; refs[i - 1].current?.focus(); onChange(arr.join("").trimEnd()); }
		} else if (char && /[A-Za-z0-9]/.test(char)) {
			arr[i] = char.toUpperCase();
			onChange(arr.join("").trimEnd());
			if (i < 5) refs[i + 1].current?.focus();
		}
	};

	return (
		<View style={{ flexDirection: "row", gap: 8, justifyContent: "center" }}>
			{[0, 1, 2, 3, 4, 5].map((i) => {
				const filled = chars[i]?.trim();
				return (
					<TextInput
						key={i}
						ref={refs[i]}
						value={filled || ""}
						onChangeText={(v) => onKey(i, v.slice(-1), null)}
						onKeyPress={({ nativeEvent }) => nativeEvent.key === "Backspace" && onKey(i, "", "Backspace")}
						maxLength={1}
						autoCapitalize="characters"
						autoCorrect={false}
						editable={!disabled}
						style={{
							width: 44, height: 52, borderRadius: 12, textAlign: "center",
							fontSize: 20, fontFamily: "NunitoSans_800ExtraBold",
							color: filled ? C.primaryPurple : C.mutedText,
							backgroundColor: filled ? "#ede8f7" : C.bgPurple,
							borderWidth: 2,
							borderColor: filled ? C.primaryPurple : C.borderLight,
						}}
					/>
				);
			})}
		</View>
	);
}

// ── Main modal ────────────────────────────────────────────────────────────────

export function FamilySharingModal({
	visible, onClose,
	user, ownedChildren, defaultChildId,
	onManageSharing, onGenerateCode, onJoinViaCode,
}) {
	const { C } = useTheme();
	const s = useStyles();

	const [selectedChildId,  setSelectedChildId]  = useState(null);
	const [shareEmail,       setShareEmail]        = useState("");
	const [inviteRole,       setInviteRole]        = useState("caregiver");
	const [emailLoading,     setEmailLoading]      = useState(false);
	const [generatedCode,    setGeneratedCode]     = useState(null);
	const [codeLoading,      setCodeLoading]       = useState(false);
	const [codeInput,        setCodeInput]         = useState("");
	const [joinLoading,      setJoinLoading]       = useState(false);

	const handleClose = () => {
		onClose();
		setShareEmail("");
		setInviteRole("caregiver");
		setSelectedChildId(null);
		setGeneratedCode(null);
		setCodeInput("");
	};

	const myOwnedChildren = ownedChildren.filter((c) => c.isOwner !== false);
	const childId = selectedChildId || defaultChildId;
	const targetChild = ownedChildren.find((c) => c.id === childId);
	const isOwner = targetChild ? (targetChild.isOwner !== false) : true;
	const sharedWith = targetChild?.sharedWith || [];
	const sharedWithEmails = (targetChild?.sharedWithEmails || []).slice(0, sharedWith.length);

	const handleEmailInvite = async () => {
		if (!shareEmail.trim()) return;
		setEmailLoading(true);
		await onManageSharing(shareEmail.trim(), childId, () => {
			setShareEmail("");
		}, false, inviteRole);
		setEmailLoading(false);
	};

	const handleGenerateCode = async () => {
		setCodeLoading(true);
		try {
			const code = await onGenerateCode(childId, inviteRole);
			setGeneratedCode(code);
		} catch (e) {
			Alert.alert("Error", e.message || "Could not generate code. Please try again.");
		}
		setCodeLoading(false);
	};

	const handleShareCode = () => {
		if (!generatedCode) return;
		const childName = targetChild?.name || "my child";
		Share.share({
			message: `Join me on Munch Sprouts to help track ${childName}'s weaning journey!\n\nUse invite code: ${generatedCode}\n\nCode expires in 24 hours. Download Munch Sprouts, create an account, then go to Profile → Family Sharing and enter the code.`,
		});
	};

	const handleJoin = async () => {
		if (codeInput.trim().length < 6) {
			Alert.alert("Invalid code", "Please enter the full 6-character invite code.");
			return;
		}
		setJoinLoading(true);
		try {
			const result = await onJoinViaCode(codeInput.trim());
			Alert.alert("🎉 Access granted!", `You now have access to ${result.childName}'s data. It will appear next time you open the app.`);
			setCodeInput("");
			handleClose();
		} catch (e) {
			Alert.alert("Couldn't join", e.message || "Please check the code and try again.");
		}
		setJoinLoading(false);
	};

	return (
		<Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
			<View style={{ flex: 1, backgroundColor: C.bgMain }}>

				{/* Header */}
				<View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.borderLight }}>
					<View style={{ flex: 1 }}>
						<Text style={{ fontSize: 20, fontFamily: "PlusJakartaSans_700Bold", color: C.textCharcoal }}>Parents & Caregivers</Text>
						<Text style={{ fontSize: 13, fontFamily: "NunitoSans_400Regular", color: C.mutedText, marginTop: 2 }}>Manage who has access to your child's data</Text>
					</View>
					<TouchableOpacity onPress={handleClose} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.bgPurple, alignItems: "center", justifyContent: "center" }}>
						<Icon name="close" size={16} color={C.mutedText} />
					</TouchableOpacity>
				</View>

				<KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
					<ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, gap: 24, paddingBottom: 48 }}>

						{/* Child selector — show all children including shared ones */}
						{ownedChildren.length > 1 && (
							<View style={{ gap: 10 }}>
								<Text style={{ fontSize: 13, fontFamily: "NunitoSans_800ExtraBold", color: C.textCharcoal, textTransform: "uppercase", letterSpacing: 0.5 }}>Child</Text>
								<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
									{ownedChildren.map((c) => {
										const sel       = (selectedChildId || defaultChildId) === c.id;
										const childOwned = c.isOwner !== false;
										return (
											<TouchableOpacity key={c.id} onPress={() => { setSelectedChildId(c.id); setGeneratedCode(null); }}
												style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, backgroundColor: sel ? C.primaryPurple : C.white, borderWidth: 2, borderColor: sel ? C.primaryPurple : C.borderLight }}>
												<Icon name="baby" size={14} color={sel ? C.white : C.mutedText} />
												<Text style={{ fontSize: 13, fontFamily: "NunitoSans_700Bold", color: sel ? C.white : C.textCharcoal }}>{c.name}</Text>
												{!childOwned && (
													<View style={{ backgroundColor: sel ? "rgba(255,255,255,0.25)" : C.bgPurple, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 }}>
														<Text style={{ fontSize: 9, fontFamily: "NunitoSans_800ExtraBold", color: sel ? C.white : C.mutedText }}>SHARED</Text>
													</View>
												)}
											</TouchableOpacity>
										);
									})}
								</ScrollView>
							</View>
						)}

						{/* Active users */}
						{targetChild && (
							<View style={{ gap: 12 }}>
								<View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
									<Text style={{ fontSize: 13, fontFamily: "NunitoSans_800ExtraBold", color: C.textCharcoal, textTransform: "uppercase", letterSpacing: 0.5 }}>Active users</Text>
									<Text style={{ fontSize: 12, fontFamily: "NunitoSans_400Regular", color: C.mutedText }}>{1 + sharedWith.length} member{sharedWith.length !== 0 ? "s" : ""}</Text>
								</View>

								{/* Your card */}
								<MemberCard
									email={user?.email || ""}
									isYou={true}
									role={isOwner ? "parent" : ((targetChild?.sharedWithRoles || {})[user?.uid] || "caregiver")}
								/>

								{/* Member cards (owner view) */}
								{isOwner && sharedWith.map((uid, i) => {
									const email      = sharedWithEmails[i] || uid;
									const memberRole = (targetChild?.sharedWithRoles || {})[uid] || "caregiver";
									return (
										<MemberCard
											key={uid}
											email={email}
											isYou={false}
											role={memberRole}
											onRemove={() => Alert.alert(
												"Remove member?",
												`Remove ${email}'s access to ${targetChild.name}?`,
												[
													{ text: "Cancel", style: "cancel" },
													{ text: "Remove", style: "destructive", onPress: () => onManageSharing(uid, childId, null, true) },
												],
											)}
										/>
									);
								})}

								{/* Non-owner sees owner */}
								{!isOwner && targetChild.ownerEmail && (
									<MemberCard
										email={targetChild.ownerEmail}
										isYou={false}
										role="parent"
									/>
								)}

								{isOwner && sharedWith.length === 0 && (
									<View style={{ backgroundColor: C.bgPurple, borderRadius: 14, padding: 16, alignItems: "center", gap: 6 }}>
										<Icon name="users" size={24} color={C.mutedText} />
										<Text style={{ fontSize: 13, color: C.mutedText, fontFamily: "NunitoSans_600SemiBold", textAlign: "center" }}>No caregivers yet — invite someone below</Text>
									</View>
								)}
							</View>
						)}

						{/* ── Owner: invite section ── */}
						{isOwner && (
							<>
								{/* Role selector */}
								<View style={{ gap: 10 }}>
									<Text style={{ fontSize: 13, fontFamily: "NunitoSans_800ExtraBold", color: C.textCharcoal, textTransform: "uppercase", letterSpacing: 0.5 }}>Their role</Text>
									<RoleSelector value={inviteRole} onChange={setInviteRole} />
								</View>

								{/* Invite by email */}
								<View style={{ gap: 12 }}>
									<View style={{ gap: 4 }}>
										<Text style={{ fontSize: 13, fontFamily: "NunitoSans_800ExtraBold", color: C.textCharcoal, textTransform: "uppercase", letterSpacing: 0.5 }}>Invite by email</Text>
										<Text style={{ fontSize: 12, fontFamily: "NunitoSans_400Regular", color: C.mutedText }}>They must already have a Munch Sprouts account</Text>
									</View>
									<View style={{ flexDirection: "row", gap: 10 }}>
										<TextInput
											value={shareEmail}
											onChangeText={setShareEmail}
											placeholder="Email address…"
											keyboardType="email-address"
											autoCapitalize="none"
											autoCorrect={false}
											style={[s.input, { flex: 1, backgroundColor: C.white }]}
											placeholderTextColor={C.mutedText}
										/>
										<TouchableOpacity
											onPress={handleEmailInvite}
											disabled={emailLoading || !shareEmail.trim()}
											activeOpacity={0.8}
											style={{ backgroundColor: shareEmail.trim() ? C.primaryPurple : C.borderLight, borderRadius: 14, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", opacity: emailLoading ? 0.7 : 1 }}>
											{emailLoading
												? <ActivityIndicator color="#fff" size="small" />
												: <Text style={{ fontFamily: "NunitoSans_700Bold", fontSize: 14, color: "#fff" }}>Invite</Text>}
										</TouchableOpacity>
									</View>
								</View>

								{/* Divider */}
								<View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
									<View style={{ flex: 1, height: 1, backgroundColor: C.borderLight }} />
									<Text style={{ fontSize: 12, color: C.mutedText, fontFamily: "NunitoSans_600SemiBold" }}>or share an invite code</Text>
									<View style={{ flex: 1, height: 1, backgroundColor: C.borderLight }} />
								</View>

								{/* Generate invite code */}
								<View style={{ gap: 12 }}>
									<View style={{ gap: 4 }}>
										<Text style={{ fontSize: 13, fontFamily: "NunitoSans_800ExtraBold", color: C.textCharcoal, textTransform: "uppercase", letterSpacing: 0.5 }}>Invite code</Text>
										<Text style={{ fontSize: 12, fontFamily: "NunitoSans_400Regular", color: C.mutedText }}>Generate a code to share — no account needed to join</Text>
									</View>

									{generatedCode ? (
										<View style={{ backgroundColor: "#f5f3ff", borderRadius: 18, padding: 20, alignItems: "center", gap: 14, borderWidth: 2, borderColor: "#ede8f7" }}>
											<Text style={{ fontSize: 11, fontFamily: "NunitoSans_800ExtraBold", color: C.primaryPurple, textTransform: "uppercase", letterSpacing: 1.5 }}>Your Invite Code</Text>
											<Text style={{ fontSize: 40, fontFamily: "PlusJakartaSans_700Bold", color: C.primaryPurple, letterSpacing: 10 }}>{generatedCode}</Text>
											<Text style={{ fontSize: 12, color: C.mutedText, textAlign: "center" }}>Expires in 24 hours · Single use</Text>
											<View style={{ flexDirection: "row", gap: 10, width: "100%" }}>
												<TouchableOpacity
													onPress={handleShareCode}
													activeOpacity={0.85}
													style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.primaryPurple, borderRadius: 14, paddingVertical: 13 }}>
													<Icon name="share" size={16} color="#fff" />
													<Text style={{ fontFamily: "NunitoSans_700Bold", fontSize: 14, color: "#fff" }}>Share Code</Text>
												</TouchableOpacity>
												<TouchableOpacity
													onPress={() => setGeneratedCode(null)}
													activeOpacity={0.85}
													style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.bgPurple, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 16 }}>
													<Icon name="refresh" size={16} color={C.mutedText} />
													<Text style={{ fontFamily: "NunitoSans_700Bold", fontSize: 14, color: C.mutedText }}>New</Text>
												</TouchableOpacity>
											</View>
										</View>
									) : (
										<TouchableOpacity
											onPress={handleGenerateCode}
											disabled={codeLoading}
											activeOpacity={0.85}
											style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: C.white, borderRadius: 16, paddingVertical: 16, borderWidth: 2, borderColor: C.borderLight, opacity: codeLoading ? 0.7 : 1 }}>
											{codeLoading
												? <ActivityIndicator color={C.primaryPurple} />
												: <>
													<View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: "#ede8f7", alignItems: "center", justifyContent: "center" }}>
														<Icon name="qr" size={18} color={C.primaryPurple} />
													</View>
													<View>
														<Text style={{ fontFamily: "NunitoSans_700Bold", fontSize: 15, color: C.primaryPurple }}>Generate Invite Code</Text>
														<Text style={{ fontSize: 12, fontFamily: "NunitoSans_400Regular", color: C.mutedText }}>Creates a 6-character code, valid 24 hrs</Text>
													</View>
												</>}
										</TouchableOpacity>
									)}
								</View>
							</>
						)}

						{/* ── Enter invite code (anyone can join another child) ── */}
						<View style={{ gap: 12 }}>
							<View style={{ gap: 4 }}>
								<Text style={{ fontSize: 13, fontFamily: "NunitoSans_800ExtraBold", color: C.textCharcoal, textTransform: "uppercase", letterSpacing: 0.5 }}>Enter invite code</Text>
								<Text style={{ fontSize: 12, fontFamily: "NunitoSans_400Regular", color: C.mutedText }}>Have a code? Enter it below to join as a caregiver</Text>
							</View>

							<View style={{ backgroundColor: C.white, borderRadius: 18, padding: 20, gap: 16, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 }}>
								<CodeInput value={codeInput} onChange={setCodeInput} disabled={joinLoading} />

								<TouchableOpacity
									onPress={handleJoin}
									disabled={joinLoading || codeInput.trim().length < 6}
									activeOpacity={0.85}
									style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: codeInput.trim().length === 6 ? C.primaryPurple : C.borderLight, borderRadius: 14, paddingVertical: 15, opacity: joinLoading ? 0.7 : 1 }}>
									{joinLoading
										? <ActivityIndicator color="#fff" />
										: <>
											<Icon name="users" size={17} color="#fff" />
											<Text style={{ fontFamily: "NunitoSans_700Bold", fontSize: 15, color: "#fff" }}>Join as Caregiver</Text>
										</>}
								</TouchableOpacity>
							</View>
						</View>

					</ScrollView>
				</KeyboardAvoidingView>
			</View>
		</Modal>
	);
}
