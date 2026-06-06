import React, { useState, useEffect } from "react";
import {
	View, Text, TouchableOpacity, ScrollView, Modal, TextInput,
	Image, Platform, Dimensions, Alert, KeyboardAvoidingView,
} from "react-native";
import Svg, { Polyline, Circle, Line, Text as SvgText, Path } from "react-native-svg";
import { useTheme, useStyles } from "../ThemeContext";
import { Icon } from "../components/Icon";
import { ZoomableImage } from "../components/ZoomableImage";
import { DateField } from "../components/DatePickerModal";
import { calcAgeWeeks, calcAgeMonths, formatDate, toMl, formatWeight, pickImageAsBase64 } from "../helpers";
import { SmartInsightsSection } from "../components/SmartInsightsSection";

const SCREEN_W = Dimensions.get("window").width;
// Card has 18px padding each side; photos have 4px gaps; screen cards are full-width
const THUMB    = Math.floor((SCREEN_W - 76) / 3);
const GRAPH_W  = SCREEN_W - 64; // 32px padding each side
const GRAPH_H  = 170;
const PAD_L    = 42;
const PAD_B    = 28;

// ── SVG Line Graph ─────────────────────────────────────────────────────────────

function LineGraph({ data, color = "#7c3aed", unitLabel = "", emptyText = "Log at least 2 entries to see a graph" }) {
	if (!data || data.length < 2) {
		return (
			<View style={{ height: GRAPH_H, alignItems: "center", justifyContent: "center" }}>
				<Text style={{ fontSize: 12, color: "#aaa", textAlign: "center" }}>{emptyText}</Text>
			</View>
		);
	}

	const W = GRAPH_W - PAD_L;
	const H = GRAPH_H - PAD_B;

	const values = data.map((d) => d.value);
	const minV   = Math.min(...values);
	const maxV   = Math.max(...values);
	const range  = maxV - minV || 1;

	const toX = (i) => PAD_L + (i / (data.length - 1)) * W;
	const toY = (v) => H - ((v - minV) / range) * (H - 14) + 7;

	const points = data.map((d, i) => `${toX(i)},${toY(d.value)}`).join(" ");

	// Gradient-ish fill via a closed polygon
	const fillPoints =
		`${toX(0)},${H} ` +
		data.map((d, i) => `${toX(i)},${toY(d.value)}`).join(" ") +
		` ${toX(data.length - 1)},${H}`;

	// Y-axis: 3 ticks
	const tickVals = [minV, minV + range / 2, maxV];
	// X-axis: first, mid, last (deduplicated)
	const xIdxs = [...new Set([0, Math.floor((data.length - 1) / 2), data.length - 1])];

	return (
		<Svg width={GRAPH_W} height={GRAPH_H}>
			{/* Fill area under the line */}
			<Polyline points={fillPoints} fill={color + "18"} stroke="none" />

			{/* Grid lines */}
			{tickVals.map((v, i) => (
				<Line
					key={i}
					x1={PAD_L} y1={toY(v)}
					x2={GRAPH_W} y2={toY(v)}
					stroke="#e5e7eb" strokeWidth="1"
				/>
			))}

			{/* Y-axis labels */}
			{tickVals.map((v, i) => (
				<SvgText
					key={i}
					x={PAD_L - 5} y={toY(v) + 4}
					fontSize="9" fill="#aaa" textAnchor="end">
					{v.toFixed(1)}{unitLabel}
				</SvgText>
			))}

			{/* Line */}
			<Polyline
				points={points}
				fill="none"
				stroke={color}
				strokeWidth="2.5"
				strokeLinejoin="round"
				strokeLinecap="round"
			/>

			{/* Dots */}
			{data.map((d, i) => (
				<React.Fragment key={i}>
					<Circle cx={toX(i)} cy={toY(d.value)} r="5" fill="#fff" />
					<Circle cx={toX(i)} cy={toY(d.value)} r="3.5" fill={color} />
				</React.Fragment>
			))}

			{/* X-axis labels */}
			{xIdxs.map((i) => (
				<SvgText
					key={i}
					x={toX(i)} y={GRAPH_H - 4}
					fontSize="9" fill="#aaa" textAnchor="middle">
					{data[i].label}
				</SvgText>
			))}
		</Svg>
	);
}

// ── Pro lock overlay ───────────────────────────────────────────────────────────

function ProLock({ title, onUpgradePro, children }) {
	return (
		<View>
			{children}
			<View style={{
				position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
				backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 20,
				alignItems: "center", justifyContent: "center", gap: 10,
			}}>
				<View style={{ backgroundColor: "#f5c842", borderRadius: 14, width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
					<Icon name="crown" size={22} color="#2d1f5e" />
				</View>
				<Text style={{ fontWeight: "800", fontSize: 15, color: "#2d1f5e" }}>{title}</Text>
				<Text style={{ fontSize: 12, color: "#5a4a8f", textAlign: "center", paddingHorizontal: 20 }}>
					Upgrade to Pro to unlock this feature
				</Text>
				<TouchableOpacity
					onPress={onUpgradePro}
					activeOpacity={0.85}
					style={{ backgroundColor: "#2d1f5e", borderRadius: 12, paddingHorizontal: 24, paddingVertical: 11, marginTop: 4 }}>
					<Text style={{ color: "#f5c842", fontWeight: "800", fontSize: 13 }}>Unlock with Pro</Text>
				</TouchableOpacity>
			</View>
		</View>
	);
}

// ── Edit Child Modal ───────────────────────────────────────────────────────────

function EditChildModal({ visible, child, onSave, onClose }) {
	const { C } = useTheme();
	const s = useStyles();
	const [form, setForm]   = useState({ name: child.name || "", dob: child.dob || "", weaningStart: child.weaningStart || "" });
	const [photo, setPhoto] = useState(child.photoUri || "");
	const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

	const handlePickPhoto = async () => {
		const uri = await pickImageAsBase64([1, 1]);
		if (uri) setPhoto(uri);
	};

	const handleSave = () => {
		if (!form.name.trim() || !form.dob) return;
		onSave({ ...child, ...form, name: form.name.trim(), photoUri: photo });
		onClose();
	};

	return (
		<Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
			<View style={{ flex: 1, backgroundColor: C.screen }}>
				{/* Header */}
				<View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.borderLight }}>
					<TouchableOpacity onPress={onClose}>
						<Text style={{ fontSize: 16, color: C.mutedText, fontWeight: "600" }}>Cancel</Text>
					</TouchableOpacity>
					<Text style={{ fontSize: 17, fontWeight: "800", color: C.primaryPinkDark }}>Edit Child</Text>
					<TouchableOpacity onPress={handleSave}>
						<Text style={{ fontSize: 16, color: C.primaryPurple, fontWeight: "700" }}>Save</Text>
					</TouchableOpacity>
				</View>

				<ScrollView contentContainerStyle={{ padding: 20, gap: 18 }} keyboardShouldPersistTaps="handled">
					{/* Photo */}
					<View style={{ alignItems: "center", marginBottom: 4 }}>
						<TouchableOpacity onPress={handlePickPhoto} activeOpacity={0.8}>
							{photo ? (
								<Image source={{ uri: photo }} style={{ width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: C.primaryPurple + "40" }} resizeMode="cover" />
							) : (
								<View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: C.bgPurple, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: C.primaryPurple + "30" }}>
									<Icon name="Camera" size={30} color={C.secondaryPurple} />
								</View>
							)}
							<View style={{ position: "absolute", bottom: 0, right: 0, width: 30, height: 30, borderRadius: 15, backgroundColor: C.primaryPurple, alignItems: "center", justifyContent: "center" }}>
								<Icon name="edit" size={13} color="#fff" />
							</View>
						</TouchableOpacity>
						<Text style={{ fontSize: 12, color: C.mutedText, marginTop: 8 }}>Tap to change photo</Text>
					</View>

					{/* Name */}
					<View>
						<Text style={s.label}>Child's Name</Text>
						<TextInput
							value={form.name}
							onChangeText={(v) => set("name", v ? v.charAt(0).toUpperCase() + v.slice(1) : v)}
							placeholder="Name"
							style={[s.input, { backgroundColor: C.bgMain }]}
							placeholderTextColor={C.mutedText}
						/>
					</View>

					{/* DOB */}
					<DateField
						label="Date of Birth"
						value={form.dob}
						onChange={(v) => set("dob", v)}
						minYear={2018}
						maxYear={new Date().getFullYear()}
					/>

					{/* Weaning start */}
					<DateField
						label="Weaning Start Date (optional)"
						value={form.weaningStart}
						onChange={(v) => set("weaningStart", v)}
						minYear={2018}
						maxYear={new Date().getFullYear()}
					/>

					{/* Clear weaning */}
					{form.weaningStart ? (
						<TouchableOpacity onPress={() => set("weaningStart", "")}
							style={{ alignSelf: "flex-start" }}>
							<Text style={{ fontSize: 12, color: "#c0392b", fontWeight: "600" }}>Clear weaning date</Text>
						</TouchableOpacity>
					) : null}

					<TouchableOpacity
						onPress={handleSave}
						style={[s.btnPrimary, { opacity: form.name.trim() && form.dob ? 1 : 0.45 }]}
						disabled={!form.name.trim() || !form.dob}>
						<Text style={s.btnPrimaryText}>Save Changes</Text>
					</TouchableOpacity>
				</ScrollView>
			</View>
		</Modal>
	);
}

// ── Edit Weight Modal ─────────────────────────────────────────────────────────

function EditWeightModal({ visible, entry, weightPreference, onSave, onDelete, onClose }) {
	const { C } = useTheme();
	const s = useStyles();

	// Pre-populate from existing entry (value_kg → preferred display unit)
	const initFields = () => {
		if (!entry) return { lb: "", oz: "", kg: "", date: "", unit: weightPreference };
		const date = entry.date || "";
		if (weightPreference === "kg") {
			return { lb: "", oz: "", kg: String(Math.round(entry.value_kg * 100) / 100), date, unit: "kg" };
		}
		const totalOz = Math.round(entry.value_kg * 35.27396);
		return {
			lb: String(Math.floor(totalOz / 16)),
			oz: String(totalOz % 16),
			kg: "",
			date,
			unit: "lbs",
		};
	};

	const [fields, setFields] = useState(initFields);
	const set = (k, v) => setFields((p) => ({ ...p, [k]: v }));

	// Re-populate every time a different entry is opened
	useEffect(() => {
		if (visible && entry) setFields(initFields());
	}, [entry?.id, visible]);

	const handleSave = () => {
		let value_kg = null;
		if (fields.unit === "lbs") {
			const lb = parseFloat(fields.lb) || 0;
			const oz = parseFloat(fields.oz) || 0;
			if (lb === 0 && oz === 0) return;
			value_kg = Math.round(((lb + oz / 16) / 2.20462) * 1000) / 1000;
		} else {
			const kg = parseFloat(fields.kg);
			if (!kg || isNaN(kg)) return;
			value_kg = Math.round(kg * 1000) / 1000;
		}
		onSave(entry.id, { value_kg, date: fields.date });
		onClose();
	};

	const handleDelete = () => {
		Alert.alert("Delete Entry", "Remove this weight entry?", [
			{ text: "Cancel", style: "cancel" },
			{ text: "Delete", style: "destructive", onPress: () => { onDelete(entry.id); onClose(); } },
		]);
	};

	const hasValue = fields.unit === "lbs"
		? (parseFloat(fields.lb) || 0) + (parseFloat(fields.oz) || 0) > 0
		: parseFloat(fields.kg) > 0;

	if (!entry) return null;

	return (
		<Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
			<KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" }}>
				<View style={[s.modalSheet, { gap: 16 }]}>
					{/* Header */}
					<View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
						<Text style={s.modalTitle}>Edit Weight</Text>
						<TouchableOpacity onPress={onClose} style={{ backgroundColor: C.bgPurple, borderRadius: 10, padding: 8 }}>
							<Icon name="close" size={16} color={C.mutedText} />
						</TouchableOpacity>
					</View>

					<ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
						<View style={{ gap: 16, paddingBottom: 8 }}>
							{/* Date */}
							<DateField
								label="Date"
								value={fields.date}
								onChange={(v) => set("date", v)}
								minYear={2018}
								maxYear={new Date().getFullYear()}
							/>

							{/* Unit toggle */}
							<View>
								<Text style={s.label}>Weight</Text>
								<View style={{ flexDirection: "row", backgroundColor: C.bgPurple, borderRadius: 10, overflow: "hidden", marginBottom: 10 }}>
									{["lbs", "kg"].map((u) => (
										<TouchableOpacity
											key={u}
											onPress={() => set("unit", u)}
											style={{ flex: 1, paddingVertical: 10, alignItems: "center", backgroundColor: fields.unit === u ? C.primaryPurple : "transparent" }}>
											<Text style={{ fontWeight: "700", fontSize: 13, color: fields.unit === u ? C.white : C.mutedText }}>{u}</Text>
										</TouchableOpacity>
									))}
								</View>

								{fields.unit === "lbs" ? (
									<View style={{ flexDirection: "row", gap: 10 }}>
										<View style={{ flex: 1 }}>
											<TextInput
												value={fields.lb}
												onChangeText={(v) => set("lb", v)}
												placeholder="0"
												keyboardType="number-pad"
												style={[s.input, { backgroundColor: C.bgMain, textAlign: "center" }]}
												placeholderTextColor={C.mutedText}
											/>
											<Text style={{ fontSize: 11, color: C.mutedText, textAlign: "center", marginTop: 4 }}>pounds (lb)</Text>
										</View>
										<View style={{ flex: 1 }}>
											<TextInput
												value={fields.oz}
												onChangeText={(v) => set("oz", v)}
												placeholder="0"
												keyboardType="number-pad"
												style={[s.input, { backgroundColor: C.bgMain, textAlign: "center" }]}
												placeholderTextColor={C.mutedText}
											/>
											<Text style={{ fontSize: 11, color: C.mutedText, textAlign: "center", marginTop: 4 }}>ounces (oz)</Text>
										</View>
									</View>
								) : (
									<View>
										<TextInput
											value={fields.kg}
											onChangeText={(v) => set("kg", v)}
											placeholder="e.g. 7.5"
											keyboardType="decimal-pad"
											style={[s.input, { backgroundColor: C.bgMain }]}
											placeholderTextColor={C.mutedText}
										/>
										<Text style={{ fontSize: 11, color: C.mutedText, marginTop: 4 }}>kilograms (kg)</Text>
									</View>
								)}
							</View>

							{/* Actions */}
							<TouchableOpacity
								onPress={handleSave}
								disabled={!hasValue || !fields.date}
								style={[s.btnPrimary, { opacity: hasValue && fields.date ? 1 : 0.45 }]}>
								<Text style={s.btnPrimaryText}>Save Changes</Text>
							</TouchableOpacity>

							<TouchableOpacity
								onPress={handleDelete}
								style={{ alignItems: "center", paddingVertical: 12 }}>
								<Text style={{ fontSize: 14, fontWeight: "700", color: "#c0392b" }}>Delete Entry</Text>
							</TouchableOpacity>
						</View>
					</ScrollView>
				</View>
			</KeyboardAvoidingView>
		</Modal>
	);
}

// ── Main Screen ────────────────────────────────────────────────────────────────

export function ChildDetailScreen({
	child,
	weightLog = [],
	bottleLog = [],
	foodLog = [],
	weightPreference = "lbs",
	isPro = false,
	user,
	onUpgradePro,
	onBack,
	onEdit,
	onUpdateWeight,
	onDeleteWeight,
}) {
	const { C } = useTheme();
	const s = useStyles();
	const [showEdit,        setShowEdit]        = useState(false);
	const [editWeightEntry, setEditWeightEntry] = useState(null);
	const [lightboxPhoto,   setLightboxPhoto]   = useState(null);

	const weeks  = calcAgeWeeks(child.dob);
	const months = calcAgeMonths(child.dob);

	// ── Weight graph data ────────────────────────────────────────────────────────
	const graphUnit  = weightPreference === "kg" ? "kg" : "lb";
	const toDisplay  = (kg) =>
		weightPreference === "kg"
			? Math.round(kg * 100) / 100
			: Math.round(kg * 2.20462 * 100) / 100;

	const weightGraphData = [...weightLog]
		.filter((w) => w.value_kg)
		.sort((a, b) => (a.date || "").localeCompare(b.date || ""))
		.map((w) => ({
			value: toDisplay(w.value_kg),
			label: (w.date || "").slice(5),
			id:    w.id,
			date:  w.date,
			value_kg: w.value_kg,
		}));

	const latestWeight = weightGraphData[weightGraphData.length - 1] || null;

	// ── Milk graph data — daily totals last 14 days ─────────────────────────────
	const today = new Date();
	const milkGraphData = Array.from({ length: 14 }, (_, i) => {
		const d = new Date(today);
		d.setDate(today.getDate() - (13 - i));
		const dateStr = d.toISOString().split("T")[0];
		const total   = bottleLog
			.filter((e) => e.date === dateStr)
			.reduce((sum, e) => sum + toMl(e.amount, e.unit), 0);
		return { value: total, label: dateStr.slice(5) };
	}).filter((_, i, arr) => {
		// only keep days from when first entry exists
		const firstNonZero = arr.findIndex((p) => p.value > 0);
		return firstNonZero === -1 || i >= firstNonZero;
	});

	// ── Photos ──────────────────────────────────────────────────────────────────
	const photoEntries = [...foodLog]
		.filter((e) => !!e.photoUri)
		.sort((a, b) => new Date(b.date) - new Date(a.date));

	return (
		<View style={{ flex: 1 }}>
			{/* ── Header ── */}
			<View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
				<View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
					<TouchableOpacity
						onPress={onBack}
						style={{ backgroundColor: C.bgPurple, borderRadius: 10, padding: 8 }}>
						<View style={{ transform: [{ rotate: "180deg" }] }}>
							<Icon name="chevRight" size={18} color={C.primaryPurple} />
						</View>
					</TouchableOpacity>
					<Text style={s.pageTitle}>{child.name}</Text>
				</View>
				<TouchableOpacity
					onPress={() => setShowEdit(true)}
					style={{ backgroundColor: C.bgPurple, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 6 }}>
					<Icon name="edit" size={14} color={C.primaryPurple} />
					<Text style={{ fontSize: 13, fontWeight: "700", color: C.primaryPurple }}>Edit</Text>
				</TouchableOpacity>
			</View>

			<ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 18, paddingBottom: 36 }}>

				{/* ── Child info card ── */}
				<View style={[s.card, { flexDirection: "row", alignItems: "center", gap: 16 }]}>
					{child.photoUri ? (
						<Image
							source={{ uri: child.photoUri }}
							style={{ width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: C.primaryPurple + "30" }}
							resizeMode="cover"
						/>
					) : (
						<View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: C.primaryPurple + "18", alignItems: "center", justifyContent: "center" }}>
							<Icon name="users" size={30} color={C.primaryPurple} />
						</View>
					)}
					<View style={{ flex: 1, gap: 5 }}>
						<Text style={{ fontWeight: "800", fontSize: 20, color: C.primaryPinkDark }}>{child.name}</Text>
						<Text style={{ fontSize: 12, color: C.mutedText }}>Born {formatDate(child.dob)}</Text>
						<View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
							{weeks !== null && (
								<>
									<View style={{ backgroundColor: C.bgPurple, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
										<Text style={{ fontSize: 11, fontWeight: "700", color: C.primaryPurple }}>{weeks}w</Text>
									</View>
									<View style={{ backgroundColor: C.bgPurple, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
										<Text style={{ fontSize: 11, fontWeight: "700", color: C.primaryPurple }}>{months}mo</Text>
									</View>
								</>
							)}
							{latestWeight && (
								<View style={{ backgroundColor: "#e6f7ef", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
									<Text style={{ fontSize: 11, fontWeight: "700", color: "#2d7a55" }}>
										{formatWeight(latestWeight.value_kg, weightPreference)}
									</Text>
								</View>
							)}
						</View>
						{child.weaningStart && (
							<Text style={{ fontSize: 11, color: C.mutedText }}>Weaning since {formatDate(child.weaningStart)}</Text>
						)}
					</View>
				</View>

				{/* ── Weight graph ── */}
				<View style={s.card}>
					<View style={{ marginBottom: 16 }}>
						<Text style={s.sectionTitle}>Weight Over Time</Text>
						{latestWeight ? (
							<Text style={{ fontSize: 12, color: C.mutedText, marginTop: 3 }}>
								Latest: <Text style={{ fontWeight: "700", color: C.primaryPurple }}>
									{formatWeight(latestWeight.value_kg, weightPreference)}
								</Text> · {formatDate(latestWeight.date)}
							</Text>
						) : (
							<Text style={{ fontSize: 12, color: C.mutedText, marginTop: 3 }}>
								No weight entries yet — use the + button to log one
							</Text>
						)}
					</View>

					<LineGraph
						data={weightGraphData}
						color={C.primaryPurple}
						unitLabel={graphUnit}
					/>

					{/* Recent weight list */}
					{weightGraphData.length > 0 && (
						<View style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: C.borderLight, paddingTop: 14, gap: 2 }}>
							<Text style={{ fontSize: 12, fontWeight: "700", color: C.mutedText, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Recent entries</Text>
							{[...weightGraphData].reverse().slice(0, 5).map((w) => (
								<View key={w.id} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.borderLight }}>
									<Text style={{ flex: 1, fontSize: 13, color: C.mutedText }}>{formatDate(w.date)}</Text>
									<Text style={{ fontSize: 15, fontWeight: "700", color: C.primaryPurple, marginRight: 14 }}>
										{formatWeight(w.value_kg, weightPreference)}
									</Text>
									<TouchableOpacity
										onPress={() => setEditWeightEntry(w)}
										hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
										style={{ backgroundColor: C.bgPurple, borderRadius: 8, padding: 7, marginRight: 8 }}>
										<Icon name="edit" size={13} color={C.primaryPurple} />
									</TouchableOpacity>
									<TouchableOpacity
										onPress={() => Alert.alert("Delete Entry", "Remove this weight entry?", [
											{ text: "Cancel", style: "cancel" },
											{ text: "Delete", style: "destructive", onPress: () => onDeleteWeight?.(w.id) },
										])}
										hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
										style={{ backgroundColor: "#fde8e8", borderRadius: 8, padding: 7 }}>
										<Icon name="trash" size={13} color="#c0392b" />
									</TouchableOpacity>
								</View>
							))}
						</View>
					)}
				</View>

				{/* ── Milk intake graph (Pro) ── */}
				{isPro ? (
					<View style={s.card}>
						<Text style={s.sectionTitle}>Milk Intake</Text>
						<Text style={{ fontSize: 12, color: C.mutedText, marginTop: 3, marginBottom: 16 }}>Daily total · last 14 days (ml)</Text>
						<LineGraph
							data={milkGraphData}
							color="#2a5f8f"
							unitLabel="ml"
							emptyText="No milk entries logged yet"
						/>
					</View>
				) : (
					<ProLock title="Milk Intake Graph" onUpgradePro={onUpgradePro}>
						<View style={[s.card, { opacity: 0.35 }]}>
							<Text style={s.sectionTitle}>Milk Intake</Text>
							<Text style={{ fontSize: 12, color: C.mutedText, marginTop: 3, marginBottom: 16 }}>Daily total · last 14 days (ml)</Text>
							<View style={{ height: GRAPH_H, backgroundColor: C.bgPurple, borderRadius: 12 }} />
						</View>
					</ProLock>
				)}

				{/* ── Smart Insights (Pro) ── */}
				{isPro ? (
					<View style={[s.card, { gap: 14 }]}>
						<SmartInsightsSection
							child={child}
							foodLog={foodLog}
							weightLog={weightLog}
							bottleLog={bottleLog}
							user={user}
						/>
					</View>
				) : (
					<ProLock title="Smart Insights" onUpgradePro={onUpgradePro}>
						<View style={[s.card, { opacity: 0.35, gap: 14 }]}>
							<View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
								<View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: "#ede8f7", alignItems: "center", justifyContent: "center" }}>
									<Icon name="sparkle" size={20} color="#7c3aed" />
								</View>
								<View>
									<Text style={{ fontWeight: "800", fontSize: 16, color: C.primaryPinkDark }}>Smart Insights</Text>
									<Text style={{ fontSize: 12, color: C.mutedText }}>AI-powered growth &amp; nutrition insights</Text>
								</View>
							</View>
							<View style={{ backgroundColor: C.bgPurple, borderRadius: 14, height: 80 }} />
						</View>
					</ProLock>
				)}

				{/* ── Photo Gallery (Pro) ── */}
				{isPro ? (
					<View style={s.card}>
						<Text style={[s.sectionTitle, { marginBottom: 14 }]}>
							Food Photos{photoEntries.length > 0 ? ` · ${photoEntries.length}` : ""}
						</Text>
						{photoEntries.length === 0 ? (
							<View style={{ alignItems: "center", paddingVertical: 24, gap: 8 }}>
								<Icon name="Camera" size={36} color={C.secondaryPurple} />
								<Text style={{ fontSize: 13, color: C.mutedText }}>No food photos yet</Text>
								<Text style={{ fontSize: 12, color: C.mutedText, textAlign: "center" }}>
									Photos are saved when you log food with a picture
								</Text>
							</View>
						) : (
							<View style={{ gap: 4 }}>
								{Array.from({ length: Math.ceil(photoEntries.length / 3) }, (_, rowIdx) => (
									<View key={rowIdx} style={{ flexDirection: "row", gap: 4 }}>
										{photoEntries.slice(rowIdx * 3, rowIdx * 3 + 3).map((item) => (
											<TouchableOpacity
												key={item.id}
												onPress={() => setLightboxPhoto(item)}
												activeOpacity={0.85}
												style={{ width: THUMB, height: THUMB, borderRadius: 10, overflow: "hidden", backgroundColor: C.bgPurple }}>
												<Image source={{ uri: item.photoUri }} style={{ width: THUMB, height: THUMB }} resizeMode="cover" />
												<View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.45)", paddingHorizontal: 5, paddingVertical: 4 }}>
													<Text style={{ fontSize: 9, fontWeight: "700", color: "#fff" }} numberOfLines={1}>{item.name}</Text>
												</View>
											</TouchableOpacity>
										))}
									</View>
								))}
							</View>
						)}
					</View>
				) : (
					<ProLock title="Photo Gallery" onUpgradePro={onUpgradePro}>
						<View style={[s.card, { opacity: 0.35 }]}>
							<Text style={[s.sectionTitle, { marginBottom: 14 }]}>Food Photos</Text>
							<View style={{ flexDirection: "row", gap: 4 }}>
								{[0, 1, 2].map((i) => (
									<View key={i} style={{ width: THUMB, height: THUMB, borderRadius: 10, backgroundColor: C.bgPurple }} />
								))}
							</View>
						</View>
					</ProLock>
				)}

			</ScrollView>

			{/* ── Photo Lightbox ── */}
			{lightboxPhoto && (
				<Modal visible animationType="fade" onRequestClose={() => setLightboxPhoto(null)}>
					<View style={{ flex: 1, backgroundColor: "#000" }}>
						<TouchableOpacity
							onPress={() => setLightboxPhoto(null)}
							style={{ position: "absolute", top: Platform.OS === "ios" ? 56 : 20, right: 20, zIndex: 10, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 20, padding: 10 }}>
							<Icon name="close" size={20} color="#fff" />
						</TouchableOpacity>
						<ZoomableImage uri={lightboxPhoto.photoUri} />
						<View style={{ backgroundColor: "rgba(0,0,0,0.7)", paddingHorizontal: 24, paddingVertical: 18, paddingBottom: Platform.OS === "ios" ? 36 : 18 }}>
							<Text style={{ fontSize: 18, fontWeight: "800", color: "#fff", marginBottom: 4 }}>{lightboxPhoto.name}</Text>
							<View style={{ flexDirection: "row", gap: 12 }}>
								{lightboxPhoto.date     && <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{formatDate(lightboxPhoto.date)}</Text>}
								{lightboxPhoto.reaction && <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>· {lightboxPhoto.reaction}</Text>}
							</View>
						</View>
					</View>
				</Modal>
			)}

			{/* ── Edit Child Modal ── */}
			{showEdit && (
				<EditChildModal
					visible={showEdit}
					child={child}
					onSave={(updated) => onEdit?.(updated)}
					onClose={() => setShowEdit(false)}
				/>
			)}

			{/* ── Edit Weight Modal ── */}
			<EditWeightModal
				visible={!!editWeightEntry}
				entry={editWeightEntry}
				weightPreference={weightPreference}
				onSave={(id, fields) => onUpdateWeight?.(id, fields)}
				onDelete={(id) => onDeleteWeight?.(id)}
				onClose={() => setEditWeightEntry(null)}
			/>
		</View>
	);
}
