import React, { useState } from "react";
import {
	View,
	Text,
	TextInput,
	TouchableOpacity,
	Modal,
	KeyboardAvoidingView,
	Platform,
} from "react-native";
import { useTheme, useStyles } from "../ThemeContext";
import { Icon, CategoryIcon, ReactionFace } from "./Icon";
import { REACTIONS } from "../constants";

export function LogRecipeModal({ visible, recipe, childName, onConfirm, onClose }) {
	const { C } = useTheme();
	const s = useStyles();
	const [selectedReaction, setSelectedReaction] = useState("");
	const [notes, setNotes] = useState("");

	const reset = () => {
		setSelectedReaction("");
		setNotes("");
	};

	if (!visible || !recipe) return null;

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
					<View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
						<View style={{ flex: 1, marginRight: 12 }}>
							<Text style={s.modalTitle}>Log Recipe</Text>
							<Text style={{ fontSize: 13, color: C.mutedText, marginTop: 3 }} numberOfLines={1}>
								{recipe.title}{childName ? ` for ${childName}` : ""}
							</Text>
						</View>
						<TouchableOpacity
							onPress={() => { reset(); onClose(); }}
							style={{ backgroundColor: C.bgPurple, borderRadius: 10, padding: 8 }}>
							<Icon name="close" size={16} color={C.mutedText} />
						</TouchableOpacity>
					</View>

					<View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.bgPurple, borderRadius: 14, padding: 14, marginBottom: 20 }}>
						<CategoryIcon category={recipe.category} size={44} />
						<View style={{ flex: 1 }}>
							<Text style={{ fontWeight: "700", fontSize: 14, color: C.primaryPinkDark }}>
								{recipe.title}
							</Text>
							<View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
								<View style={s.tagPurple}><Text style={s.tagPurpleText}>{recipe.category}</Text></View>
								<View style={s.tagGreen}><Text style={s.tagGreenText}>{recipe.ageGroup}</Text></View>
							</View>
						</View>
					</View>

					<Text style={[s.label, { marginBottom: 10 }]}>How did they react?</Text>
					<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
						{REACTIONS.map((r) => {
							const sel = selectedReaction === r.value;
							return (
								<TouchableOpacity
									key={r.value}
									onPress={() => setSelectedReaction(r.value)}
									style={{
										backgroundColor: sel ? r.bg : C.white,
										borderColor: sel ? r.border : C.borderLight,
										borderWidth: 2,
										borderRadius: 14,
										paddingVertical: 10,
										paddingHorizontal: 6,
										flex: 1,
										alignItems: "center",
										gap: 6,
										minWidth: "18%",
									}}
									activeOpacity={0.8}>
									<ReactionFace reaction={r.value} size={32} />
									<Text style={{ fontWeight: "700", fontSize: 10, color: sel ? r.color : C.mutedText, textAlign: "center" }}>
										{r.value}
									</Text>
								</TouchableOpacity>
							);
						})}
					</View>

					<Text style={[s.label, { marginBottom: 6 }]}>Notes (optional)</Text>
					<TextInput
						value={notes}
						onChangeText={setNotes}
						placeholder="How did it go? Any observations..."
						multiline
						numberOfLines={3}
						style={[s.input, { height: 80, textAlignVertical: "top", backgroundColor: C.white, marginBottom: 18 }]}
						placeholderTextColor={C.mutedText}
						autoComplete="off"
					/>

					<TouchableOpacity
						onPress={() => { onConfirm(selectedReaction, notes); reset(); }}
						style={s.btnPrimary}
						activeOpacity={0.8}>
						<View style={{ flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center" }}>
							<Icon name="plus" size={16} color={C.white} />
							<Text style={s.btnPrimaryText}>Add to Food Log</Text>
						</View>
					</TouchableOpacity>
				</View>
			</KeyboardAvoidingView>
		</Modal>
	);
}
