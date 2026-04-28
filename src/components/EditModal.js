import React from "react";
import {
	View,
	Text,
	TouchableOpacity,
	Modal,
	KeyboardAvoidingView,
	ScrollView,
	Platform,
} from "react-native";
import { useTheme, useStyles } from "../ThemeContext";
import { Icon } from "./Icon";
import { FoodForm } from "./FoodForm";

export function EditModal({ visible, entry, onSubmit, onClose, isPro = false }) {
	const { C } = useTheme();
	const s = useStyles();
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
					<View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
						<Text style={s.modalTitle}>Edit Entry</Text>
						<TouchableOpacity
							onPress={onClose}
							style={{ backgroundColor: C.bgPurple, borderRadius: 10, padding: 8 }}>
							<Icon name="close" size={16} color={C.mutedText} />
						</TouchableOpacity>
					</View>
					<ScrollView>
						{entry && (
							<FoodForm
								initial={entry}
								onSubmit={onSubmit}
								buttonLabel="Update Entry"
								isPro={isPro}
							/>
						)}
					</ScrollView>
				</View>
			</KeyboardAvoidingView>
		</Modal>
	);
}
