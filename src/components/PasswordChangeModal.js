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
	ActivityIndicator,
} from "react-native";
import {
	updatePassword,
	EmailAuthProvider,
	reauthenticateWithCredential,
} from "firebase/auth";
import { auth } from "../firebase";
import { useTheme, useStyles } from "../ThemeContext";
import { Icon } from "./Icon";

export function PasswordChangeModal({ visible, onClose, user }) {
	const { C } = useTheme();
	const s = useStyles();
	const [currentPw, setCurrentPw] = useState("");
	const [newPw, setNewPw] = useState("");
	const [confirmPw, setConfirmPw] = useState("");
	const [pwLoading, setPwLoading] = useState(false);

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
			onClose();
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

	return (
		<Modal
			visible={visible}
			transparent
			animationType="slide"
			onRequestClose={onClose}>
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
							onPress={onClose}
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
	);
}
