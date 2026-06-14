import React, { useState } from "react";
import {
	View,
	Text,
	TextInput,
	TouchableOpacity,
	Modal,
	KeyboardAvoidingView,
	Platform,
	Alert,
	ScrollView,
} from "react-native";
import { useTheme, useStyles } from "../ThemeContext";
import { Icon } from "./Icon";
import { PickerModal } from "./PickerModal";

export function SupportModal({ visible, onClose, user }) {
	const { C } = useTheme();
	const s = useStyles();
	const [supportType, setSupportType] = useState("");
	const [supportMessage, setSupportMessage] = useState("");
	const [supportSent, setSupportSent] = useState(false);
	const [showSupportTypePicker, setShowSupportTypePicker] = useState(false);

	const handleClose = () => {
		onClose();
		setSupportType("");
		setSupportMessage("");
		setSupportSent(false);
	};

	return (
		<Modal
			visible={visible}
			transparent
			animationType="slide"
			onRequestClose={handleClose}>
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
							onPress={handleClose}
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
									fontFamily: "NunitoSans_700Bold",
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
								onPress={handleClose}
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
												fontFamily: "NunitoSans_600SemiBold",
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
									<Text style={{ fontSize: 14, fontFamily: "NunitoSans_700Bold", color: C.primaryPinkDark }}>
										{user.email}
									</Text>
								</View>
								<TouchableOpacity
									onPress={async () => {
										if (!supportType) {
											Alert.alert("Select a category", "Please choose what you need help with.");
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
	);
}
