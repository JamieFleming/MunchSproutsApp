import React, { useState, useEffect } from "react";
import {
	View,
	Text,
	TouchableOpacity,
	ScrollView,
	FlatList,
	Modal,
	Platform,
	Alert,
	ActivityIndicator,
	Image,
	Dimensions,
} from "react-native";
import { useTheme, useStyles } from "../ThemeContext";
import { Icon } from "../components/Icon";
import { ZoomableImage } from "../components/ZoomableImage";
import { PasswordChangeModal } from "../components/PasswordChangeModal";
import { FamilySharingModal } from "../components/FamilySharingModal";
import { SupportModal } from "../components/SupportModal";
import { pickImageAsBase64 } from "../helpers";

const SCREEN_W = Dimensions.get("window").width;
const THUMB_SIZE = (SCREEN_W - 48 - 8) / 3; // 3 columns, 16px side padding, 4px gaps

export function MoreScreen({
	user,
	isPro,
	ownedChildren,
	defaultChildId,
	showMilkOnDashboard = true,
	onToggleMilkOnDashboard,
	showAllergenOnDashboard = true,
	onToggleAllergenOnDashboard,
	onLogout,
	onDeleteAccount,
	onUpgradePro,
	onRestorePurchases,
	onManageSharing,
	foodLog = [],
}) {
	const { C, theme, setTheme } = useTheme();
	const s = useStyles();
	const [showChangePassword, setShowChangePassword] = useState(false);
	const [upgradeLoading, setUpgradeLoading] = useState(false);
	const [showSharing, setShowSharing] = useState(false);
	const [showSupport, setShowSupport] = useState(false);
	const [profilePhoto, setProfilePhoto] = useState("");
	const [showGallery, setShowGallery] = useState(false);
	const [lightboxPhoto, setLightboxPhoto] = useState(null); // { uri, name, date, reaction }

	// All food log entries that have a photo, newest first
	const photoEntries = [...foodLog]
		.filter((e) => !!e.photoUri)
		.sort((a, b) => new Date(b.date) - new Date(a.date));

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

			{/* Dashboard */}
			<Text style={[s.smallLabel, { paddingLeft: 4, marginBottom: 10, marginTop: 6 }]}>Dashboard</Text>
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
				<TouchableOpacity
					onPress={onToggleMilkOnDashboard}
					style={{ flexDirection: "row", alignItems: "center", gap: 14 }}
					activeOpacity={0.8}>
					<View
						style={{
							width: 42,
							height: 42,
							borderRadius: 13,
							backgroundColor: "#d4e8f5",
							alignItems: "center",
							justifyContent: "center",
						}}>
						<Icon name="bottle" size={20} color="#2a5f8f" />
					</View>
					<View style={{ flex: 1 }}>
						<Text style={{ fontWeight: "700", fontSize: 14, color: C.textCharcoal }}>
							Show Milk on Dashboard
						</Text>
						<Text style={{ fontSize: 12, color: C.mutedText, marginTop: 2 }}>
							Display today's bottle feeds on the home screen
						</Text>
					</View>
					{/* Toggle pill */}
					<TouchableOpacity
						onPress={onToggleMilkOnDashboard}
						activeOpacity={0.85}
						style={{
							width: 48,
							height: 28,
							borderRadius: 14,
							backgroundColor: showMilkOnDashboard ? C.primaryPurple : C.borderLight,
							justifyContent: "center",
							paddingHorizontal: 3,
						}}>
						<View
							style={{
								width: 22,
								height: 22,
								borderRadius: 11,
								backgroundColor: "#ffffff",
								alignSelf: showMilkOnDashboard ? "flex-end" : "flex-start",
								shadowColor: "#000",
								shadowOpacity: 0.15,
								shadowRadius: 2,
								elevation: 2,
							}}
						/>
					</TouchableOpacity>
				</TouchableOpacity>

				{/* Allergen tracker toggle */}
				<TouchableOpacity
					onPress={onToggleAllergenOnDashboard}
					style={{ flexDirection: "row", alignItems: "center", gap: 14, marginTop: 16 }}
					activeOpacity={0.8}>
					<View
						style={{
							width: 42,
							height: 42,
							borderRadius: 13,
							backgroundColor: "#ece8f9",
							alignItems: "center",
							justifyContent: "center",
						}}>
						<Icon name="shield" size={20} color="#7b5ea7" />
					</View>
					<View style={{ flex: 1 }}>
						<Text style={{ fontWeight: "700", fontSize: 14, color: C.textCharcoal }}>
							Show Allergen Tracker
						</Text>
						<Text style={{ fontSize: 12, color: C.mutedText, marginTop: 2 }}>
							Display allergen progress and reminders on the home screen
						</Text>
					</View>
					<TouchableOpacity
						onPress={onToggleAllergenOnDashboard}
						activeOpacity={0.85}
						style={{
							width: 48,
							height: 28,
							borderRadius: 14,
							backgroundColor: showAllergenOnDashboard ? C.primaryPurple : C.borderLight,
							justifyContent: "center",
							paddingHorizontal: 3,
						}}>
						<View
							style={{
								width: 22,
								height: 22,
								borderRadius: 11,
								backgroundColor: "#ffffff",
								alignSelf: showAllergenOnDashboard ? "flex-end" : "flex-start",
								shadowColor: "#000",
								shadowOpacity: 0.15,
								shadowRadius: 2,
								elevation: 2,
							}}
						/>
					</TouchableOpacity>
				</TouchableOpacity>
			</View>

			<MoreRow
				icon="Camera"
				iconBg={C.bgPurple}
				label="Photo Gallery"
				sublabel={`${photoEntries.length} food photo${photoEntries.length !== 1 ? "s" : ""} saved`}
				onPress={() => setShowGallery(true)}
			/>

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

			<FamilySharingModal
				visible={showSharing}
				onClose={() => setShowSharing(false)}
				user={user}
				ownedChildren={ownedChildren}
				defaultChildId={defaultChildId}
				onManageSharing={onManageSharing}
			/>

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

			<SupportModal
				visible={showSupport}
				onClose={() => setShowSupport(false)}
				user={user}
			/>

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

			{/* ── Photo Gallery Modal ── */}
			<Modal
				visible={showGallery}
				animationType="slide"
				onRequestClose={() => setShowGallery(false)}>
				<View style={{ flex: 1, backgroundColor: C.bgMain }}>
					{/* Header */}
					<View style={{
						flexDirection: "row",
						alignItems: "center",
						justifyContent: "space-between",
						paddingHorizontal: 20,
						paddingTop: Platform.OS === "ios" ? 56 : 20,
						paddingBottom: 16,
						backgroundColor: C.white,
						borderBottomWidth: 1,
						borderBottomColor: C.borderLight,
					}}>
						<View>
							<Text style={{ fontWeight: "800", fontSize: 20, color: C.primaryPinkDark }}>
								Photo Gallery
							</Text>
							<Text style={{ fontSize: 12, color: C.mutedText, marginTop: 2 }}>
								{photoEntries.length} food photo{photoEntries.length !== 1 ? "s" : ""}
							</Text>
						</View>
						<TouchableOpacity
							onPress={() => setShowGallery(false)}
							style={{ backgroundColor: C.bgPurple, borderRadius: 10, padding: 10 }}>
							<Icon name="close" size={18} color={C.mutedText} />
						</TouchableOpacity>
					</View>

					{photoEntries.length === 0 ? (
						<View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
							<Icon name="Camera" size={52} color={C.secondaryPurple} />
							<Text style={{ fontWeight: "700", fontSize: 16, color: C.mutedText }}>No photos yet</Text>
							<Text style={{ fontSize: 13, color: C.mutedText, textAlign: "center", paddingHorizontal: 40 }}>
								Add photos when logging food to see them here
							</Text>
						</View>
					) : (
						<FlatList
							data={photoEntries}
							keyExtractor={(item) => item.id}
							numColumns={3}
							contentContainerStyle={{ padding: 16, gap: 4 }}
							columnWrapperStyle={{ gap: 4, marginBottom: 4 }}
							renderItem={({ item }) => (
								<TouchableOpacity
									onPress={() => setLightboxPhoto(item)}
									activeOpacity={0.85}
									style={{ width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: 10, overflow: "hidden", backgroundColor: C.bgPurple }}>
									<Image
										source={{ uri: item.photoUri }}
										style={{ width: THUMB_SIZE, height: THUMB_SIZE }}
										resizeMode="cover"
									/>
									{/* Food name overlay at bottom */}
									<View style={{
										position: "absolute",
										bottom: 0,
										left: 0,
										right: 0,
										backgroundColor: "rgba(0,0,0,0.45)",
										paddingHorizontal: 5,
										paddingVertical: 4,
									}}>
										<Text style={{ fontSize: 9, fontWeight: "700", color: "#fff" }} numberOfLines={1}>
											{item.name}
										</Text>
									</View>
								</TouchableOpacity>
							)}
						/>
					)}

					{/* ── Lightbox overlay (inside gallery modal to avoid nesting modals) ── */}
					{lightboxPhoto && (
						<View style={{
							position: "absolute",
							top: 0, left: 0, right: 0, bottom: 0,
							backgroundColor: "#000",
							zIndex: 100,
						}}>
							{/* Close */}
							<TouchableOpacity
								onPress={() => setLightboxPhoto(null)}
								style={{
									position: "absolute",
									top: Platform.OS === "ios" ? 56 : 20,
									right: 20,
									zIndex: 10,
									backgroundColor: "rgba(0,0,0,0.5)",
									borderRadius: 20,
									padding: 10,
								}}>
								<Icon name="close" size={20} color="#fff" />
							</TouchableOpacity>

							{/* Zoomable image */}
							<ZoomableImage uri={lightboxPhoto.photoUri} />

							<Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, textAlign: "center", paddingBottom: 4 }}>
								Pinch to zoom · Double-tap to reset
							</Text>

							{/* Info strip */}
							<View style={{
								backgroundColor: "rgba(0,0,0,0.7)",
								paddingHorizontal: 24,
								paddingVertical: 18,
								paddingBottom: Platform.OS === "ios" ? 36 : 18,
							}}>
								<Text style={{ fontSize: 18, fontWeight: "800", color: "#fff", marginBottom: 4 }}>
									{lightboxPhoto.name}
								</Text>
								<View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
									{lightboxPhoto.date && (
										<Text style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
											{lightboxPhoto.date}
										</Text>
									)}
									{lightboxPhoto.reaction && (
										<Text style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
											· {lightboxPhoto.reaction}
										</Text>
									)}
									{lightboxPhoto.form && (
										<Text style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
											· {lightboxPhoto.form}
										</Text>
									)}
								</View>
							</View>
						</View>
					)}
				</View>
			</Modal>

			<PasswordChangeModal
				visible={showChangePassword}
				onClose={() => setShowChangePassword(false)}
				user={user}
			/>
		</ScrollView>
	);
}
