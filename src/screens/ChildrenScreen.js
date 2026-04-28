import React, { useState } from "react";
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
	Image,
} from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useTheme, useStyles } from "../ThemeContext";
import { Icon } from "../components/Icon";
import { PrimaryBtn, SecondaryBtn, DangerBtn } from "../components/SharedComponents";
import { DateField } from "../components/DatePickerModal";
import { calcAgeWeeks, calcAgeMonths, formatDate, pickImageAsBase64 } from "../helpers";

export function ChildrenScreen({
	children,
	activeChildId,
	onSetActive,
	onAdd,
	onEdit,
	onDelete,
}) {
	const { C } = useTheme();
	const s = useStyles();
	const [modalVisible, setModalVisible] = useState(false);
	const [editTarget, setEditTarget] = useState(null);
	const [form, setForm] = useState({ name: "", dob: "", weaningStart: "" });
	const [childPhoto, setChildPhoto] = useState("");
	const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

	const openAdd = () => {
		setForm({ name: "", dob: "", weaningStart: "" });
		setChildPhoto(null);
		setEditTarget(null);
		setModalVisible(true);
	};
	const openEdit = (child) => {
		setForm({ name: child.name, dob: child.dob, weaningStart: child.weaningStart || "" });
		setChildPhoto(child.photoUri || "");
		setEditTarget(child);
		setModalVisible(true);
	};
	const save = () => {
		if (!form.name || !form.dob) return;
		const data = { ...form, photoUri: childPhoto };
		editTarget ? onEdit({ ...editTarget, ...data }) : onAdd({ ...data });
		setModalVisible(false);
		setChildPhoto("");
	};
	const handlePickChildPhoto = async () => {
		const uri = await pickImageAsBase64([1, 1]);
		if (uri) setChildPhoto(uri);
	};

	return (
		<View style={{ flex: 1 }}>
			<View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
				<Text style={s.pageTitle}>Children</Text>
				<TouchableOpacity onPress={openAdd} style={[s.btnPrimary, { paddingHorizontal: 18, width: "auto", paddingVertical: 10 }]}>
					<View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
						<Icon name="plus" size={14} color={C.white} />
						<Text style={s.btnPrimaryText}>Add Child</Text>
					</View>
				</TouchableOpacity>
			</View>

			<ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
				{children.length === 0 && (
					<View style={[s.card, { alignItems: "center", paddingVertical: 40 }]}>
						<Icon name="users" size={44} color={C.secondaryPurple} />
						<Text style={{ color: C.mutedText, fontWeight: "600", marginTop: 14, fontSize: 15 }}>No children added yet</Text>
					</View>
				)}
				{children.map((child) => {
					const weeks = calcAgeWeeks(child.dob),
						months = calcAgeMonths(child.dob),
						isActive = child.id === activeChildId;
					return (
						<View
							key={child.id}
							style={[s.card, { borderWidth: 2, borderColor: isActive ? C.primaryPurple : "transparent", backgroundColor: isActive ? C.bgPurple : C.white }]}>
							<View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
								<View style={{ flex: 1 }}>
									<View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 }}>
										<TouchableOpacity onPress={() => openEdit(child)} activeOpacity={0.8}>
											<View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.primaryPurple + "22", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
												{child.photoUri ? (
													<Image source={{ uri: child.photoUri }} style={{ width: 52, height: 52 }} resizeMode="cover" />
												) : (
													<Svg width={32} height={32} viewBox="0 0 32 32">
														<Circle cx="16" cy="13" r="8" fill={C.primaryPurple} opacity="0.7" />
														<Circle cx="12" cy="12" r="1.5" fill={C.white} />
														<Circle cx="20" cy="12" r="1.5" fill={C.white} />
														<Path d="M12 17 Q16 20 20 17" stroke={C.white} strokeWidth="1.5" strokeLinecap="round" fill="none" />
														<Path d="M6 26 Q16 32 26 26" stroke={C.primaryPurple} strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.5" />
													</Svg>
												)}
											</View>
										</TouchableOpacity>
										<View>
											<Text style={{ fontWeight: "700", fontSize: 17, color: C.primaryPinkDark }}>{child.name}</Text>
											{isActive && (
												<View style={{ backgroundColor: C.primaryPurple, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, alignSelf: "flex-start", marginTop: 2 }}>
													<Text style={{ fontSize: 9, fontWeight: "700", color: C.white, textTransform: "uppercase" }}>Active</Text>
												</View>
											)}
										</View>
									</View>
									<Text style={{ fontSize: 13, color: C.mutedText }}>Born {formatDate(child.dob)}</Text>
									{weeks !== null && (
										<Text style={{ fontSize: 12, color: C.mutedText, marginTop: 2 }}>{weeks} weeks old · {months} months</Text>
									)}
									{child.weaningStart && (
										<Text style={{ fontSize: 11, color: C.mutedText, marginTop: 2 }}>Weaning from {formatDate(child.weaningStart)}</Text>
									)}
								</View>
								<View style={{ gap: 8 }}>
									{!isActive && (
										<TouchableOpacity onPress={() => onSetActive(child.id)} style={[s.btnPrimary, { width: "auto", paddingHorizontal: 14, paddingVertical: 8 }]}>
											<Text style={[s.btnPrimaryText, { fontSize: 12 }]}>Select</Text>
										</TouchableOpacity>
									)}
									<View style={{ flexDirection: "row", gap: 8 }}>
										<SecondaryBtn onPress={() => openEdit(child)} style={{ padding: 8 }}>
											<Icon name="edit" size={14} color={C.primaryPurple} />
										</SecondaryBtn>
										<DangerBtn
											onPress={() =>
												Alert.alert("Delete", `Delete ${child.name} and all their data?`, [
													{ text: "Cancel" },
													{ text: "Delete", style: "destructive", onPress: () => onDelete(child.id) },
												])
											}
											style={{ padding: 8 }}>
											<Icon name="trash" size={14} color="#c0392b" />
										</DangerBtn>
									</View>
								</View>
							</View>
						</View>
					);
				})}
			</ScrollView>

			<Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
				<KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={s.modalOverlay}>
					<View style={s.modalSheet}>
						<View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
							<Text style={s.modalTitle}>{editTarget ? "Edit Child" : "Add Child"}</Text>
							<TouchableOpacity onPress={() => setModalVisible(false)} style={{ backgroundColor: C.bgPurple, borderRadius: 10, padding: 8 }}>
								<Icon name="close" size={16} color={C.mutedText} />
							</TouchableOpacity>
						</View>
						<ScrollView showsVerticalScrollIndicator={false}>
							<View style={{ gap: 16, paddingBottom: 20 }}>
								<TouchableOpacity onPress={handlePickChildPhoto} style={{ alignItems: "center" }} activeOpacity={0.8}>
									<View style={{ width: 90, height: 90, borderRadius: 45, backgroundColor: C.bgPurple, alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: 2.5, borderColor: childPhoto ? C.primaryPurple : C.borderLight }}>
										{childPhoto ? (
											<Image source={{ uri: childPhoto }} style={{ width: 90, height: 90 }} resizeMode="cover" />
										) : (
											<Icon name="Camera" size={28} color={C.mutedText} />
										)}
									</View>
									<Text style={{ fontSize: 12, color: C.primaryPurple, fontWeight: "700", marginTop: 8 }}>
										{childPhoto ? "Change or Remove Photo" : "Add Photo (optional)"}
									</Text>
								</TouchableOpacity>
								<View>
									<Text style={s.label}>Name</Text>
									<TextInput
										value={form.name}
										onChangeText={(v) => set("name", v)}
										placeholder="e.g. Eleia"
										style={[s.input, { backgroundColor: C.white }]}
										placeholderTextColor={C.mutedText}
										autoComplete="off"
										autoCorrect={false}
									/>
								</View>
								<DateField label="Date of Birth" value={form.dob} onChange={(v) => set("dob", v)} minYear={2018} maxYear={new Date().getFullYear()} />
								<DateField label="Weaning Start Date (optional)" value={form.weaningStart} onChange={(v) => set("weaningStart", v)} minYear={2018} maxYear={new Date().getFullYear() + 1} />
								<PrimaryBtn label={editTarget ? "Update Child" : "Save Child"} onPress={save} />
							</View>
						</ScrollView>
					</View>
				</KeyboardAvoidingView>
			</Modal>
		</View>
	);
}
