import React, { useState, useMemo } from "react";
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
} from "react-native";
import { useTheme, useStyles } from "../ThemeContext";
import { Icon } from "../components/Icon";
import { PickerModal } from "../components/PickerModal";
import { DateField } from "../components/DatePickerModal";
import { formatDate, formatTime, toMl, buildHours, buildMinutes } from "../helpers";

const MILK_TYPES = [
	{ id: "formula", label: "Formula", color: "#2a5f8f", bg: "#d4e8f5" },
	{ id: "breast", label: "Breast Milk", color: "#7a2d6a", bg: "#f5d4f0" },
	{ id: "specialised", label: "Specialised", color: "#a85a1a", bg: "#fde8cc" },
];

function typeStyle(id) {
	return MILK_TYPES.find((t) => t.id === id) || MILK_TYPES[0];
}

function nowTime() {
	const n = new Date();
	return `${String(n.getHours()).padStart(2, "0")}:${String(Math.floor(n.getMinutes() / 5) * 5).padStart(2, "0")}`;
}

function todayDate() {
	return new Date().toISOString().split("T")[0];
}

const EMPTY_FORM = {
	date: todayDate(),
	hour: String(new Date().getHours()).padStart(2, "0"),
	minute: String(Math.floor(new Date().getMinutes() / 5) * 5).padStart(2, "0"),
	type: "formula",
	amount: "",
	unit: "ml",
	notes: "",
};

export function BottleScreen({ bottleLog, childName, onAdd, onEdit, onDelete }) {
	const { C } = useTheme();
	const s = useStyles();

	const [modalVisible, setModalVisible] = useState(false);
	const [editTarget, setEditTarget] = useState(null);
	const [form, setForm] = useState(EMPTY_FORM);
	const [showHourPicker, setShowHourPicker] = useState(false);
	const [showMinutePicker, setShowMinutePicker] = useState(false);

	const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

	const openAdd = () => {
		setForm({ ...EMPTY_FORM, date: todayDate(), hour: String(new Date().getHours()).padStart(2, "0"), minute: String(Math.floor(new Date().getMinutes() / 5) * 5).padStart(2, "0") });
		setEditTarget(null);
		setModalVisible(true);
	};

	const openEdit = (entry) => {
		const [h, m] = (entry.time || "12:00").split(":");
		setForm({
			date: entry.date || todayDate(),
			hour: h || "12",
			minute: m || "00",
			type: entry.type || "formula",
			amount: String(entry.amount || ""),
			unit: entry.unit || "ml",
			notes: entry.notes || "",
		});
		setEditTarget(entry);
		setModalVisible(true);
	};

	const save = () => {
		if (!form.amount || isNaN(parseFloat(form.amount))) {
			Alert.alert("Missing amount", "Please enter how much milk was given.");
			return;
		}
		const data = {
			date: form.date,
			time: `${form.hour}:${form.minute}`,
			type: form.type,
			amount: parseFloat(form.amount),
			unit: form.unit,
			notes: form.notes.trim(),
		};
		editTarget ? onEdit({ ...editTarget, ...data }) : onAdd(data);
		setModalVisible(false);
	};

	// Group entries by date, sorted newest first
	const grouped = useMemo(() => {
		const sorted = [...bottleLog].sort((a, b) => {
			const da = `${a.date || ""}T${a.time || "00:00"}`;
			const db2 = `${b.date || ""}T${b.time || "00:00"}`;
			return db2.localeCompare(da);
		});
		const map = {};
		sorted.forEach((e) => {
			const d = e.date || "Unknown";
			if (!map[d]) map[d] = [];
			map[d].push(e);
		});
		return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
	}, [bottleLog]);

	const today = todayDate();
	const todayEntries = bottleLog.filter((e) => e.date === today);
	const todayTotalMl = todayEntries.reduce((sum, e) => sum + toMl(e.amount, e.unit), 0);

	return (
		<View style={{ flex: 1 }}>
			{/* Header row */}
			<View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
				<Text style={s.pageTitle}>Bottle Log</Text>
				<TouchableOpacity
					onPress={openAdd}
					style={[s.btnPrimary, { paddingHorizontal: 18, width: "auto", paddingVertical: 10 }]}>
					<View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
						<Icon name="plus" size={14} color={C.white} />
						<Text style={s.btnPrimaryText}>Log Bottle</Text>
					</View>
				</TouchableOpacity>
			</View>

			<ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 24 }}>
				{/* Today's summary */}
				<View style={{ backgroundColor: C.statBlueBg, borderRadius: 20, padding: 18, flexDirection: "row", alignItems: "center", gap: 16 }}>
					<View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: "#2a5f8f22", alignItems: "center", justifyContent: "center" }}>
						<Icon name="bottle" size={28} color="#2a5f8f" />
					</View>
					<View style={{ flex: 1 }}>
						<Text style={{ fontSize: 12, fontWeight: "700", color: "#2a5f8f", textTransform: "uppercase", letterSpacing: 0.5 }}>
							Today{childName ? ` · ${childName}` : ""}
						</Text>
						<Text style={{ fontSize: 26, fontWeight: "800", color: "#2a5f8f", marginTop: 2 }}>
							{todayTotalMl} ml
						</Text>
						<Text style={{ fontSize: 12, color: "#2a5f8f99", marginTop: 2 }}>
							{todayEntries.length === 0
								? "No feeds logged yet"
								: `${todayEntries.length} feed${todayEntries.length !== 1 ? "s" : ""} today`}
						</Text>
					</View>
					{todayEntries.length > 0 && (
						<View style={{ alignItems: "flex-end" }}>
							{MILK_TYPES.map((t) => {
								const cnt = todayEntries.filter((e) => e.type === t.id).length;
								if (cnt === 0) return null;
								return (
									<View key={t.id} style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 }}>
										<View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.color }} />
										<Text style={{ fontSize: 11, color: "#2a5f8f", fontWeight: "600" }}>{cnt}× {t.label}</Text>
									</View>
								);
							})}
						</View>
					)}
				</View>

				{/* Type legend */}
				<View style={{ flexDirection: "row", gap: 8 }}>
					{MILK_TYPES.map((t) => (
						<View key={t.id} style={{ flex: 1, backgroundColor: t.bg, borderRadius: 12, padding: 10, alignItems: "center" }}>
							<View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.color, marginBottom: 4 }} />
							<Text style={{ fontSize: 10, fontWeight: "700", color: t.color, textAlign: "center" }}>{t.label}</Text>
						</View>
					))}
				</View>

				{/* Empty state */}
				{bottleLog.length === 0 && (
					<View style={[s.card, { alignItems: "center", paddingVertical: 40 }]}>
						<Icon name="bottle" size={48} color={C.secondaryPurple} />
						<Text style={{ color: C.mutedText, fontWeight: "600", fontSize: 15, marginTop: 14, marginBottom: 12 }}>
							No bottles logged yet
						</Text>
						<TouchableOpacity
							onPress={openAdd}
							style={[s.btnPrimary, { paddingHorizontal: 28, width: "auto" }]}>
							<Text style={s.btnPrimaryText}>Log First Bottle</Text>
						</TouchableOpacity>
					</View>
				)}

				{/* History grouped by date */}
				{grouped.map(([date, entries]) => (
					<View key={date} style={s.card}>
						<View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
							<Text style={s.sectionTitle}>{date === today ? "Today" : formatDate(date)}</Text>
							<Text style={{ fontSize: 13, color: C.primaryPurple, fontWeight: "700" }}>
								{entries.reduce((sum, e) => sum + toMl(e.amount, e.unit), 0)} ml total
							</Text>
						</View>
						{entries.map((e, i) => {
							const t = typeStyle(e.type);
							return (
								<View
									key={e.id}
									style={{
										flexDirection: "row",
										alignItems: "center",
										paddingVertical: 12,
										borderBottomWidth: i < entries.length - 1 ? 1 : 0,
										borderBottomColor: C.borderLight,
										gap: 12,
									}}>
									{/* Time + type indicator */}
									<View style={{ alignItems: "center", minWidth: 44 }}>
										<View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: t.bg, alignItems: "center", justifyContent: "center" }}>
											<Icon name="bottle" size={18} color={t.color} />
										</View>
										<Text style={{ fontSize: 10, color: C.mutedText, fontWeight: "600", marginTop: 3 }}>
											{formatTime(e.time)}
										</Text>
									</View>

									{/* Details */}
									<View style={{ flex: 1 }}>
										<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
											<Text style={{ fontWeight: "700", fontSize: 15, color: C.primaryPinkDark }}>
												{e.amount} {e.unit}
											</Text>
											<View style={{ backgroundColor: t.bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
												<Text style={{ fontSize: 10, fontWeight: "700", color: t.color }}>{t.label}</Text>
											</View>
										</View>
										{e.unit === "oz" && (
											<Text style={{ fontSize: 11, color: C.mutedText, marginTop: 1 }}>
												≈ {toMl(e.amount, e.unit)} ml
											</Text>
										)}
										{e.notes ? (
											<Text style={{ fontSize: 12, color: C.mutedText, marginTop: 3 }}>{e.notes}</Text>
										) : null}
									</View>

									{/* Actions */}
									<View style={{ flexDirection: "row", gap: 6 }}>
										<TouchableOpacity
											onPress={() => openEdit(e)}
											style={{ backgroundColor: C.bgPurple, borderRadius: 10, padding: 8 }}>
											<Icon name="edit" size={14} color={C.primaryPurple} />
										</TouchableOpacity>
										<TouchableOpacity
											onPress={() =>
												Alert.alert("Delete", "Remove this bottle entry?", [
													{ text: "Cancel" },
													{ text: "Delete", style: "destructive", onPress: () => onDelete(e.id) },
												])
											}
											style={{ backgroundColor: C.statRedBg, borderRadius: 10, padding: 8 }}>
											<Icon name="trash" size={14} color="#c0392b" />
										</TouchableOpacity>
									</View>
								</View>
							);
						})}
					</View>
				))}
			</ScrollView>

			{/* Add / Edit Modal */}
			<Modal
				visible={modalVisible}
				transparent
				animationType="slide"
				onRequestClose={() => setModalVisible(false)}>
				<KeyboardAvoidingView
					behavior={Platform.OS === "ios" ? "padding" : "height"}
					style={s.modalOverlay}>
					<View style={s.modalSheet}>
						<View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
							<Text style={s.modalTitle}>{editTarget ? "Edit Bottle" : "Log Bottle"}</Text>
							<TouchableOpacity
								onPress={() => setModalVisible(false)}
								style={{ backgroundColor: C.bgPurple, borderRadius: 10, padding: 8 }}>
								<Icon name="close" size={16} color={C.mutedText} />
							</TouchableOpacity>
						</View>

						<ScrollView showsVerticalScrollIndicator={false}>
							<View style={{ gap: 18, paddingBottom: 20 }}>
								{/* Date */}
								<DateField
									label="Date"
									value={form.date}
									onChange={(v) => set("date", v)}
									minYear={2020}
									maxYear={new Date().getFullYear()}
								/>

								{/* Time */}
								<View>
									<Text style={s.label}>Time</Text>
									<View style={{ flexDirection: "row", gap: 10 }}>
										<TouchableOpacity
											onPress={() => setShowHourPicker(true)}
											style={[s.input, { flex: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}>
											<Text style={{ color: C.textCharcoal, fontWeight: "600" }}>{form.hour}</Text>
											<Icon name="chevDown" size={14} color={C.mutedText} />
										</TouchableOpacity>
										<View style={{ justifyContent: "center" }}>
											<Text style={{ fontWeight: "700", color: C.mutedText, fontSize: 18 }}>:</Text>
										</View>
										<TouchableOpacity
											onPress={() => setShowMinutePicker(true)}
											style={[s.input, { flex: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}>
											<Text style={{ color: C.textCharcoal, fontWeight: "600" }}>{form.minute}</Text>
											<Icon name="chevDown" size={14} color={C.mutedText} />
										</TouchableOpacity>
									</View>
								</View>

								{/* Milk type */}
								<View>
									<Text style={s.label}>Milk Type</Text>
									<View style={{ flexDirection: "row", gap: 8 }}>
										{MILK_TYPES.map((t) => {
											const sel = form.type === t.id;
											return (
												<TouchableOpacity
													key={t.id}
													onPress={() => set("type", t.id)}
													style={{
														flex: 1,
														alignItems: "center",
														paddingVertical: 12,
														borderRadius: 14,
														backgroundColor: sel ? t.bg : C.bgPurple,
														borderWidth: 2,
														borderColor: sel ? t.color : "transparent",
													}}
													activeOpacity={0.8}>
													<Icon name="drop" size={18} color={sel ? t.color : C.mutedText} />
													<Text
														style={{
															fontSize: 10,
															fontWeight: "700",
															color: sel ? t.color : C.mutedText,
															marginTop: 4,
															textAlign: "center",
														}}>
														{t.label}
													</Text>
												</TouchableOpacity>
											);
										})}
									</View>
								</View>

								{/* Amount + unit */}
								<View>
									<Text style={s.label}>Amount</Text>
									<View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
										<TextInput
											value={form.amount}
											onChangeText={(v) => set("amount", v)}
											placeholder="e.g. 150"
											keyboardType="decimal-pad"
											style={[s.input, { flex: 1, backgroundColor: C.white }]}
											placeholderTextColor={C.mutedText}
										/>
										<View style={{ flexDirection: "row", borderRadius: 12, overflow: "hidden", borderWidth: 1.5, borderColor: C.borderLight }}>
											{["ml", "oz"].map((u) => (
												<TouchableOpacity
													key={u}
													onPress={() => set("unit", u)}
													style={{
														paddingHorizontal: 18,
														paddingVertical: 12,
														backgroundColor: form.unit === u ? C.primaryPurple : C.white,
													}}>
													<Text
														style={{
															fontWeight: "700",
															fontSize: 14,
															color: form.unit === u ? C.white : C.mutedText,
														}}>
														{u}
													</Text>
												</TouchableOpacity>
											))}
										</View>
									</View>
									{form.amount && form.unit === "oz" && (
										<Text style={{ fontSize: 12, color: C.mutedText, marginTop: 6 }}>
											≈ {toMl(form.amount, "oz")} ml
										</Text>
									)}
								</View>

								{/* Notes */}
								<View>
									<Text style={s.label}>Notes (optional)</Text>
									<TextInput
										value={form.notes}
										onChangeText={(v) => set("notes", v)}
										placeholder="Any observations…"
										multiline
										numberOfLines={2}
										style={[s.input, { height: 70, textAlignVertical: "top", backgroundColor: C.white }]}
										placeholderTextColor={C.mutedText}
									/>
								</View>

								<TouchableOpacity onPress={save} style={s.btnPrimary} activeOpacity={0.8}>
									<Text style={s.btnPrimaryText}>{editTarget ? "Update" : "Save Bottle"}</Text>
								</TouchableOpacity>
							</View>
						</ScrollView>

						<PickerModal
							visible={showHourPicker}
							title="Hour"
							options={buildHours()}
							value={form.hour}
							onSelect={(v) => set("hour", v)}
							onClose={() => setShowHourPicker(false)}
						/>
						<PickerModal
							visible={showMinutePicker}
							title="Minute"
							options={buildMinutes()}
							value={form.minute}
							onSelect={(v) => set("minute", v)}
							onClose={() => setShowMinutePicker(false)}
						/>
					</View>
				</KeyboardAvoidingView>
			</Modal>
		</View>
	);
}
