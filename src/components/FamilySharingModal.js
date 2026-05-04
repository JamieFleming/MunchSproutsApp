import React, { useState } from "react";
import {
	View,
	Text,
	TextInput,
	TouchableOpacity,
	Modal,
	KeyboardAvoidingView,
	Platform,
	ActivityIndicator,
} from "react-native";
import { useTheme, useStyles } from "../ThemeContext";
import { Icon } from "./Icon";

export function FamilySharingModal({
	visible,
	onClose,
	user,
	ownedChildren,
	defaultChildId,
	onManageSharing,
}) {
	const { C } = useTheme();
	const s = useStyles();
	const [shareEmail, setShareEmail] = useState("");
	const [shareLoading, setShareLoading] = useState(false);
	const [selectedChildId, setSelectedChildId] = useState(null);

	const handleClose = () => {
		onClose();
		setShareEmail("");
		setSelectedChildId(null);
	};

	const myOwnedChildren = ownedChildren.filter(
		(c) => c.isOwner !== false && c.isOwner !== undefined,
	);

	return (
		<Modal
			visible={visible}
			transparent
			animationType="slide"
			onRequestClose={handleClose}>
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
							onPress={handleClose}
							style={{ backgroundColor: C.bgPurple, borderRadius: 10, padding: 8 }}>
							<Icon name="close" size={16} color={C.mutedText} />
						</TouchableOpacity>
					</View>

					{myOwnedChildren.length > 1 && (
						<View style={{ marginBottom: 16 }}>
							<Text style={s.label}>Select Child to Share</Text>
							{myOwnedChildren.map((c) => (
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
								handleClose();
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
										<View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
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
														color: row.role === "Owner" ? C.primaryPurple : C.statGreenText,
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
	);
}
