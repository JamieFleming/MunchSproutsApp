import React, { useState, useMemo, useEffect } from "react";
import {
	View, Text, TextInput, TouchableOpacity, ScrollView,
	Modal, KeyboardAvoidingView, Platform, Alert,
} from "react-native";
import { useTheme, useStyles } from "../ThemeContext";
import { Icon } from "../components/Icon";
import { PickerModal } from "../components/PickerModal";
import { DateField } from "../components/DatePickerModal";
import { formatDate, formatTime, toMl, buildHours, buildMinutes } from "../helpers";

// ── Constants ─────────────────────────────────────────────────────────────────

const MILK_TYPES = [
	{ id: "formula",     label: "Formula",     color: "#2a5f8f", bg: "#d4e8f5" },
	{ id: "breast",      label: "Breast Milk", color: "#7a2d6a", bg: "#f5d4f0" },
	{ id: "specialised", label: "Specialised", color: "#a85a1a", bg: "#fde8cc" },
];

const SYMPTOMS = [
	{ id: "reflux",     label: "Spit-up / Reflux", icon: "reflux",    color: "#c0392b", bg: "#fdecea" },
	{ id: "fussiness",  label: "Fussiness",         icon: "fussiness", color: "#e67e22", bg: "#fef0e6" },
	{ id: "wind",       label: "Wind",               icon: "windGas",   color: "#2980b9", bg: "#e8f4fb" },
	{ id: "discomfort", label: "Discomfort",         icon: "discomfort",color: "#8e44ad", bg: "#f5eef8" },
	{ id: "other",      label: "Other",              icon: "more",      color: "#555",    bg: "#f0f0f0" },
];

const SPECIALISED_FORMULAS = [
	{
		group: "Anti-Reflux",
		options: [
			{ id: "aptamil-ar",  label: "Aptamil Anti-Reflux" },
			{ id: "sma-ar",      label: "SMA Anti-Reflux" },
			{ id: "cow-gate-ar", label: "Cow & Gate Anti-Reflux" },
		],
	},
	{
		group: "Comfort",
		options: [
			{ id: "aptamil-comfort", label: "Aptamil Comfort" },
			{ id: "sma-comfort",     label: "SMA Comfort" },
		],
	},
	{
		group: "Hypoallergenic",
		options: [
			{ id: "nutramigen-lgg", label: "Nutramigen LGG" },
			{ id: "alfamino",       label: "Alfamino" },
		],
	},
	{
		group: "Other",
		options: [{ id: "other", label: "Other (custom)" }],
	},
];

const FORMULA_MAP = SPECIALISED_FORMULAS.flatMap((g) => g.options).reduce((acc, o) => ({ ...acc, [o.id]: o.label }), {});

const BREAST_SIDES = [
	{ id: "left",      label: "Left Breast",  short: "Left",      symbol: "L"   },
	{ id: "right",     label: "Right Breast", short: "Right",     symbol: "R"   },
	{ id: "both",      label: "Both Breasts", short: "Both",      symbol: "L·R" },
	{ id: "expressed", label: "Expressed",    short: "Expressed", symbol: "~"   },
];

const DURATION_CHIPS = ["5", "10", "15", "20", "30", "45"];

function typeStyle(id) { return MILK_TYPES.find((t) => t.id === id) || MILK_TYPES[0]; }
function nowTime()     { const n = new Date(); return `${String(n.getHours()).padStart(2, "0")}:${String(Math.floor(n.getMinutes() / 5) * 5).padStart(2, "0")}`; }
function todayDate()   { return new Date().toISOString().split("T")[0]; }
function formulaDisplayLabel(brand, custom) {
	if (!brand) return null;
	if (brand === "other") return custom || "Other";
	return FORMULA_MAP[brand] || brand;
}

const EMPTY_FORM = {
	date: todayDate(),
	hour: String(new Date().getHours()).padStart(2, "0"),
	minute: String(Math.floor(new Date().getMinutes() / 5) * 5).padStart(2, "0"),
	type: "formula", breastSide: "", durationMins: "",
	formulaBrand: "", formulaCustom: "",
	amount: "", unit: "ml",
	symptoms: [], symptomOther: "", notes: "",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function SymptomRow({ sym, selected, onPress, isFirst }) {
	const { C } = useTheme();
	return (
		<TouchableOpacity
			onPress={onPress}
			activeOpacity={0.75}
			style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, gap: 14, borderTopWidth: isFirst ? 0 : 1, borderTopColor: C.borderLight, backgroundColor: selected ? sym.bg : C.white }}>
			<View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: selected ? sym.color + "22" : C.bgPurple, alignItems: "center", justifyContent: "center" }}>
				<Icon name={sym.icon} size={20} color={selected ? sym.color : C.mutedText} />
			</View>
			<Text style={{ flex: 1, fontSize: 15, fontWeight: selected ? "700" : "500", color: selected ? sym.color : C.textCharcoal }}>{sym.label}</Text>
			<View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: selected ? sym.color : C.borderLight, backgroundColor: selected ? sym.color : "transparent", alignItems: "center", justifyContent: "center" }}>
				{selected && <Icon name="check" size={12} color="#ffffff" />}
			</View>
		</TouchableOpacity>
	);
}

function BreastSideBtn({ side, selected, onPress }) {
	const { C } = useTheme();
	const isExpressed = side.id === "expressed";
	return (
		<TouchableOpacity
			onPress={onPress}
			activeOpacity={0.8}
			style={{ width: "47%", alignItems: "center", paddingVertical: 14, borderRadius: 14, backgroundColor: selected ? "#f5d4f0" : C.bgPurple, borderWidth: 2, borderColor: selected ? "#7a2d6a" : "transparent", gap: 6 }}>
			{isExpressed ? (
				<Icon name="drop" size={20} color={selected ? "#7a2d6a" : C.mutedText} />
			) : (
				<View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: selected ? "#7a2d6a22" : C.borderLight, alignItems: "center", justifyContent: "center" }}>
					<Text style={{ fontSize: 11, fontWeight: "800", color: selected ? "#7a2d6a" : C.mutedText }}>{side.symbol}</Text>
				</View>
			)}
			<Text style={{ fontSize: 12, fontWeight: "700", color: selected ? "#7a2d6a" : C.mutedText, textAlign: "center" }}>{side.label}</Text>
		</TouchableOpacity>
	);
}

function BottleEntryRow({ entry: e, today, onEdit, onDelete }) {
	const { C } = useTheme();
	const t = typeStyle(e.type);
	return (
		<View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 12 }}>
			{/* Time + type icon */}
			<View style={{ alignItems: "center", minWidth: 44 }}>
				<View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: t.bg, alignItems: "center", justifyContent: "center" }}>
					<Icon name="bottle" size={18} color={t.color} />
				</View>
				<Text style={{ fontSize: 10, color: C.mutedText, fontWeight: "600", marginTop: 3 }}>{formatTime(e.time)}</Text>
			</View>

			{/* Details */}
			<View style={{ flex: 1 }}>
				<View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
					<Text style={{ fontWeight: "700", fontSize: 15, color: C.primaryPinkDark }}>{e.amount != null ? `${e.amount} ${e.unit}` : "—"}</Text>
					<View style={{ backgroundColor: t.bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
						<Text style={{ fontSize: 10, fontWeight: "700", color: t.color }}>{t.label}</Text>
					</View>
					{e.type === "breast" && e.breastSide && (() => {
						const bs = BREAST_SIDES.find((s) => s.id === e.breastSide);
						return bs ? (
							<View style={{ backgroundColor: "#f5d4f0", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
								<Text style={{ fontSize: 10, fontWeight: "700", color: "#7a2d6a" }}>{bs.short}</Text>
							</View>
						) : null;
					})()}
					{e.type === "specialised" && e.formulaBrand && (() => {
						const label = formulaDisplayLabel(e.formulaBrand, e.formulaCustom);
						return label ? (
							<View style={{ backgroundColor: "#fde8cc", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
								<Text style={{ fontSize: 10, fontWeight: "700", color: "#a85a1a" }}>{label}</Text>
							</View>
						) : null;
					})()}
				</View>
				{e.amount != null && e.unit === "oz" && <Text style={{ fontSize: 11, color: C.mutedText, marginTop: 1 }}>≈ {toMl(e.amount, e.unit)} ml</Text>}
				{e.type === "breast" && e.durationMins ? (
					<Text style={{ fontSize: 11, color: "#7a2d6a", fontWeight: "600", marginTop: 2 }}>⏱ {e.durationMins} min{e.durationMins !== 1 ? "s" : ""} on breast</Text>
				) : null}
				{e.notes ? <Text style={{ fontSize: 12, color: C.mutedText, marginTop: 3 }}>{e.notes}</Text> : null}
				{Array.isArray(e.symptoms) && e.symptoms.length > 0 && (
					<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
						{e.symptoms.map((sid) => {
							const sym = SYMPTOMS.find((s) => s.id === sid);
							if (!sym) return null;
							const label = sid === "other" && e.symptomOther ? e.symptomOther : sym.label;
							return (
								<View key={sid} style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: sym.bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
									<Icon name={sym.icon} size={10} color={sym.color} />
									<Text style={{ fontSize: 10, fontWeight: "700", color: sym.color }}>{label}</Text>
								</View>
							);
						})}
					</View>
				)}
			</View>

			{/* Actions */}
			<View style={{ flexDirection: "row", gap: 6 }}>
				<TouchableOpacity onPress={() => onEdit(e)} style={{ backgroundColor: C.bgPurple, borderRadius: 10, padding: 8 }}>
					<Icon name="edit" size={14} color={C.primaryPurple} />
				</TouchableOpacity>
				<TouchableOpacity
					onPress={() => Alert.alert("Delete", "Remove this bottle entry?", [{ text: "Cancel" }, { text: "Delete", style: "destructive", onPress: () => onDelete(e.id) }])}
					style={{ backgroundColor: C.statRedBg, borderRadius: 10, padding: 8 }}>
					<Icon name="trash" size={14} color="#c0392b" />
				</TouchableOpacity>
			</View>
		</View>
	);
}

// ── Screen ────────────────────────────────────────────────────────────────────

export function BottleScreen({ bottleLog, childName, onAdd, onEdit, onDelete, quickAdd, onQuickAddConsumed, isPro = false, onUpgradePro }) {
	const { C } = useTheme();
	const s = useStyles();

	const [modalVisible,     setModalVisible]     = useState(false);
	const [editTarget,       setEditTarget]       = useState(null);
	const [form,             setForm]             = useState(EMPTY_FORM);
	const [showHourPicker,   setShowHourPicker]   = useState(false);
	const [showMinutePicker, setShowMinutePicker] = useState(false);
	const [showFormulaPicker,setShowFormulaPicker]= useState(false);

	const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

	const openAdd = () => {
		setForm({ ...EMPTY_FORM, date: todayDate(), hour: String(new Date().getHours()).padStart(2, "0"), minute: String(Math.floor(new Date().getMinutes() / 5) * 5).padStart(2, "0") });
		setEditTarget(null);
		setModalVisible(true);
	};

	useEffect(() => {
		if (quickAdd) { openAdd(); onQuickAddConsumed?.(); }
	}, [quickAdd]);

	const openEdit = (entry) => {
		const [h, m] = (entry.time || "12:00").split(":");
		setForm({
			date: entry.date || todayDate(), hour: h || "12", minute: m || "00",
			type: entry.type || "formula", breastSide: entry.breastSide || "",
			durationMins: String(entry.durationMins || ""),
			formulaBrand: entry.formulaBrand || "", formulaCustom: entry.formulaCustom || "",
			amount: String(entry.amount || ""), unit: entry.unit || "ml",
			symptoms: Array.isArray(entry.symptoms) ? entry.symptoms : [],
			symptomOther: entry.symptomOther || "", notes: entry.notes || "",
		});
		setEditTarget(entry);
		setModalVisible(true);
	};

	const save = () => {
		const isDirectBreast = form.type === "breast" && form.breastSide && form.breastSide !== "expressed";
		const hasDuration    = isDirectBreast && !!form.durationMins;
		const hasAmount      = form.amount && !isNaN(parseFloat(form.amount));

		if (!hasAmount && !hasDuration) {
			Alert.alert("Missing info", isDirectBreast
				? "Please enter either the amount given or the time spent on the breast."
				: "Please enter how much milk was given.");
			return;
		}
		const data = {
			date: form.date, time: `${form.hour}:${form.minute}`, type: form.type,
			breastSide:    form.type === "breast" ? form.breastSide : "",
			durationMins:  isDirectBreast && form.durationMins ? parseInt(form.durationMins, 10) : null,
			formulaBrand:  form.type === "specialised" ? form.formulaBrand : "",
			formulaCustom: form.type === "specialised" && form.formulaBrand === "other" ? form.formulaCustom.trim() : "",
			amount:        hasAmount ? parseFloat(form.amount) : null,
			unit:          form.unit,
			symptoms:      form.symptoms,
			symptomOther:  form.symptoms.includes("other") ? form.symptomOther.trim() : "",
			notes:         form.notes.trim(),
		};
		editTarget ? onEdit({ ...editTarget, ...data }) : onAdd(data);
		setModalVisible(false);
	};

	const grouped = useMemo(() => {
		const sorted = [...bottleLog].sort((a, b) => {
			const da = `${a.date || ""}T${a.time || "00:00"}`;
			const db = `${b.date || ""}T${b.time || "00:00"}`;
			return db.localeCompare(da);
		});
		const map = {};
		sorted.forEach((e) => { const d = e.date || "Unknown"; if (!map[d]) map[d] = []; map[d].push(e); });
		return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
	}, [bottleLog]);

	const today         = todayDate();
	const todayEntries  = bottleLog.filter((e) => e.date === today);
	const todayTotalMl  = todayEntries.reduce((sum, e) => sum + (e.amount != null ? toMl(e.amount, e.unit) : 0), 0);

	return (
		<View style={{ flex: 1 }}>
			{/* ── Header ── */}
			<View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
				<Text style={s.pageTitle}>Bottle Log</Text>
				<TouchableOpacity onPress={openAdd} style={[s.btnPrimary, { paddingHorizontal: 18, width: "auto", paddingVertical: 10 }]}>
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
						<Text style={{ fontSize: 12, fontWeight: "700", color: "#2a5f8f", textTransform: "uppercase", letterSpacing: 0.5 }}>Today{childName ? ` · ${childName}` : ""}</Text>
						<Text style={{ fontSize: 26, fontWeight: "800", color: "#2a5f8f", marginTop: 2 }}>{todayTotalMl} ml</Text>
						<Text style={{ fontSize: 12, color: "#2a5f8f99", marginTop: 2 }}>
							{todayEntries.length === 0 ? "No feeds logged yet" : `${todayEntries.length} feed${todayEntries.length !== 1 ? "s" : ""} today`}
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
						<Text style={{ color: C.mutedText, fontWeight: "600", fontSize: 15, marginTop: 14, marginBottom: 12 }}>No bottles logged yet</Text>
						<TouchableOpacity onPress={openAdd} style={[s.btnPrimary, { paddingHorizontal: 28, width: "auto" }]}>
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
								{entries.reduce((sum, e) => sum + (e.amount != null ? toMl(e.amount, e.unit) : 0), 0)} ml total
							</Text>
						</View>
						{entries.map((e, i) => (
							<View key={e.id} style={{ borderBottomWidth: i < entries.length - 1 ? 1 : 0, borderBottomColor: C.borderLight }}>
								<BottleEntryRow entry={e} today={today} onEdit={openEdit} onDelete={onDelete} />
							</View>
						))}
					</View>
				))}
			</ScrollView>

			{/* ── Add/Edit Modal ── */}
			<Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
				<KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={s.modalOverlay}>
					<View style={s.modalSheet}>
						<View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
							<Text style={s.modalTitle}>{editTarget ? "Edit Bottle" : "Log Bottle"}</Text>
							<TouchableOpacity onPress={() => setModalVisible(false)} style={{ backgroundColor: C.bgPurple, borderRadius: 10, padding: 8 }}>
								<Icon name="close" size={16} color={C.mutedText} />
							</TouchableOpacity>
						</View>

						<ScrollView showsVerticalScrollIndicator={false}>
							<View style={{ gap: 18, paddingBottom: 20 }}>
								{/* Date */}
								<DateField label="Date" value={form.date} onChange={(v) => set("date", v)} minYear={2020} maxYear={new Date().getFullYear()} />

								{/* Time */}
								<View>
									<Text style={s.label}>Time</Text>
									<View style={{ flexDirection: "row", gap: 10 }}>
										<TouchableOpacity onPress={() => setShowHourPicker(true)} style={[s.input, { flex: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}>
											<Text style={{ color: C.textCharcoal, fontWeight: "600" }}>{form.hour}</Text>
											<Icon name="chevDown" size={14} color={C.mutedText} />
										</TouchableOpacity>
										<View style={{ justifyContent: "center" }}>
											<Text style={{ fontWeight: "700", color: C.mutedText, fontSize: 18 }}>:</Text>
										</View>
										<TouchableOpacity onPress={() => setShowMinutePicker(true)} style={[s.input, { flex: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}>
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
													style={{ flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 14, backgroundColor: sel ? t.bg : C.bgPurple, borderWidth: 2, borderColor: sel ? t.color : "transparent" }}
													activeOpacity={0.8}>
													<Icon name="drop" size={18} color={sel ? t.color : C.mutedText} />
													<Text style={{ fontSize: 10, fontWeight: "700", color: sel ? t.color : C.mutedText, marginTop: 4, textAlign: "center" }}>{t.label}</Text>
												</TouchableOpacity>
											);
										})}
									</View>
								</View>

								{/* Specialised formula picker */}
								{form.type === "specialised" && (
									<View>
										<Text style={s.label}>Formula / Specialised Milk</Text>
										<TouchableOpacity
											onPress={() => setShowFormulaPicker(true)}
											activeOpacity={0.8}
											style={[s.input, { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: C.white, borderWidth: form.formulaBrand ? 1.5 : 1, borderColor: form.formulaBrand ? "#a85a1a" : C.borderLight }]}>
											<Text style={{ fontWeight: form.formulaBrand ? "700" : "400", color: form.formulaBrand ? "#a85a1a" : C.mutedText, fontSize: 15 }}>
												{form.formulaBrand ? formulaDisplayLabel(form.formulaBrand, form.formulaCustom) || "Select formula…" : "Select formula…"}
											</Text>
											<Icon name="chevDown" size={14} color={form.formulaBrand ? "#a85a1a" : C.mutedText} />
										</TouchableOpacity>
										{form.formulaBrand === "other" && (
											<TextInput value={form.formulaCustom} onChangeText={(v) => set("formulaCustom", v)} placeholder="Enter formula name…" style={[s.input, { marginTop: 10, backgroundColor: C.white }]} placeholderTextColor={C.mutedText} autoFocus />
										)}
									</View>
								)}

								{/* Breast side */}
								{form.type === "breast" && (
									<View>
										<Text style={s.label}>Feeding Type</Text>
										<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
											{BREAST_SIDES.map((side) => (
												<BreastSideBtn key={side.id} side={side} selected={form.breastSide === side.id} onPress={() => set("breastSide", side.id)} />
											))}
										</View>
									</View>
								)}

								{/* Duration */}
								{form.type === "breast" && form.breastSide && form.breastSide !== "expressed" && (
									<View>
										<Text style={s.label}>Time on Breast (optional)</Text>
										<View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
											{DURATION_CHIPS.map((chip) => {
												const sel = form.durationMins === chip;
												return (
													<TouchableOpacity key={chip} onPress={() => set("durationMins", sel ? "" : chip)} activeOpacity={0.75}
														style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: sel ? "#7a2d6a" : "#f5d4f0", borderWidth: 1.5, borderColor: sel ? "#7a2d6a" : "#e0b8d8" }}>
														<Text style={{ fontSize: 13, fontWeight: "700", color: sel ? "#ffffff" : "#7a2d6a" }}>{chip} mins</Text>
													</TouchableOpacity>
												);
											})}
										</View>
										<View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
											<TextInput
												value={form.durationMins}
												onChangeText={(v) => set("durationMins", v.replace(/[^0-9]/g, ""))}
												placeholder="Custom mins"
												keyboardType="number-pad"
												style={[s.input, { flex: 1, backgroundColor: C.white }]}
												placeholderTextColor={C.mutedText}
											/>
											<View style={{ backgroundColor: "#f5d4f0", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 }}>
												<Text style={{ fontWeight: "700", color: "#7a2d6a", fontSize: 14 }}>mins</Text>
											</View>
										</View>
									</View>
								)}

								{/* Amount */}
								<View>
									<Text style={s.label}>Amount</Text>
									<View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
										<TextInput value={form.amount} onChangeText={(v) => set("amount", v)} placeholder="e.g. 150" keyboardType="decimal-pad" style={[s.input, { flex: 1, backgroundColor: C.white }]} placeholderTextColor={C.mutedText} />
										<View style={{ flexDirection: "row", borderRadius: 12, overflow: "hidden", borderWidth: 1.5, borderColor: C.borderLight }}>
											{["ml", "oz"].map((u) => (
												<TouchableOpacity key={u} onPress={() => set("unit", u)} style={{ paddingHorizontal: 18, paddingVertical: 12, backgroundColor: form.unit === u ? C.primaryPurple : C.white }}>
													<Text style={{ fontWeight: "700", fontSize: 14, color: form.unit === u ? C.white : C.mutedText }}>{u}</Text>
												</TouchableOpacity>
											))}
										</View>
									</View>
									{form.amount && form.unit === "oz" && <Text style={{ fontSize: 12, color: C.mutedText, marginTop: 6 }}>≈ {toMl(form.amount, "oz")} ml</Text>}
								</View>

								{/* Notes */}
								<View>
									<Text style={s.label}>Notes (optional)</Text>
									<TextInput value={form.notes} onChangeText={(v) => set("notes", v)} placeholder="Any observations…" multiline numberOfLines={2} style={[s.input, { height: 70, textAlignVertical: "top", backgroundColor: C.white }]} placeholderTextColor={C.mutedText} />
								</View>

								{/* Symptoms — Pro only */}
								<View>
									<View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
										<Text style={s.label}>Symptoms after feeding</Text>
										{!isPro && (
											<View style={{ backgroundColor: "#e8a020", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
												<Text style={{ fontSize: 10, fontWeight: "800", color: "#fff" }}>PRO</Text>
											</View>
										)}
									</View>
									{isPro ? (
										<>
											<View style={{ backgroundColor: C.white, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: C.borderLight }}>
												{SYMPTOMS.map((sym, i) => (
													<SymptomRow
														key={sym.id}
														sym={sym}
														selected={form.symptoms.includes(sym.id)}
														isFirst={i === 0}
														onPress={() => {
															const selected = form.symptoms.includes(sym.id);
															set("symptoms", selected ? form.symptoms.filter((s) => s !== sym.id) : [...form.symptoms, sym.id]);
														}}
													/>
												))}
											</View>
											{form.symptoms.includes("other") && (
												<TextInput value={form.symptomOther} onChangeText={(v) => set("symptomOther", v)} placeholder="Describe the symptom…" style={[s.input, { marginTop: 10, backgroundColor: C.white }]} placeholderTextColor={C.mutedText} autoFocus />
											)}
										</>
									) : (
										<TouchableOpacity onPress={onUpgradePro} activeOpacity={0.85}
											style={{ backgroundColor: "#2d1f5e", borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", gap: 14 }}>
											<View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: "rgba(155,127,232,0.25)", alignItems: "center", justifyContent: "center" }}>
												<Icon name="lock" size={20} color="#9b7fe8" />
											</View>
											<View style={{ flex: 1 }}>
												<Text style={{ fontWeight: "800", fontSize: 14, color: "#ffffff", marginBottom: 3 }}>Symptom Tracking · Pro</Text>
												<Text style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", lineHeight: 17 }}>Track reflux, wind, fussiness and more after each feed. Upgrade to unlock.</Text>
											</View>
											<Icon name="chevRight" size={16} color="#9b7fe8" />
										</TouchableOpacity>
									)}
								</View>

								<TouchableOpacity onPress={save} style={s.btnPrimary} activeOpacity={0.8}>
									<Text style={s.btnPrimaryText}>{editTarget ? "Update" : "Save Bottle"}</Text>
								</TouchableOpacity>
							</View>
						</ScrollView>

						{/* Formula picker modal */}
						<Modal visible={showFormulaPicker} transparent animationType="slide" onRequestClose={() => setShowFormulaPicker(false)}>
							<TouchableOpacity style={s.pickerOverlay} onPress={() => setShowFormulaPicker(false)} activeOpacity={1}>
								<View style={[s.pickerSheet, { maxHeight: "75%" }]}>
									<Text style={s.pickerTitle}>Select Formula</Text>
									<ScrollView showsVerticalScrollIndicator={false}>
										{SPECIALISED_FORMULAS.map((group) => (
											<View key={group.group}>
												<View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 }}>
													<Text style={{ fontSize: 11, fontWeight: "800", color: "#a85a1a", textTransform: "uppercase", letterSpacing: 0.6 }}>{group.group}</Text>
												</View>
												{group.options.map((opt) => {
													const sel = form.formulaBrand === opt.id;
													return (
														<TouchableOpacity key={opt.id} onPress={() => { set("formulaBrand", opt.id); if (opt.id !== "other") set("formulaCustom", ""); setShowFormulaPicker(false); }} style={[s.pickerItem, sel && { backgroundColor: "#fde8cc" }]}>
															<Text style={[s.pickerItemText, sel && { color: "#a85a1a", fontWeight: "700" }]}>{opt.label}</Text>
															{sel && <Icon name="check" size={15} color="#a85a1a" />}
														</TouchableOpacity>
													);
												})}
											</View>
										))}
									</ScrollView>
									<TouchableOpacity onPress={() => setShowFormulaPicker(false)} style={[s.btnPrimary, { marginTop: 12 }]}>
										<Text style={s.btnPrimaryText}>Done</Text>
									</TouchableOpacity>
								</View>
							</TouchableOpacity>
						</Modal>

						<PickerModal visible={showHourPicker}   title="Hour"   options={buildHours()}   value={form.hour}   onSelect={(v) => set("hour", v)}   onClose={() => setShowHourPicker(false)} />
						<PickerModal visible={showMinutePicker} title="Minute" options={buildMinutes()} value={form.minute} onSelect={(v) => set("minute", v)} onClose={() => setShowMinutePicker(false)} />
					</View>
				</KeyboardAvoidingView>
			</Modal>
		</View>
	);
}
