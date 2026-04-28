import React from "react";
import { View, Text, TouchableOpacity, Modal, ScrollView } from "react-native";
import { useTheme, useStyles } from "../ThemeContext";
import { Icon } from "./Icon";

export function PickerModal({ visible, title, options, value, onSelect, onClose }) {
	const { C } = useTheme();
	const s = useStyles();
	return (
		<Modal
			visible={visible}
			transparent
			animationType="slide"
			onRequestClose={onClose}>
			<TouchableOpacity
				style={s.pickerOverlay}
				onPress={onClose}
				activeOpacity={1}>
				<View style={s.pickerSheet}>
					<Text style={s.pickerTitle}>{title}</Text>
					<ScrollView>
						{options.map((opt) => (
							<TouchableOpacity
								key={opt}
								onPress={() => {
									onSelect(opt);
									onClose();
								}}
								style={[
									s.pickerItem,
									value === opt && { backgroundColor: C.bgPurple },
								]}>
								<Text
									style={[
										s.pickerItemText,
										value === opt && {
											color: C.primaryPurple,
											fontWeight: "700",
										},
									]}>
									{opt}
								</Text>
								{value === opt && (
									<Icon name="check" size={15} color={C.primaryPurple} />
								)}
							</TouchableOpacity>
						))}
					</ScrollView>
					<TouchableOpacity
						onPress={onClose}
						style={[s.btnPrimary, { marginTop: 12 }]}>
						<Text style={s.btnPrimaryText}>Done</Text>
					</TouchableOpacity>
				</View>
			</TouchableOpacity>
		</Modal>
	);
}
