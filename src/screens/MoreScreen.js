import React, { useState, useEffect } from "react";
import {
	View,
	Text,
	TextInput,
	TouchableOpacity,
	ScrollView,
	Modal,
	KeyboardAvoidingView,
	Platform,
	Alert,
	ActivityIndicator,
	Image,
} from "react-native";
import {
	updatePassword,
	EmailAuthProvider,
	reauthenticateWithCredential,
} from "firebase/auth";
import { auth } from "../../firebase";
import { useTheme, useStyles } from "../ThemeContext";
import { Icon } from "../components/Icon";
import { PickerModal } from "../components/PickerModal";
import { pickImageAsBase64 } from "../helpers";

export function MoreScreen({
	user,
	isPro,
	ownedChildren,
	defaultChildId,
	onLogout,
	onDeleteAccount,
	onUpgradePro,
	onRestorePurchases,
	onManageSharing,
}) {
	const { C, theme, setTheme } = useTheme();
	const s = useStyles();
	const [showChangePassword, setShowChangePassword] = useState(false);
	const [currentPw, setCurrentPw] = useState("");
	const [newPw, setNewPw] = useState("");
	const [confirmPw, setConfirmPw] = useState("");
	const [pwLoading, setPwLoading] = useState(false);
	const [upgradeLoading, setUpgradeLoading] = useState(false);
	const [showSharing, setShowSharing] = useState(false);
	const [shareEmail, setShareEmail] = useState("");
	const [shareLoading, setShareLoading] = useState(false);
	const [selectedChildId, setSelectedChildId] = useState(null);
	const [showSupport, setShowSupport] = useState(false);
	const [supportType, setSupportType] = useState("");
	const [supportMessage, setSupportMessage] = useState("");
	const [supportSent, setSupportSent] = useState(false);
	const [showSupportTypePicker, setShowSupportTypePicker] = useState(false);
	const [profilePhoto, setProfilePhoto] = useState("");

	// Load profile photo from userDoc on mount
	useEffect(() => {
		if (user?.uid) {
			import("firebase/firestore").then(({ doc: fsDoc, getDoc: fsGetDoc }) =>
				import("../../firebase").then(({ db: firedb }) =>
					fsGetDoc(fsDoc(firedb, "users", user.uid)).then((snap) => {
						if (snap.exists() && snap.data().photoURL) {
							setProfilePhoto(snap.data().photoURL);
						}
					}),
				),
			);
		}
	}, [user?.uid]);

	const handlePickProfilePhoto = async () => {
		const uri = await pickImageAsBase64([1, 1]);
		if (!uri) return;
		setProfilePhoto(uri);
		try {
			const { updateUserProfile } = await import("../../firebaseHooks");
			await updateUserProfile(user.uid, { photoURL: uri });
		} catch (e) {
			Alert.alert("Error", "Could not save photo.");
		}
	};

	const handleRemoveProfilePhoto = async () => {
		setProfilePhoto("");
		try {
			const { updateUserProfile } = await import("../../firebaseHooks");
			await updateUserProfile(user.uid, { photoURL: "" });
		} catch (e) {
			console.warn("Could not remove photo");
		}
	};

	const handleChangePassword = async () => {
		if (!currentPw || !newPw || !confirmPw) {
			Alert.alert("Missing Fields", "Please fill in all fields.");
			return;
		}
		if (newPw !== confirmPw) {
			Alert.alert("Mismatch", "New passwords do not match.");
			return;
		}
		if (newPw.length < 6) {
			Alert.alert("Too Short", "Password must be at least 6 characters.");
			return;
		}
		setPwLoading(true);
		try {
			const credential = EmailAuthProvider.credential(user.email, currentPw);
			await reauthenticateWithCredential(auth.currentUser, credential);
			await updatePassword(auth.currentUser, newPw);
			Alert.alert("Success", "Password updated successfully.");
			setCurrentPw("");
			setNewPw("");
			setConfirmPw("");
			setShowChangePassword(false);
		} catch (e) {
			const msgs = {
				"auth/wrong-password": "Current password is incorrect.",
				"auth/invalid-credential": "Current password is incorrect.",
				"auth/too-many-requests": "Too many attempts. Try again later.",
			};
			Alert.alert("Error", msgs[e.code] || e.message);
		}
		setPwLoading(false);
	};

	const MoreRow = ({ icon, iconBg, label, sublabel, onPress, color, right }) => (
		<TouchableOpacity
			onPress={onPress}
			style={{
				flexDirection: "row",
				alignItems: "center",
				gap: 14,
				padding: 16,
				backgroundColor: C.white,
				borderRadius: 16,
				marginBottom: 10,
				shadowColor: "#000",
				shadowOpacity: 0.04,
				shadowRadius: 6,
				elevation: 1,
			}}
			activeOpacity={0.8}>
			<View
				style={{
					width: 42,
					height: 42,
					borderRadius: 13,
					backgroundColor: iconBg || C.bgPurple,
					alignItems: "center",
					justifyContent: "center",
				}}>
				<Icon name={icon} size={20} color={color || C.primaryPurple} />
			</View>
			<View style={{ flex: 1 }}>
				<Text style={{ fontWeight: "700", fontSize: 15, color: color || C.textCharcoal }}>
					{label}
				</Text>
				{sublabel && (
					<Text style={{ fontSize: 12, color: C.mutedText, marginTop: 2 }}>{sublabel}</Text>
				)}
			</View>
			{right !== undefined ? right : <Icon name="chevRight" size={16} color={C.mutedText} />}
		</TouchableOpacity>
	);

	return (
		<ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
			{/* Account card */}
			<View style={[s.card, { marginBottom: 20, flexDirection: "row", alignItems: "center", gap: 14 }]}>
				<View style={{ alignItems: "center", gap: 4 }}>
					<TouchableOpacity onPress={handlePickProfilePhoto} activeOpacity={0.8}>
						<View
							style={{
								width: 60,
								height: 60,
								borderRadius: 30,
								backgroundColor: C.primaryPurple,
								alignItems: "center",
								justifyContent: "center",
								overflow: "hidden",
							}}>
							{profilePhoto ? (
								<Image source={{ uri: profilePhoto }} style={{ width: 60, height: 60 }} resizeMode="cover" />
							) : (
								<Icon name="user" size={26} color="#ffffff" />
							)}
						</View>
						<View
							style={{
								position: "absolute",
								bottom: 0,
								right: 0,
								width: 20,
								height: 20,
								borderRadius: 10,
								backgroundColor: C.primaryPurple,
								alignItems: "center",
								justifyContent: "center",
								borderWidth: 2,
								borderColor: C.white,
							}}>
							<Icon name="Camera" size={10} color="#ffffff" />
						</View>
					</TouchableOpacity>
					{profilePhoto ? (
						<TouchableOpacity onPress={handleRemoveProfilePhoto}>
							<Text style={{ fontSize: 10, color: "#c0392b", fontWeight: "700" }}>Remove</Text>
						</TouchableOpacity>
					) : null}
				</View>
				<View style={{ flex: 1 }}>
					<Text style={{ fontWeight: "700", fontSize: 15, color: C.primaryPinkDark }}>{user.email}</Text>
					<View style={{ marginTop: 4 }}>
						{isPro ? (
							<View
								style={{
									backgroundColor: C.statGreenBg,
									borderRadius: 999,
									paddingHorizontal: 10,
									paddingVertical: 3,
									alignSelf: "flex-start",
								}}>
								<Text style={{ fontSize: 11, fontWeight: "700", color: C.statGreenText }}>PRO ACCOUNT</Text>
							</View>
						) : (
							<View
								style={{
									backgroundColor: C.bgPurple,
									borderRadius: 999,
									paddingHorizontal: 10,
									paddingVertical: 3,
									alignSelf: "flex-start",
								}}>
								<Text style={{ fontSize: 11, fontWeight: "700", color: C.mutedText }}>FREE ACCOUNT</Text>
							</View>
						)}
					</View>
				</View>
			</View>

			{/* Upgrade card — free only */}
			{!isPro && (
				<View
					style={{
						backgroundColor: "#2d1f5e",
						borderRadius: 20,
						padding: 20,
						marginBottom: 20,
						overflow: "hidden",
					}}>
					<View
						style={{
							position: "absolute",
							top: -20,
							right: -20,
							width: 100,
							height: 100,
							borderRadius: 50,
							backgroundColor: "rgba(155,127,232,0.2)",
						}}
					/>
					<View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
						<View
							style={{
								backgroundColor: C.warningStroke,
								borderRadius: 10,
								width: 34,
								height: 34,
								alignItems: "center",
								justifyContent: "center",
							}}>
							<Icon name="crown" size={17} color={C.white} />
						</View>
						<Text style={{ fontWeight: "800", fontSize: 16, color: C.white }}>
							Upgrade to Pro · £4.99
						</Text>
					</View>
					<Text
						style={{
							fontSize: 13,
							color: "rgba(255,255,255,0.8)",
							marginBottom: 14,
							lineHeight: 20,
						}}>
						Unlock all BLW recipes, age-group filters, nutritionist-approved meal ideas, and more features
						coming soon.
					</Text>
					<TouchableOpacity
						onPress={() => {
							setUpgradeLoading(true);
							onUpgradePro && onUpgradePro().finally(() => setUpgradeLoading(false));
						}}
						disabled={upgradeLoading}
						style={{
							backgroundColor: C.warningStroke,
							borderRadius: 12,
							paddingVertical: 12,
							alignItems: "center",
							justifyContent: "center",
							flexDirection: "row",
							gap: 8,
							opacity: upgradeLoading ? 0.7 : 1,
						}}
						activeOpacity={0.85}>
						{upgradeLoading ? (
							<ActivityIndicator color={C.white} />
						) : (
							<>
								<Icon name="crown" size={15} color={C.white} />
								<Text style={{ color: C.white, fontWeight: "700", fontSize: 14 }}>Upgrade for £4.99</Text>
							</>
						)}
					</TouchableOpacity>
					<TouchableOpacity onPress={onRestorePurchases} style={{ alignItems: "center", paddingTop: 10 }}>
						<Text style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", fontWeight: "600" }}>
							Restore previous purchase
						</Text>
					</TouchableOpacity>
				</View>
			)}

			{/* Appearance */}
			<Text style={[s.smallLabel, { paddingLeft: 4, marginBottom: 10, marginTop: 6 }]}>Appearance</Text>
			<View
				style={{
					backgroundColor: C.white,
					borderRadius: 16,
					padding: 16,
					marginBottom: 10,
					shadowColor: "#000",
					shadowOpacity: 0.04,
					shadowRadius: 6,
					elevation: 1,
				}}>
				<Text style={{ fontWeight: "700", fontSize: 14, color: C.textCharcoal, marginBottom: 12 }}>
					Colour Theme
				</Text>
				{[
					{ id: "default", label: "Default", sublabel: "Purple & white", dot: "#9b7fe8" },
					{ id: "accessible", label: "Accessibility", sublabel: "High contrast colours", dot: "#5000cc" },
				].map((t) => (
					<TouchableOpacity
						key={t.id}
						onPress={() => setTheme(t.id)}
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: 14,
							padding: 12,
							backgroundColor: theme === t.id ? C.bgPurple : "transparent",
							borderRadius: 12,
							marginBottom: 4,
							borderWidth: 1.5,
							borderColor: theme === t.id ? C.primaryPurple : "transparent",
						}}
						activeOpacity={0.8}>
						<View
							style={{
								width: 36,
								height: 36,
								borderRadius: 18,
								backgroundColor: t.dot,
								alignItems: "center",
								justifyContent: "center",
								shadowColor: t.dot,
								shadowOpacity: 0.4,
								shadowRadius: 4,
								elevation: 2,
							}}>
							{theme === t.id && <Icon name="check" size={16} color="#ffffff" />}
						</View>
						<View style={{ flex: 1 }}>
							<Text
								style={{
									fontWeight: "700",
									fontSize: 14,
									color: theme === t.id ? C.primaryPurple : C.textCharcoal,
								}}>
								{t.label}
							</Text>
							<Text style={{ fontSize: 12, color: C.mutedText, marginTop: 2 }}>{t.sublabel}</Text>
						</View>
						{theme === t.id && (
							<View
								style={{
									backgroundColor: C.primaryPurple,
									borderRadius: 999,
									paddingHorizontal: 8,
									paddingVertical: 3,
								}}>
								<Text style={{ fontSize: 10, fontWeight: "700", color: "#ffffff" }}>Active</Text>
							</View>
						)}
					</TouchableOpacity>
				))}
			</View>

			{/* Account */}
			<Text style={[s.smallLabel, { paddingLeft: 4, marginBottom: 10 }]}>Account</Text>
			<MoreRow
				icon="key"
				iconBg="#e8f0ff"
				label="Change Password"
				sublabel="Update your account password"
				onPress={() => setShowChangePassword(true)}
			/>
			<MoreRow
				icon="logout"
				iconBg={C.statRedBg}
				label="Sign Out"
				sublabel="Sign out of your account"
				color="#c0392b"
				onPress={onLogout}
				right={<View />}
			/>

			{/* Family Sharing */}
			<Text style={[s.smallLabel, { paddingLeft: 4, marginBottom: 10, marginTop: 10 }]}>Family Sharing</Text>
			{isPro ? (
				<TouchableOpacity
					onPress={() => setShowSharing(true)}
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: 14,
						padding: 16,
						backgroundColor: C.white,
						borderRadius: 16,
						marginBottom: 10,
						shadowColor: "#000",
						shadowOpacity: 0.04,
						shadowRadius: 6,
						elevation: 1,
					}}
					activeOpacity={0.8}>
					<View
						style={{
							width: 42,
							height: 42,
							borderRadius: 13,
							backgroundColor: C.statBlueBg,
							alignItems: "center",
							justifyContent: "center",
						}}>
						<Icon name="users" size={20} color="#2a5f8f" />
					</View>
					<View style={{ flex: 1 }}>
						<Text style={{ fontWeight: "700", fontSize: 15, color: C.textCharcoal }}>Share with Family</Text>
						<Text style={{ fontSize: 12, color: C.mutedText, marginTop: 2 }}>
							Invite a partner or caregiver by email
						</Text>
					</View>
					<Icon name="chevRight" size={16} color={C.mutedText} />
				</TouchableOpacity>
			) : (
				<TouchableOpacity
					onPress={onUpgradePro}
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: 14,
						padding: 16,
						backgroundColor: C.white,
						borderRadius: 16,
						marginBottom: 10,
						opacity: 0.7,
						shadowColor: "#000",
						shadowOpacity: 0.04,
						shadowRadius: 6,
						elevation: 1,
					}}
					activeOpacity={0.8}>
					<View
						style={{
							width: 42,
							height: 42,
							borderRadius: 13,
							backgroundColor: C.bgPurple,
							alignItems: "center",
							justifyContent: "center",
						}}>
						<Icon name="lock" size={20} color={C.mutedText} />
					</View>
					<View style={{ flex: 1 }}>
						<Text style={{ fontWeight: "700", fontSize: 15, color: C.mutedText }}>Share with Family</Text>
						<Text style={{ fontSize: 12, color: C.mutedText, marginTop: 2 }}>
							Pro feature — upgrade to unlock
						</Text>
					</View>
					<View
						style={{
							backgroundColor: C.warningStroke,
							borderRadius: 999,
							paddingHorizontal: 8,
							paddingVertical: 3,
						}}>
						<Text style={{ fontSize: 10, fontWeight: "700", color: C.white }}>PRO</Text>
					</View>
				</TouchableOpacity>
			)}

			{/* Family Sharing Modal */}
			<Modal
				visible={showSharing}
				transparent
				animationType="slide"
				onRequestClose={() => setShowSharing(false)}>
				<KeyboardAvoidingView
					behavior={Platform.OS === "ios" ? "padding" : "height"}
					style={s.modalOverlay}>
					<View style={s.modalSheet}>
						<View
							style={{
								flexDirection: "row",
								justifyContent: "space-between",
								alignItems: "center",
								marginBottom: 20,
							}}>
							<Text style={s.modalTitle}>Share with Family</Text>
							<TouchableOpacity
								onPress={() => {
									setShowSharing(false);
									setShareEmail("");
									setSelectedChildId(null);
								}}
								style={{ backgroundColor: C.bgPurple, borderRadius: 10, padding: 8 }}>
								<Icon name="close" size={16} color={C.mutedText} />
							</TouchableOpacity>
						</View>

						{ownedChildren.filter((c) => c.isOwner !== false && c.isOwner !== undefined).length > 1 && (
							<View style={{ marginBottom: 16 }}>
								<Text style={s.label}>Select Child to Share</Text>
								{ownedChildren
									.filter((c) => c.isOwner !== false && c.isOwner !== undefined)
									.map((c) => (
										<TouchableOpacity
											key={c.id}
											onPress={() => setSelectedChildId(c.id)}
											style={{
												flexDirection: "row",
												alignItems: "center",
												gap: 10,
												padding: 12,
												backgroundColor: selectedChildId === c.id ? C.bgPurple : C.white,
												borderRadius: 12,
												borderWidth: 2,
												borderColor: selectedChildId === c.id ? C.primaryPurple : C.borderLight,
												marginBottom: 8,
											}}>
											<Icon
												name="baby"
												size={16}
												color={selectedChildId === c.id ? C.primaryPurple : C.mutedText}
											/>
											<Text
												style={{
													fontWeight: "700",
													fontSize: 14,
													color: selectedChildId === c.id ? C.primaryPurple : C.textCharcoal,
												}}>
												{c.name}
											</Text>
											{selectedChildId === c.id && (
												<Icon name="check" size={14} color={C.primaryPurple} />
											)}
										</TouchableOpacity>
									))}
							</View>
						)}

						<View style={{ backgroundColor: C.bgPurple, borderRadius: 12, padding: 14, marginBottom: 16 }}>
							<Text style={{ fontSize: 13, color: C.primaryPinkDark, lineHeight: 20 }}>
								Enter the email address of the person you want to share with. They must already have a
								Munch Sprouts account. They will be able to view and add food log entries for the
								selected child.
							</Text>
						</View>

						<View style={{ marginBottom: 16 }}>
							<Text style={s.label}>Their Email Address</Text>
							<TextInput
								value={shareEmail}
								onChangeText={setShareEmail}
								placeholder="partner@example.com"
								keyboardType="email-address"
								autoCapitalize="none"
								autoCorrect={false}
								style={[s.input, { backgroundColor: C.white }]}
								placeholderTextColor={C.mutedText}
							/>
						</View>

						<TouchableOpacity
							onPress={() =>
								onManageSharing(shareEmail.trim(), selectedChildId || defaultChildId, () => {
									setShowSharing(false);
									setShareEmail("");
									setSelectedChildId(null);
								})
							}
							disabled={shareLoading || !shareEmail.trim()}
							style={[s.btnPrimary, (shareLoading || !shareEmail.trim()) && { opacity: 0.5 }]}
							activeOpacity={0.8}>
							{shareLoading ? (
								<ActivityIndicator color={C.white} />
							) : (
								<Text style={s.btnPrimaryText}>Send Invite</Text>
							)}
						</TouchableOpacity>

						{/* Family Group */}
						{(() => {
							const targetChild = ownedChildren.find(
								(c) => c.id === (selectedChildId || defaultChildId),
							);
							if (!targetChild) return null;
							const isOwner = targetChild.isOwner !== false;
							const sharedWith = targetChild?.sharedWith || [];
							const sharedWithEmails = (targetChild?.sharedWithEmails || []).slice(0, sharedWith.length);

							const familyRows = isOwner
								? sharedWith.map((uid, i) => ({
										uid,
										email: sharedWithEmails[i] || uid,
										role: "Shared with",
										canRemove: true,
									}))
								: [
										{
											uid: targetChild.userId,
											email: targetChild.ownerEmail || "Account owner",
											role: "Owner",
											canRemove: false,
										},
										...sharedWith
											.filter((uid) => uid !== user.uid)
											.map((uid) => ({
												uid,
												email: sharedWithEmails[sharedWith.indexOf(uid)] || uid,
												role: "Also shared with",
												canRemove: false,
											})),
									];

							if (familyRows.length === 0) return null;

							return (
								<View style={{ marginTop: 20 }}>
									<Text style={[s.smallLabel, { marginBottom: 10 }]}>Family Group</Text>
									{familyRows.map((row) => (
										<View
											key={row.uid}
											style={{
												flexDirection: "row",
												alignItems: "center",
												justifyContent: "space-between",
												padding: 12,
												backgroundColor: row.role === "Owner" ? C.bgPurple : C.bgGreen,
												borderRadius: 12,
												marginBottom: 6,
											}}>
											<View
												style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
												<Icon
													name={row.role === "Owner" ? "crown" : "user"}
													size={16}
													color={row.role === "Owner" ? C.primaryPurple : C.primaryGreen}
												/>
												<View style={{ flex: 1 }}>
													<Text
														style={{
															fontSize: 10,
															fontWeight: "700",
															color: C.mutedText,
															textTransform: "uppercase",
															letterSpacing: 0.5,
														}}>
														{row.role}
													</Text>
													<Text
														style={{
															fontSize: 13,
															fontWeight: "700",
															color:
																row.role === "Owner" ? C.primaryPurple : C.statGreenText,
														}}
														numberOfLines={1}>
														{row.email}
													</Text>
												</View>
											</View>
											{row.canRemove && (
												<TouchableOpacity
													onPress={() =>
														onManageSharing(
															row.uid,
															selectedChildId || defaultChildId,
															null,
															true,
														)
													}>
													<Text style={{ fontSize: 12, color: "#c0392b", fontWeight: "700" }}>
														Remove
													</Text>
												</TouchableOpacity>
											)}
										</View>
									))}
								</View>
							);
						})()}
					</View>
				</KeyboardAvoidingView>
			</Modal>

			{/* Customer Support */}
			<Text style={[s.smallLabel, { paddingLeft: 4, marginBottom: 10, marginTop: 10 }]}>Support</Text>
			<TouchableOpacity
				onPress={() => setShowSupport(true)}
				style={{
					flexDirection: "row",
					alignItems: "center",
					gap: 14,
					padding: 16,
					backgroundColor: C.white,
					borderRadius: 16,
					marginBottom: 10,
					shadowColor: "#000",
					shadowOpacity: 0.04,
					shadowRadius: 6,
					elevation: 1,
				}}
				activeOpacity={0.8}>
				<View
					style={{
						width: 42,
						height: 42,
						borderRadius: 13,
						backgroundColor: C.statBlueBg,
						alignItems: "center",
						justifyContent: "center",
					}}>
					<Icon name="info" size={20} color="#2a5f8f" />
				</View>
				<View style={{ flex: 1 }}>
					<Text style={{ fontWeight: "700", fontSize: 15, color: C.textCharcoal }}>Contact Support</Text>
					<Text style={{ fontSize: 12, color: C.mutedText, marginTop: 2 }}>
						Get help, report bugs or request features
					</Text>
				</View>
				<Icon name="chevRight" size={16} color={C.mutedText} />
			</TouchableOpacity>

			{/* Support Modal */}
			<Modal
				visible={showSupport}
				transparent
				animationType="slide"
				onRequestClose={() => setShowSupport(false)}>
				<KeyboardAvoidingView
					behavior={Platform.OS === "ios" ? "padding" : "height"}
					style={s.modalOverlay}>
					<View style={[s.modalSheet, { maxHeight: "90%" }]}>
						<View
							style={{
								flexDirection: "row",
								justifyContent: "space-between",
								alignItems: "center",
								marginBottom: 20,
							}}>
							<Text style={s.modalTitle}>Contact Support</Text>
							<TouchableOpacity
								onPress={() => {
									setShowSupport(false);
									setSupportType("");
									setSupportMessage("");
									setSupportSent(false);
								}}
								style={{ backgroundColor: C.bgPurple, borderRadius: 10, padding: 8 }}>
								<Icon name="close" size={16} color={C.mutedText} />
							</TouchableOpacity>
						</View>

						{supportSent ? (
							<View style={{ alignItems: "center", paddingVertical: 30 }}>
								<View
									style={{
										width: 64,
										height: 64,
										borderRadius: 32,
										backgroundColor: C.statGreenBg,
										alignItems: "center",
										justifyContent: "center",
										marginBottom: 16,
									}}>
									<Icon name="check" size={28} color={C.statGreenText} />
								</View>
								<Text
									style={{
										fontWeight: "700",
										fontSize: 18,
										color: C.primaryPinkDark,
										marginBottom: 8,
									}}>
									Message Sent!
								</Text>
								<Text
									style={{ fontSize: 14, color: C.mutedText, textAlign: "center", lineHeight: 22 }}>
									{"We'll get back to you at\n"}
									{user.email}
								</Text>
								<TouchableOpacity
									onPress={() => {
										setShowSupport(false);
										setSupportType("");
										setSupportMessage("");
										setSupportSent(false);
									}}
									style={[s.btnPrimary, { marginTop: 24 }]}>
									<Text style={s.btnPrimaryText}>Done</Text>
								</TouchableOpacity>
							</View>
						) : (
							<ScrollView showsVerticalScrollIndicator={false}>
								<View style={{ gap: 16, paddingBottom: 20 }}>
									<View>
										<Text style={s.label}>What can we help with?</Text>
										<TouchableOpacity
											onPress={() => setShowSupportTypePicker(true)}
											style={[
												s.input,
												{
													flexDirection: "row",
													justifyContent: "space-between",
													alignItems: "center",
													backgroundColor: C.white,
												},
											]}>
											<Text
												style={{
													color: supportType ? C.textCharcoal : C.mutedText,
													fontWeight: "600",
												}}>
												{supportType || "Select a category…"}
											</Text>
											<Icon name="chevDown" size={14} color={C.mutedText} />
										</TouchableOpacity>
									</View>
									<View>
										<Text style={s.label}>Your Message</Text>
										<TextInput
											value={supportMessage}
											onChangeText={setSupportMessage}
											placeholder="Describe your issue or request in detail…"
											multiline
											numberOfLines={5}
											style={[s.input, { height: 120, textAlignVertical: "top", backgroundColor: C.white }]}
											placeholderTextColor={C.mutedText}
											autoComplete="off"
										/>
									</View>
									<View style={{ backgroundColor: C.bgPurple, borderRadius: 12, padding: 14 }}>
										<Text style={[s.smallLabel, { marginBottom: 4 }]}>Reply will be sent to</Text>
										<Text style={{ fontSize: 14, fontWeight: "700", color: C.primaryPinkDark }}>
											{user.email}
										</Text>
									</View>
									<TouchableOpacity
										onPress={async () => {
											if (!supportType) {
												Alert.alert(
													"Select a category",
													"Please choose what you need help with.",
												);
												return;
											}
											if (!supportMessage.trim()) {
												Alert.alert("Add a message", "Please describe your issue or request.");
												return;
											}
											try {
												const {
													addDoc,
													collection: col,
													serverTimestamp: sts,
												} = await import("firebase/firestore");
												const { db: firedb } = await import("../../firebase");
												await addDoc(col(firedb, "supportRequests"), {
													userId: user.uid,
													userEmail: user.email,
													type: supportType,
													message: supportMessage.trim(),
													platform: Platform.OS,
													createdAt: sts(),
													status: "open",
												});
												setSupportSent(true);
											} catch (e) {
												Alert.alert(
													"Failed to send",
													"Please try again or email munchsprouts@outlook.com directly.",
												);
											}
										}}
										style={[
											s.btnPrimary,
											(!supportType || !supportMessage.trim()) && { opacity: 0.5 },
										]}
										disabled={!supportType || !supportMessage.trim()}
										activeOpacity={0.8}>
										<Text style={s.btnPrimaryText}>Send Message</Text>
									</TouchableOpacity>
									<Text
										style={{
											fontSize: 11,
											color: C.mutedText,
											textAlign: "center",
											lineHeight: 18,
										}}>
										Or email us directly at munchsprouts@outlook.com
									</Text>
								</View>
							</ScrollView>
						)}

						<PickerModal
							visible={showSupportTypePicker}
							title="What can we help with?"
							options={["General Help", "Bug / Problem", "Account Help", "Feature Request"]}
							value={supportType}
							onSelect={setSupportType}
							onClose={() => setShowSupportTypePicker(false)}
						/>
					</View>
				</KeyboardAvoidingView>
			</Modal>

			{/* Danger Zone */}
			<Text style={[s.smallLabel, { paddingLeft: 4, marginBottom: 10, marginTop: 10 }]}>Danger Zone</Text>
			<MoreRow
				icon="trash"
				iconBg={C.statRedBg}
				label="Delete Account"
				sublabel="Permanently delete account and all data"
				color="#c0392b"
				onPress={() => {
					Alert.alert(
						"Delete Account",
						"This will permanently delete your account, all children, and all food log data. This cannot be undone.",
						[
							{ text: "Cancel", style: "cancel" },
							{
								text: "Yes, Delete Everything",
								style: "destructive",
								onPress: () =>
									Alert.alert("Final Confirmation", "Last chance — this cannot be reversed.", [
										{ text: "Cancel", style: "cancel" },
										{
											text: "Delete My Account",
											style: "destructive",
											onPress: onDeleteAccount,
										},
									]),
							},
						],
					);
				}}
				right={<View />}
			/>

			{/* Change Password Modal */}
			<Modal
				visible={showChangePassword}
				transparent
				animationType="slide"
				onRequestClose={() => setShowChangePassword(false)}>
				<KeyboardAvoidingView
					behavior={Platform.OS === "ios" ? "padding" : "height"}
					style={s.modalOverlay}>
					<View style={s.modalSheet}>
						<View
							style={{
								flexDirection: "row",
								justifyContent: "space-between",
								alignItems: "center",
								marginBottom: 22,
							}}>
							<Text style={s.modalTitle}>Change Password</Text>
							<TouchableOpacity
								onPress={() => setShowChangePassword(false)}
								style={{ backgroundColor: C.bgPurple, borderRadius: 10, padding: 8 }}>
								<Icon name="close" size={16} color={C.mutedText} />
							</TouchableOpacity>
						</View>
						<View style={{ gap: 14 }}>
							<View>
								<Text style={s.label}>Current Password</Text>
								<TextInput
									value={currentPw}
									onChangeText={setCurrentPw}
									placeholder="Enter current password"
									secureTextEntry
									style={[s.input, { backgroundColor: C.white }]}
									placeholderTextColor={C.mutedText}
									autoComplete="off"
								/>
							</View>
							<View>
								<Text style={s.label}>New Password</Text>
								<TextInput
									value={newPw}
									onChangeText={setNewPw}
									placeholder="At least 6 characters"
									secureTextEntry
									style={[s.input, { backgroundColor: C.white }]}
									placeholderTextColor={C.mutedText}
									autoComplete="off"
								/>
							</View>
							<View>
								<Text style={s.label}>Confirm New Password</Text>
								<TextInput
									value={confirmPw}
									onChangeText={setConfirmPw}
									placeholder="Repeat new password"
									secureTextEntry
									style={[s.input, { backgroundColor: C.white }]}
									placeholderTextColor={C.mutedText}
									autoComplete="off"
								/>
							</View>
							<TouchableOpacity
								onPress={handleChangePassword}
								disabled={pwLoading}
								style={[s.btnPrimary, pwLoading && { opacity: 0.6 }]}
								activeOpacity={0.8}>
								{pwLoading ? (
									<ActivityIndicator color={C.white} />
								) : (
									<Text style={s.btnPrimaryText}>Update Password</Text>
								)}
							</TouchableOpacity>
						</View>
					</View>
				</KeyboardAvoidingView>
			</Modal>
		</ScrollView>
	);
}
