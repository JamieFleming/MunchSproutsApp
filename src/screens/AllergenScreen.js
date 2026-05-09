import React from "react";
import { View, Text, TouchableOpacity, ScrollView, Linking } from "react-native";
import { useTheme, useStyles } from "../ThemeContext";
import { Icon, AllergenIcon } from "../components/Icon";
import { ALLERGENS } from "../constants";
import { computeAllergenStatus, formatDate } from "../helpers";

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_CFG = {
	Safe:         { label: "Safely Tried",  color: "#2d7a55", bg: "#d4f0e0", border: "#a8dcc0" },
	"In Progress":{ label: "In Progress",   color: "#a85a1a", bg: "#fde8d4", border: "#ddc8a8" },
	Reaction:     { label: "Had Reaction",  color: "#c0392b", bg: "#fde8e8", border: "#e07070" },
	"Not Tried":  { label: "Not Tried",     color: "#8a7aaa", bg: "#f0ecfc", border: "#c4b0f0" },
};

const ADVICE_TIPS = [
	"Introduce one new allergen at a time",
	"Wait 2–3 days before introducing the next allergen to spot any reaction",
	"Start with a small amount and increase gradually over the following days",
	"Introduce new allergens in the morning or at lunchtime so you can monitor your baby during the day",
	"Once introduced safely, keep giving the allergen regularly (e.g. 2–3 times per week) to maintain tolerance",
	"If your baby has eczema or an existing food allergy, speak to your GP or allergy specialist before starting",
];

const HOW_TO_STEPS = [
	{
		step: "1", icon: "utensils", iconBg: "#e8f0fd", iconColor: "#3a6bc4",
		title: "Log a food containing the allergen",
		desc: 'When you give your baby a food with an allergen, tap "Add Food" and select the allergen from the list. It will appear as "In Progress".',
	},
	{
		step: "2", icon: "clock", iconBg: "#fff3e0", iconColor: "#d4860a",
		title: "Wait 2–3 days and watch for reactions",
		desc: "Keep an eye out for symptoms like rashes, hives, swelling, vomiting, or difficulty breathing. You'll get a reminder to check in after 2 days.",
	},
	{
		step: "3", icon: "check", iconBg: "#e6f7ef", iconColor: "#2d7a55",
		title: "Log the outcome",
		desc: 'Come back and log how your baby reacted. If all was well, it will move to "Safely Tried". If there was a reaction, log it as "Allergic" so you have a record.',
	},
];

// ── Sub-components ────────────────────────────────────────────────────────────

function CheckInCard({ allergen: a, onAllergenCheckIn }) {
	return (
		<View style={{ backgroundColor: "#ffffff", borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#d4860a33" }}>
			<View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 }}>
				<AllergenIcon allergen={a.value} size={38} />
				<View style={{ flex: 1 }}>
					<Text style={{ fontWeight: "700", fontSize: 14, color: "#a85a1a" }}>{a.value}</Text>
					<Text style={{ fontSize: 11, color: "#d4860a", marginTop: 2 }}>
						First introduced {a.daysSinceFirst} day{a.daysSinceFirst !== 1 ? "s" : ""} ago · Did your baby have a reaction?
					</Text>
				</View>
			</View>
			<View style={{ flexDirection: "row", gap: 8 }}>
				<TouchableOpacity onPress={() => onAllergenCheckIn?.(a.value, "safe")} activeOpacity={0.8}
					style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#e6f7ef", borderRadius: 10, paddingVertical: 10, borderWidth: 1.5, borderColor: "#2d7a5533" }}>
					<Icon name="check" size={14} color="#2d7a55" />
					<Text style={{ fontWeight: "700", fontSize: 13, color: "#2d7a55" }}>All clear</Text>
				</TouchableOpacity>
				<TouchableOpacity onPress={() => onAllergenCheckIn?.(a.value, "allergic")} activeOpacity={0.8}
					style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#fde8e8", borderRadius: 10, paddingVertical: 10, borderWidth: 1.5, borderColor: "#c0392b33" }}>
					<Icon name="alert" size={14} color="#c0392b" />
					<Text style={{ fontWeight: "700", fontSize: 13, color: "#c0392b" }}>Had reaction</Text>
				</TouchableOpacity>
			</View>
		</View>
	);
}

function AllergenRow({ al, index, total, onViewInLog }) {
	const { C } = useTheme();
	const cfg    = STATUS_CFG[al.status];
	const canTap = al.status !== "Not Tried" && onViewInLog;
	return (
		<TouchableOpacity
			activeOpacity={canTap ? 0.7 : 1}
			onPress={() => canTap && onViewInLog(al.value)}
			style={{ flexDirection: "row", alignItems: "center", paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: index < total - 1 ? 1 : 0, borderBottomColor: C.borderLight, backgroundColor: al.status === "Reaction" ? "#fff5f5" : "transparent" }}>
			<View style={{ marginRight: 12 }}>
				<AllergenIcon allergen={al.value} size={42} />
			</View>
			<View style={{ flex: 1 }}>
				<Text style={{ fontWeight: "700", fontSize: 14, color: C.primaryPinkDark }}>{al.value}</Text>
				{al.firstDate ? (
					<Text style={{ fontSize: 11, color: C.mutedText, marginTop: 2 }}>
						First: {formatDate(al.firstDate)}
						{al.lastDate && al.lastDate !== al.firstDate ? ` · Last: ${formatDate(al.lastDate)}` : ""}
						{al.count > 1 ? ` · ${al.count} entries` : ""}
					</Text>
				) : (
					<Text style={{ fontSize: 11, color: C.mutedText, marginTop: 2 }}>Not yet introduced</Text>
				)}
			</View>
			<View style={{ alignItems: "flex-end", gap: 4, marginLeft: 8 }}>
				{al.awaitingWindow && (
					<View style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#e8f4fb", borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: "#2980b933" }}>
						<Icon name="clock" size={9} color="#2980b9" />
						<Text style={{ fontSize: 9, fontWeight: "700", color: "#2980b9" }}>Awaiting 48hrs</Text>
					</View>
				)}
				{al.needsCheckIn && (
					<View style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#fff0cc", borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: "#d4860a44" }}>
						<Icon name="clock" size={9} color="#d4860a" />
						<Text style={{ fontSize: 9, fontWeight: "700", color: "#a85a1a" }}>Check in</Text>
					</View>
				)}
				<View style={{ backgroundColor: cfg.bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: cfg.border }}>
					<Text style={{ fontSize: 10, fontWeight: "700", color: cfg.color }}>{cfg.label}</Text>
				</View>
			</View>
			{canTap && <Icon name="chevRight" size={13} color={C.borderLight} style={{ marginLeft: 4 }} />}
		</TouchableOpacity>
	);
}

function StepRow({ item, isLast }) {
	const { C } = useTheme();
	return (
		<View style={{ flexDirection: "row", alignItems: "flex-start", padding: 14, gap: 12, borderBottomWidth: isLast ? 0 : 1, borderBottomColor: C.borderLight }}>
			<View style={{ alignItems: "center", width: 36 }}>
				<View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: item.iconBg, alignItems: "center", justifyContent: "center" }}>
					<Icon name={item.icon} size={16} color={item.iconColor} />
				</View>
				{!isLast && <View style={{ width: 2, flex: 1, minHeight: 16, backgroundColor: C.borderLight, marginTop: 6 }} />}
			</View>
			<View style={{ flex: 1, paddingTop: 2 }}>
				<Text style={{ fontWeight: "800", fontSize: 13, color: C.primaryPinkDark, marginBottom: 4 }}>{item.title}</Text>
				<Text style={{ fontSize: 12, color: C.mutedText, lineHeight: 18 }}>{item.desc}</Text>
			</View>
		</View>
	);
}

function TipRow({ tip, index }) {
	const { C } = useTheme();
	return (
		<View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
			<View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: C.bgPurple, alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
				<Text style={{ fontSize: 10, fontWeight: "800", color: C.primaryPurple }}>{index + 1}</Text>
			</View>
			<Text style={{ fontSize: 13, color: C.textCharcoal, lineHeight: 20, flex: 1 }}>{tip}</Text>
		</View>
	);
}

// ── Screen ────────────────────────────────────────────────────────────────────

export function AllergenScreen({ foodLog = [], onNavigate, onAddWithPrefill, onViewInLog, onAllergenCheckIn }) {
	const { C } = useTheme();
	const s = useStyles();

	const allergenStatus = computeAllergenStatus(foodLog, ALLERGENS);
	const introduced  = allergenStatus.filter((a) => a.status !== "Not Tried").length;
	const safe        = allergenStatus.filter((a) => a.status === "Safe").length;
	const inProgress  = allergenStatus.filter((a) => a.status === "In Progress").length;
	const reactions   = allergenStatus.filter((a) => a.status === "Reaction").length;
	const pct         = Math.round((introduced / ALLERGENS.length) * 100);
	const checkIns    = allergenStatus.filter((a) => a.needsCheckIn);

	return (
		<ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>

			{/* ── Check-in banner ── */}
			{checkIns.length > 0 && (
				<View style={{ backgroundColor: "#fff8ec", borderRadius: 16, padding: 16, marginBottom: 18, borderWidth: 1.5, borderColor: "#d4860a44" }}>
					<View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
						<Icon name="clock" size={16} color="#d4860a" />
						<Text style={{ fontWeight: "800", fontSize: 14, color: "#a85a1a" }}>Follow-up Needed</Text>
					</View>
					<Text style={{ fontSize: 12, color: "#7a5a1a", lineHeight: 18, marginBottom: 12 }}>
						It's been 2+ days since introducing these allergens. Log whether your baby had any reaction.
					</Text>
					{checkIns.map((a) => <CheckInCard key={a.value} allergen={a} onAllergenCheckIn={onAllergenCheckIn} />)}
				</View>
			)}

			{/* ── Stats row ── */}
			<View style={{ flexDirection: "row", gap: 8, marginBottom: 18 }}>
				{[
					{ label: "Introduced", value: introduced, color: C.primaryPurple,  bg: C.bgPurple   },
					{ label: "Safe",       value: safe,       color: "#2d7a55",         bg: "#d4f0e0"    },
					{ label: "In Progress",value: inProgress, color: "#a85a1a",         bg: "#fde8d4"    },
					{ label: "Reactions",  value: reactions,  color: "#c0392b",         bg: "#fde8e8"    },
				].map((stat) => (
					<View key={stat.label} style={{ flex: 1, backgroundColor: stat.bg, borderRadius: 14, padding: 12, alignItems: "center" }}>
						<Text style={{ fontSize: 22, fontWeight: "900", color: stat.color, lineHeight: 26 }}>{stat.value}</Text>
						<Text style={{ fontSize: 9, fontWeight: "700", color: stat.color, textAlign: "center", marginTop: 3, textTransform: "uppercase", letterSpacing: 0.3 }}>{stat.label}</Text>
					</View>
				))}
			</View>

			{/* ── Progress card ── */}
			<View style={[s.card, { marginBottom: 18 }]}>
				<View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
					<View>
						<Text style={s.sectionTitle}>Allergen Progress</Text>
						<Text style={{ fontSize: 12, color: C.mutedText, marginTop: 2 }}>{ALLERGENS.length - introduced} still to introduce</Text>
					</View>
					<View style={{ alignItems: "flex-end" }}>
						<Text style={{ fontSize: 28, fontWeight: "900", color: C.primaryPinkDark, lineHeight: 30 }}>{introduced}</Text>
						<Text style={{ fontSize: 11, color: C.mutedText, fontWeight: "600" }}>of {ALLERGENS.length}</Text>
					</View>
				</View>
				<View style={{ backgroundColor: C.borderLight, borderRadius: 999, height: 12, overflow: "hidden" }}>
					<View style={{ backgroundColor: "#3db87a", height: "100%", width: `${pct}%`, borderRadius: 999 }} />
				</View>
				{pct > 0 && <Text style={{ fontSize: 11, color: C.mutedText, marginTop: 6, textAlign: "right" }}>{pct}% complete</Text>}
			</View>

			{/* ── How to log ── */}
			<Text style={[s.sectionTitle, { marginBottom: 10 }]}>How to Log an Allergen</Text>
			<View style={[s.card, { marginBottom: 18, padding: 0, overflow: "hidden" }]}>
				{HOW_TO_STEPS.map((item, i) => (
					<StepRow key={item.step} item={item} isLast={i === HOW_TO_STEPS.length - 1} />
				))}
				<TouchableOpacity
					onPress={() => onAddWithPrefill?.(null)}
					activeOpacity={0.8}
					style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.primaryPurple, margin: 14, marginTop: 4, borderRadius: 12, paddingVertical: 13 }}>
					<Icon name="plus" size={16} color="#ffffff" />
					<Text style={{ fontWeight: "800", fontSize: 14, color: "#ffffff" }}>Log a Food with an Allergen</Text>
				</TouchableOpacity>
			</View>

			{/* ── Timeline ── */}
			<Text style={[s.sectionTitle, { marginBottom: 10 }]}>Allergen Timeline</Text>
			<View style={[s.card, { padding: 0, overflow: "hidden", marginBottom: 18 }]}>
				{allergenStatus.map((al, i) => (
					<AllergenRow key={al.value} al={al} index={i} total={allergenStatus.length} onViewInLog={onViewInLog} />
				))}
			</View>

			{/* ── Introduction advice ── */}
			<Text style={[s.sectionTitle, { marginBottom: 10 }]}>Introduction Advice</Text>
			<View style={[s.card, { marginBottom: 12 }]}>
				<View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 }}>
					<View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: "#d4e8f5", alignItems: "center", justifyContent: "center" }}>
						<Icon name="info" size={18} color="#2a5f8f" />
					</View>
					<Text style={{ fontWeight: "800", fontSize: 15, color: C.primaryPinkDark, flex: 1 }}>How to introduce allergens safely</Text>
				</View>
				{ADVICE_TIPS.map((tip, i) => <TipRow key={i} tip={tip} index={i} />)}
				<TouchableOpacity
					onPress={() => Linking.openURL("https://www.nhs.uk/baby/weaning-and-feeding/food-allergies-in-babies-and-young-children/")}
					style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#d4e8f5", borderRadius: 12, paddingVertical: 13, marginTop: 6 }}
					activeOpacity={0.8}>
					<Icon name="info" size={16} color="#2a5f8f" />
					<Text style={{ fontWeight: "700", fontSize: 14, color: "#2a5f8f" }}>View NHS Allergen Guidance</Text>
				</TouchableOpacity>
			</View>

			{/* ── Disclaimer ── */}
			<View style={{ backgroundColor: "#fff8e1", borderRadius: 14, padding: 14, flexDirection: "row", gap: 10 }}>
				<Icon name="alert" size={18} color="#d4860a" />
				<Text style={{ fontSize: 12, color: "#7a5a1a", lineHeight: 19, flex: 1 }}>
					<Text style={{ fontWeight: "800" }}>For general guidance only.</Text>{" "}
					This tracker is <Text style={{ fontWeight: "700" }}>not a substitute for medical advice.</Text>{" "}
					Always consult your GP, Health Visitor or a registered dietitian before introducing allergens, especially if your baby has eczema, an existing allergy, or you have any concerns.
				</Text>
			</View>
		</ScrollView>
	);
}
