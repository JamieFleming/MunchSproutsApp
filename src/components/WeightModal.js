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
} from "react-native";
import { useTheme, useStyles } from "../ThemeContext";
import { Icon } from "./Icon";
import { DateField } from "./DatePickerModal";
import { formatWeight } from "../helpers";

/**
 * Self-contained modal for logging a new weight entry.
 * Manages its own input state and resets when opened.
 *
 * Props:
 *   visible        - boolean controlling visibility
 *   activeChild    - the child object being weighed (or null)
 *   defaultUnit    - "lbs" | "kg" — initial unit selection
 *   onSave(entry)  - called with { childId, value_kg, date } on save
 *   onClose()      - called when the modal should close
 */
export function WeightModal({ visible, activeChild, defaultUnit = "lbs", onSave, onClose }) {
	const { C } = useTheme();
	const s = useStyles();

	const [lb,   setLb]   = useState("");
	const [oz,   setOz]   = useState("");
	const [kg,   setKg]   = useState("");
	const [unit, setUnit] = useState(defaultUnit);
	const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

	// Reset inputs and sync unit preference whenever the modal opens
	useEffect(() => {
		if (visible) {
			setLb("");
			setOz("");
			setKg("");
			setDate(new Date().toISOString().split("T")[0]);
			setUnit(defaultUnit);
		}
	}, [visible, defaultUnit]);

	const handleUnitChange = (newUnit) => {
		setUnit(newUnit);
		setLb("");
		setOz("");
		setKg("");
	};

	// Compute preview kg from current inputs (null if nothing entered yet)
	const previewKg = (() => {
		if (unit === "lbs") {
			const lbVal = parseFloat(lb) || 0;
			const ozVal = parseFloat(oz) || 0;
			return lbVal > 0 || ozVal > 0 ? (lbVal + ozVal / 16) / 2.20462 : null;
		}
		const kgVal = parseFloat(kg);
		return !isNaN(kgVal) && kgVal > 0 ? kgVal : null;
	})();

	const hasValidWeight = previewKg !== null;

	const handleSave = async () => {
		if (!hasValidWeight || !activeChild) return;
		const value_kg = Math.round(previewKg * 1000) / 1000;
		await onSave({ childId: activeChild.id, value_kg, date });
		onClose();
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
				<View style={[s.modalSheet, { gap: 16 }]}>

					{/* Header */}
					<View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
						<Text style={s.modalTitle}>Log Weight</Text>
						<TouchableOpacity
							onPress={onClose}
							style={{ backgroundColor: C.bgPurple, borderRadius: 10, padding: 8 }}>
							<Icon name="close" size={16} color={C.mutedText} />
						</TouchableOpacity>
					</View>

					{/* No child selected */}
					{!activeChild ? (
						<Text style={{ fontSize: 13, color: C.mutedText, textAlign: "center" }}>
							No child selected. Please add or select a child first.
						</Text>
					) : (
						<ScrollView
							showsVerticalScrollIndicator={false}
							keyboardShouldPersistTaps="handled">
							<View style={{ gap: 16, paddingBottom: 8 }}>

								<Text style={{ fontSize: 13, color: C.mutedText }}>
									Recording weight for{" "}
									<Text style={{ fontFamily: "NunitoSans_700Bold", color: C.primaryPinkDark }}>
										{activeChild.name}
									</Text>
								</Text>

								{/* Date picker */}
								<DateField
									label="Date"
									value={date}
									onChange={setDate}
									minYear={2018}
									maxYear={new Date().getFullYear()}
								/>

								{/* Unit toggle + inputs */}
								<View>
									<Text style={s.label}>Weight</Text>

									<View style={{ flexDirection: "row", backgroundColor: C.bgPurple, borderRadius: 10, overflow: "hidden", marginBottom: 10 }}>
										{["lbs", "kg"].map((u) => (
											<TouchableOpacity
												key={u}
												onPress={() => handleUnitChange(u)}
												style={{ flex: 1, paddingVertical: 10, alignItems: "center", backgroundColor: unit === u ? C.primaryPurple : "transparent" }}>
												<Text style={{ fontFamily: "NunitoSans_700Bold", fontSize: 13, color: unit === u ? C.white : C.mutedText }}>
													{u}
												</Text>
											</TouchableOpacity>
										))}
									</View>

									{unit === "lbs" ? (
										<View style={{ flexDirection: "row", gap: 10 }}>
											<View style={{ flex: 1 }}>
												<TextInput
													value={lb}
													onChangeText={setLb}
													placeholder="0"
													keyboardType="number-pad"
													style={[s.input, { backgroundColor: C.bgMain, textAlign: "center" }]}
													placeholderTextColor={C.mutedText}
												/>
												<Text style={{ fontSize: 11, color: C.mutedText, textAlign: "center", marginTop: 4 }}>
													pounds (lb)
												</Text>
											</View>
											<View style={{ flex: 1 }}>
												<TextInput
													value={oz}
													onChangeText={setOz}
													placeholder="0"
													keyboardType="number-pad"
													style={[s.input, { backgroundColor: C.bgMain, textAlign: "center" }]}
													placeholderTextColor={C.mutedText}
												/>
												<Text style={{ fontSize: 11, color: C.mutedText, textAlign: "center", marginTop: 4 }}>
													ounces (oz)
												</Text>
											</View>
										</View>
									) : (
										<View>
											<TextInput
												value={kg}
												onChangeText={setKg}
												placeholder="e.g. 7.5"
												keyboardType="decimal-pad"
												style={[s.input, { backgroundColor: C.bgMain }]}
												placeholderTextColor={C.mutedText}
											/>
											<Text style={{ fontSize: 11, color: C.mutedText, marginTop: 4 }}>
												kilograms (kg)
											</Text>
										</View>
									)}
								</View>

								{/* Live preview */}
								{previewKg !== null && (
									<View style={{ backgroundColor: C.bgPurple, borderRadius: 12, padding: 12, alignItems: "center" }}>
										<Text style={{ fontSize: 12, color: C.mutedText, marginBottom: 4 }}>
											Will be saved as
										</Text>
										<Text style={{ fontFamily: "NunitoSans_800ExtraBold", fontSize: 16, color: C.primaryPurple }}>
											{formatWeight(previewKg, "lbs")}  ·  {formatWeight(previewKg, "kg")}
										</Text>
									</View>
								)}

								{/* Save button */}
								<TouchableOpacity
									onPress={handleSave}
									disabled={!hasValidWeight}
									style={[s.btnPrimary, { opacity: hasValidWeight ? 1 : 0.45 }]}>
									<Text style={s.btnPrimaryText}>Save Weight</Text>
								</TouchableOpacity>
							</View>
						</ScrollView>
					)}
				</View>
			</KeyboardAvoidingView>
		</Modal>
	);
}
