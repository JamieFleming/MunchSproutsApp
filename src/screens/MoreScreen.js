import React, { useState, useEffect } from "react";
import {
	View, Text, TouchableOpacity, ScrollView, FlatList,
	Modal, Platform, Alert, ActivityIndicator, Image, Dimensions, Linking, Switch,
} from "react-native";
import { useTheme, useStyles } from "../ThemeContext";
import { Icon } from "../components/Icon";
import { ZoomableImage } from "../components/ZoomableImage";
import { PasswordChangeModal } from "../components/PasswordChangeModal";
import { FamilySharingModal } from "../components/FamilySharingModal";
import { SupportModal } from "../components/SupportModal";
import { pickImageAsBase64, groupByFood, formatDate, reactionCfg } from "../helpers";
import { ALLERGENS } from "../constants";
import { TEXT_LOGO_DATA_URL } from "../pdfAssets";
// expo-print and expo-sharing are loaded dynamically to avoid crashing when
// the native module hasn't been included in the current binary build yet.

const SCREEN_W = Dimensions.get("window").width;
const THUMB_SIZE = (SCREEN_W - 56) / 3;

// ── PDF export ────────────────────────────────────────────────────────────────

// Derive allergen status from the food log (mirrors AllergenScreen logic)
function allergenStatus(allergenValue, foodLog) {
	const entries = foodLog.filter(
		(e) => Array.isArray(e.allergens) && e.allergens.includes(allergenValue),
	);
	if (!entries.length) return { label: "Not Tried", bg: "#f3f3f3", color: "#999" };
	if (entries.some((e) => e.reaction === "Allergic"))
		return { label: "⚠️ Reaction", bg: "#fde8e8", color: "#c0392b" };
	if (entries.some((e) => e.isAllergenCheckin && (e.reaction === "Good" || e.reaction === "Loved")))
		return { label: "✅ Safe", bg: "#e8f5e9", color: "#2e7d32" };
	return { label: "⏳ In Progress", bg: "#fff3e0", color: "#d4860a" };
}

// Build an inline SVG line graph of daily milk totals
function buildMilkGraph(bottleLog) {
	const toMl = (amount, unit) => { const n = parseFloat(amount) || 0; return unit === "oz" ? Math.round(n * 29.5735) : Math.round(n); };

	// Sum ml per day
	const dayMap = {};
	bottleLog.forEach((b) => {
		if (!b.date) return;
		dayMap[b.date] = (dayMap[b.date] || 0) + toMl(b.amount, b.unit);
	});
	const dates  = Object.keys(dayMap).sort();
	if (dates.length < 2) return ""; // need at least 2 points

	const values = dates.map((d) => dayMap[d]);
	const maxVal = Math.max(...values);
	const minVal = Math.min(...values);
	const range  = maxVal - minVal || 1;

	// SVG canvas
	const W = 520, H = 140, padL = 44, padR = 16, padT = 14, padB = 28;
	const plotW = W - padL - padR;
	const plotH = H - padT - padB;
	const n     = dates.length;

	const px = (i) => padL + (i / (n - 1)) * plotW;
	const py = (v) => padT + (1 - (v - minVal) / range) * plotH;

	// Y-axis labels (3 ticks)
	const yTicks = [minVal, Math.round((minVal + maxVal) / 2), maxVal];
	const yAxisSvg = yTicks.map((v) =>
		`<text x="${padL - 5}" y="${py(v) + 4}" text-anchor="end" font-size="9" fill="#8a7aaa">${v}</text>
		 <line x1="${padL}" y1="${py(v)}" x2="${W - padR}" y2="${py(v)}" stroke="#ece8f9" stroke-width="1"/>`,
	).join("");

	// X-axis date labels — show up to 8, evenly spaced
	const step  = Math.max(1, Math.ceil(n / 8));
	const xLabelsSvg = dates
		.map((d, i) => ({ d, i }))
		.filter(({ i }) => i % step === 0 || i === n - 1)
		.map(({ d, i }) =>
			`<text x="${px(i)}" y="${H - 4}" text-anchor="middle" font-size="9" fill="#8a7aaa">${d.slice(5)}</text>`,
		).join("");

	// Area fill polygon
	const areaPoints = [
		`${px(0)},${padT + plotH}`,
		...dates.map((d, i) => `${px(i)},${py(values[i])}`),
		`${px(n - 1)},${padT + plotH}`,
	].join(" ");

	// Polyline
	const linePoints = dates.map((d, i) => `${px(i)},${py(values[i])}`).join(" ");

	// Dots + tooltips (value labels on larger jumps)
	const dotsSvg = dates.map((d, i) => {
		const showLabel = n <= 10 || i % step === 0 || i === n - 1;
		return `<circle cx="${px(i)}" cy="${py(values[i])}" r="3.5" fill="#2a5f8f" stroke="#fff" stroke-width="1.5"/>
			${showLabel ? `<text x="${px(i)}" y="${py(values[i]) - 7}" text-anchor="middle" font-size="8" fill="#2a5f8f" font-weight="700">${values[i]}</text>` : ""}`;
	}).join("");

	return `<div style="margin:12px 0 18px;background:#f0f6fc;border-radius:12px;padding:14px 16px;">
		<div style="font-size:11px;font-weight:700;color:#2a5f8f;margin-bottom:8px;">Daily Milk Intake (ml)</div>
		<svg width="100%" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
			${yAxisSvg}
			<polygon points="${areaPoints}" fill="rgba(42,95,143,0.12)"/>
			<polyline points="${linePoints}" fill="none" stroke="#2a5f8f" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
			${dotsSvg}
			${xLabelsSvg}
		</svg>
	</div>`;
}

// opts = { food: bool, milk: bool, allergens: bool }
async function exportFoodLogAsPDF(foodLog, childName, bottleLog = [], opts = { food: true, milk: true, allergens: true }) {
	const hasFood      = opts.food      && foodLog.length   > 0;
	const hasMilk      = opts.milk      && bottleLog.length > 0;
	const hasAllergens = opts.allergens && foodLog.length   > 0;

	if (!hasFood && !hasMilk && !hasAllergens) {
		Alert.alert("Nothing to export", "There's no data for the selected sections. Add some entries first.");
		return;
	}

	const toMl = (amount, unit) => { const n = parseFloat(amount) || 0; return unit === "oz" ? Math.round(n * 29.5735) : Math.round(n); };

	// ── Allergen summary (always computed so we can show it in top stats) ─────
	const allergenStatuses = ALLERGENS.map((al) => allergenStatus(al.value, foodLog));
	const allergenTried    = allergenStatuses.filter((s) => s.label !== "Not Tried").length;
	const allergenInProg   = allergenStatuses.filter((s) => s.label === "⏳ In Progress").length;
	const allergenSafe     = allergenStatuses.filter((s) => s.label === "✅ Safe").length;
	const allergenReaction = allergenStatuses.filter((s) => s.label === "⚠️ Reaction").length;

	// ── Top summary stats strip ───────────────────────────────────────────────
	let topStats = "";
	const statItems = [];

	if (hasFood) {
		const groups = groupByFood(foodLog);
		const keys   = Object.keys(groups);
		statItems.push(`<div class="stat"><div class="stat-val">${keys.length}</div><div class="stat-lbl">Foods tried</div></div>`);
		statItems.push(`<div class="stat"><div class="stat-val">${foodLog.length}</div><div class="stat-lbl">Attempts</div></div>`);
		const liked = keys.filter((k) => groups[k].attempts.some((a) => a.reaction === "Loved" || a.reaction === "Good")).length;
		statItems.push(`<div class="stat"><div class="stat-val">${liked}</div><div class="stat-lbl">Liked</div></div>`);
		const allergic = foodLog.filter((f) => f.reaction === "Allergic").length;
		if (allergic > 0)
			statItems.push(`<div class="stat" style="background:#fde8e8;"><div class="stat-val" style="color:#c0392b;">${allergic}</div><div class="stat-lbl" style="color:#c0392b;">Allergic</div></div>`);
	}
	if (hasMilk) {
		const totalFeeds = bottleLog.length;
		const totalMl    = bottleLog.reduce((sum, b) => sum + toMl(b.amount, b.unit), 0);
		statItems.push(`<div class="stat" style="background:#d4e8f5;"><div class="stat-val" style="color:#2a5f8f;">${totalFeeds}</div><div class="stat-lbl" style="color:#2a5f8f;">Total Feeds</div></div>`);
		statItems.push(`<div class="stat" style="background:#d4e8f5;"><div class="stat-val" style="color:#2a5f8f;">${totalMl} ml</div><div class="stat-lbl" style="color:#2a5f8f;">Total Milk</div></div>`);
	}
	// Allergen summary always shown if food log available
	if (foodLog.length > 0) {
		statItems.push(`<div class="stat" style="background:#ede8f7;"><div class="stat-val" style="color:#7b5ea7;">${allergenTried}/${ALLERGENS.length}</div><div class="stat-lbl" style="color:#7b5ea7;">Allergens tried</div></div>`);
		if (allergenInProg > 0)
			statItems.push(`<div class="stat" style="background:#fff3e0;"><div class="stat-val" style="color:#d4860a;">${allergenInProg}</div><div class="stat-lbl" style="color:#d4860a;">In progress</div></div>`);
		if (allergenSafe > 0)
			statItems.push(`<div class="stat" style="background:#e8f5e9;"><div class="stat-val" style="color:#2e7d32;">${allergenSafe}</div><div class="stat-lbl" style="color:#2e7d32;">Safe</div></div>`);
		if (allergenReaction > 0)
			statItems.push(`<div class="stat" style="background:#fde8e8;"><div class="stat-val" style="color:#c0392b;">${allergenReaction}</div><div class="stat-lbl" style="color:#c0392b;">Reaction${allergenReaction !== 1 ? "s" : ""}</div></div>`);
	}
	if (statItems.length > 0)
		topStats = `<div class="stats">${statItems.join("")}</div>`;

	// ── Food section ──────────────────────────────────────────────────────────
	let foodHtml = "";
	if (hasFood) {
		const groups = groupByFood(foodLog);
		const keys   = Object.keys(groups);
		foodHtml = `<div class="section-title">Food Log (${keys.length} foods · ${foodLog.length} attempts)</div>` +
			keys.map((key) => {
				const g          = groups[key];
				const likedCnt   = g.attempts.filter((a) => a.reaction === "Loved" || a.reaction === "Good").length;
				const pct        = Math.round((likedCnt / g.attempts.length) * 100);
				const hasAllergy = g.attempts.some((a) => a.reaction === "Allergic");
				const rows       = g.attempts.map((a, i) =>
					`<tr style="background:${i % 2 === 0 ? "#f9f7fe" : "#fff"}">
						<td style="padding:7px 10px;color:#8a7aaa;font-size:11px;">Attempt ${i + 1}</td>
						<td style="padding:7px 10px;font-size:11px;">${formatDate(a.date)}${a.time ? ` ${a.time}` : ""}</td>
						<td style="padding:7px 10px;font-size:11px;color:#d4860a;font-weight:600;">${a.mealTime || ""}</td>
						<td style="padding:7px 10px;font-size:11px;">${a.form || "—"}</td>
						<td style="padding:7px 10px;font-size:11px;color:${reactionCfg(a.reaction).color};font-weight:700;">${a.reaction || "—"}</td>
						<td style="padding:7px 10px;font-size:11px;color:#8a7aaa;font-style:italic;">${a.notes || ""}</td>
					</tr>`
				).join("");
				return `<div style="margin-bottom:18px;border-radius:10px;overflow:hidden;border:2px solid ${hasAllergy ? "#e07070" : "#ece8f9"};">
					<div style="background:${hasAllergy ? "#fde8e8" : "#ede8f7"};padding:10px 14px;display:flex;justify-content:space-between;align-items:center;">
						<span style="font-weight:700;font-size:14px;color:#5a2d7a;">${g.name}${hasAllergy ? `<span style="margin-left:8px;background:#fee2e2;color:#c0392b;border-radius:999px;padding:2px 8px;font-size:10px;font-weight:700;">ALLERGY</span>` : ""}</span>
						<span style="font-size:11px;color:#3db87a;font-weight:700;">${pct}% liked · ${g.attempts.length} attempt${g.attempts.length !== 1 ? "s" : ""}</span>
					</div>
					<table style="width:100%;border-collapse:collapse;">
						<thead><tr style="background:#f3f0fa;">
							<th style="padding:7px 10px;text-align:left;font-size:10px;color:#8a7aaa;">#</th>
							<th style="padding:7px 10px;text-align:left;font-size:10px;color:#8a7aaa;">Date</th>
							<th style="padding:7px 10px;text-align:left;font-size:10px;color:#8a7aaa;">Meal Time</th>
							<th style="padding:7px 10px;text-align:left;font-size:10px;color:#8a7aaa;">Form</th>
							<th style="padding:7px 10px;text-align:left;font-size:10px;color:#8a7aaa;">Reaction</th>
							<th style="padding:7px 10px;text-align:left;font-size:10px;color:#8a7aaa;">Notes</th>
						</tr></thead>
						<tbody>${rows}</tbody>
					</table>
				</div>`;
			}).join("");
	}

	// ── Milk section + line graph ─────────────────────────────────────────────
	let milkHtml = "";
	if (hasMilk) {
		const milkColor = { formula: "#2a5f8f", breast: "#7a2d6a", specialised: "#a85a1a" };
		const sorted    = [...bottleLog].sort((a, b) => {
			const da = new Date((a.date || "1970-01-01") + "T" + (a.time || "00:00"));
			const db = new Date((b.date || "1970-01-01") + "T" + (b.time || "00:00"));
			return db - da;
		});
		const byDate     = {};
		sorted.forEach((b) => { if (!byDate[b.date]) byDate[b.date] = []; byDate[b.date].push(b); });
		const totalFeeds = bottleLog.length;
		const totalMl    = bottleLog.reduce((sum, b) => sum + toMl(b.amount, b.unit), 0);

		// Line graph sits between the section title and the day-by-day tables
		const graph = buildMilkGraph(bottleLog);

		const dayTables = Object.keys(byDate).map((date) => {
			const feeds  = byDate[date];
			const dayMl  = feeds.reduce((sum, f) => sum + toMl(f.amount, f.unit), 0);
			const rows   = feeds.map((f, i) => {
				const ml  = toMl(f.amount, f.unit);
				const col = milkColor[f.type] || "#8a7aaa";
				return `<tr style="background:${i % 2 === 0 ? "#f0f6fc" : "#fff"}">
					<td style="padding:7px 10px;font-size:11px;">${f.time || "—"}</td>
					<td style="padding:7px 10px;font-size:11px;color:${col};font-weight:700;text-transform:capitalize;">${f.type || "—"}</td>
					<td style="padding:7px 10px;font-size:11px;">${f.amount || "—"} ${f.unit || ""} (${ml} ml)</td>
					<td style="padding:7px 10px;font-size:11px;color:#8a7aaa;font-style:italic;">${f.notes || ""}</td>
				</tr>`;
			}).join("");
			return `<div style="margin-bottom:18px;border-radius:10px;overflow:hidden;border:2px solid #d4e8f5;">
				<div style="background:#d4e8f5;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;">
					<span style="font-weight:700;font-size:14px;color:#2a5f8f;">${formatDate(date)}</span>
					<span style="font-size:11px;color:#2a5f8f;font-weight:700;">${feeds.length} feed${feeds.length !== 1 ? "s" : ""} · ${dayMl} ml total</span>
				</div>
				<table style="width:100%;border-collapse:collapse;">
					<thead><tr style="background:#eaf3fa;">
						<th style="padding:7px 10px;text-align:left;font-size:10px;color:#8a7aaa;">Time</th>
						<th style="padding:7px 10px;text-align:left;font-size:10px;color:#8a7aaa;">Type</th>
						<th style="padding:7px 10px;text-align:left;font-size:10px;color:#8a7aaa;">Amount</th>
						<th style="padding:7px 10px;text-align:left;font-size:10px;color:#8a7aaa;">Notes</th>
					</tr></thead>
					<tbody>${rows}</tbody>
				</table>
			</div>`;
		}).join("");

		milkHtml = `<div class="section-title">Milk &amp; Bottle Feeds (${totalFeeds} feeds · ${totalMl} ml)</div>${graph}${dayTables}`;
	}

	// ── Allergen section ──────────────────────────────────────────────────────
	let allergenHtml = "";
	if (hasAllergens) {
		const rows = ALLERGENS.map((al) => {
			const st      = allergenStatus(al.value, foodLog);
			const entries = foodLog.filter((e) => Array.isArray(e.allergens) && e.allergens.includes(al.value));
			const lastDate = entries.length
				? formatDate([...entries].sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0].date)
				: "—";
			return `<tr>
				<td style="padding:8px 12px;font-size:12px;">${al.emoji} ${al.value}</td>
				<td style="padding:8px 12px;">
					<span style="background:${st.bg};color:${st.color};border-radius:999px;padding:3px 10px;font-size:11px;font-weight:700;">${st.label}</span>
				</td>
				<td style="padding:8px 12px;font-size:11px;color:#8a7aaa;">${lastDate}</td>
			</tr>`;
		}).join("");

		allergenHtml = `<div class="section-title">Allergen Tracker (${allergenTried}/${ALLERGENS.length} introduced · ${allergenSafe} safe · ${allergenReaction} reaction${allergenReaction !== 1 ? "s" : ""})</div>
			<table style="width:100%;border-collapse:collapse;border-radius:10px;overflow:hidden;border:2px solid #ece8f9;">
				<thead><tr style="background:#f3f0fa;">
					<th style="padding:8px 12px;text-align:left;font-size:10px;color:#8a7aaa;">Allergen</th>
					<th style="padding:8px 12px;text-align:left;font-size:10px;color:#8a7aaa;">Status</th>
					<th style="padding:8px 12px;text-align:left;font-size:10px;color:#8a7aaa;">Last Tried</th>
				</tr></thead>
				<tbody>${rows}</tbody>
			</table>`;
	}

	// ── Header — TEXT_LOGO_DATA_URL is hardcoded base64 (48 KB, always works) ─
	const headerHtml = `<div style="text-align:center;background:#f5f2ff;border-radius:16px;padding:18px 20px;margin-bottom:6px;">
		<img src="${TEXT_LOGO_DATA_URL}" style="height:52px;object-fit:contain;" />
	</div>`;

	const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
		<style>
			body { font-family: -apple-system, Helvetica, Arial, sans-serif; margin:0; padding:28px; background:#fff; color:#3d3d3d; }
			.subtitle { color:#8a7aaa; font-size:13px; margin:12px 0 20px; border-bottom:2px solid #ece8f9; padding-bottom:12px; }
			.stats { display:flex; gap:10px; margin-bottom:20px; flex-wrap:wrap; }
			.stat { background:#ede8f7; border-radius:10px; padding:10px 14px; text-align:center; min-width:72px; }
			.stat-val { font-size:20px; font-weight:700; color:#9b7fe8; }
			.stat-lbl { font-size:9px; color:#8a7aaa; text-transform:uppercase; margin-top:2px; }
			.section-title { font-size:12px; font-weight:700; color:#5a2d7a; text-transform:uppercase; letter-spacing:1px; margin:20px 0 10px; padding:8px 12px; background:#ede8f7; border-radius:8px; }
			.footer { margin-top:36px; padding-top:14px; border-top:2px solid #ece8f9; font-size:10px; color:#8a7aaa; text-align:center; }
			table { border-collapse:collapse; width:100%; }
		</style>
	</head><body>
		${headerHtml}
		<p class="subtitle">Report${childName ? ` — ${childName}` : ""} &nbsp;·&nbsp; Generated ${formatDate(new Date().toISOString().split("T")[0])}</p>
		${topStats}
		${milkHtml}
		${foodHtml}
		${allergenHtml}
		<div class="footer">Generated by Munch Sprouts &nbsp;·&nbsp; For informational purposes only.<br/>Always consult your GP or Health Visitor before starting weaning.</div>
	</body></html>`;

	try {
		const Print = await import("expo-print");
		const Sharing = await import("expo-sharing");
		const { uri } = await Print.printToFileAsync({ html, base64: false });
		await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: `${childName || "MunchSprouts"} Report`, UTI: "com.adobe.pdf" });
	} catch {
		Alert.alert("Export failed", "Could not generate PDF. Please try again.");
	}
}

const THEMES = [
	{ id: "default",    label: "Default",      sublabel: "Purple & white",        dot: "#9b7fe8" },
	{ id: "accessible", label: "Accessibility", sublabel: "High contrast colours", dot: "#5000cc" },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children, mt = 6 }) {
	const s = useStyles();
	return (
		<Text style={[s.smallLabel, { paddingLeft: 4, marginBottom: 10, marginTop: mt }]}>
			{children}
		</Text>
	);
}

function Toggle({ value, onPress }) {
	const { C } = useTheme();
	return (
		<TouchableOpacity onPress={onPress} activeOpacity={0.85}
			style={{ width: 48, height: 28, borderRadius: 14, backgroundColor: value ? C.primaryPurple : C.borderLight, justifyContent: "center", paddingHorizontal: 3 }}>
			<View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff", alignSelf: value ? "flex-end" : "flex-start", shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 2, elevation: 2 }} />
		</TouchableOpacity>
	);
}

function DashRow({ icon, iconBg, iconColor, label, sublabel, value, onPress, mt = 0 }) {
	const { C } = useTheme();
	return (
		<TouchableOpacity onPress={onPress} activeOpacity={0.8}
			style={{ flexDirection: "row", alignItems: "center", gap: 14, marginTop: mt }}>
			<View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: iconBg, alignItems: "center", justifyContent: "center" }}>
				<Icon name={icon} size={20} color={iconColor} />
			</View>
			<View style={{ flex: 1 }}>
				<Text style={{ fontWeight: "700", fontSize: 14, color: C.textCharcoal }}>{label}</Text>
				<Text style={{ fontSize: 12, color: C.mutedText, marginTop: 2 }}>{sublabel}</Text>
			</View>
			<Toggle value={value} onPress={onPress} />
		</TouchableOpacity>
	);
}

function MoreRow({ icon, iconBg, label, sublabel, onPress, color, right }) {
	const { C } = useTheme();
	return (
		<TouchableOpacity onPress={onPress} activeOpacity={0.8}
			style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16, backgroundColor: C.white, borderRadius: 16, marginBottom: 10, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 }}>
			<View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: iconBg || C.bgPurple, alignItems: "center", justifyContent: "center" }}>
				<Icon name={icon} size={20} color={color || C.primaryPurple} />
			</View>
			<View style={{ flex: 1 }}>
				<Text style={{ fontWeight: "700", fontSize: 15, color: color || C.textCharcoal }}>{label}</Text>
				{sublabel && <Text style={{ fontSize: 12, color: C.mutedText, marginTop: 2 }}>{sublabel}</Text>}
			</View>
			{right !== undefined ? right : <Icon name="chevRight" size={16} color={C.mutedText} />}
		</TouchableOpacity>
	);
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export function MoreScreen({
	user, isPro, ownedChildren, defaultChildId,
	showMilkOnDashboard = true, onToggleMilkOnDashboard,
	showAllergenOnDashboard = true, onToggleAllergenOnDashboard,
	weightPreference = "lbs", onSetWeightPreference,
	bottleRemindersEnabled = false, bottleReminderTimes = [],
	onToggleBottleReminders, onAddBottleReminderTime, onRemoveBottleReminderTime,
	onLogout, onDeleteAccount, onUpgradePro, onRestorePurchases,
	onManageSharing, foodLog = [], bottleLog = [], childName,
}) {
	const { C, theme, setTheme } = useTheme();
	const s = useStyles();

	const [showChangePassword, setShowChangePassword] = useState(false);
	const [upgradeLoading,     setUpgradeLoading]     = useState(false);
	const [upgradePlan,        setUpgradePlan]        = useState("monthly");
	const [showSharing,        setShowSharing]        = useState(false);
	const [showSupport,        setShowSupport]        = useState(false);
	const [showGallery,        setShowGallery]        = useState(false);
	const [profilePhoto,       setProfilePhoto]       = useState("");
	const [lightboxPhoto,      setLightboxPhoto]      = useState(null);
	const [showTimePicker,     setShowTimePicker]     = useState(false);
	const [pickerHour,         setPickerHour]         = useState(7);   // 1–12
	const [pickerMinute,       setPickerMinute]       = useState(0);   // 0–55
	const [pickerAmPm,         setPickerAmPm]         = useState("AM");

	// Convert 24h {hour, minute} to display string
	const fmt24 = (hour, minute) => {
		const h12 = hour % 12 === 0 ? 12 : hour % 12;
		const ampm = hour < 12 ? "AM" : "PM";
		return `${h12}:${String(minute).padStart(2, "0")} ${ampm}`;
	};

	// Convert picker 12h values to 24h for storage
	const pickerTo24h = () => {
		const h = pickerHour % 12;
		return { hour: pickerAmPm === "PM" ? h + 12 : h, minute: pickerMinute };
	};

	const handleConfirmTime = () => {
		onAddBottleReminderTime?.(pickerTo24h());
		setShowTimePicker(false);
	};

	const photoEntries = [...foodLog]
		.filter((e) => !!e.photoUri)
		.sort((a, b) => new Date(b.date) - new Date(a.date));

	useEffect(() => {
		if (!user?.uid) return;
		import("firebase/firestore").then(({ doc: fsDoc, getDoc }) =>
			import("../../firebase").then(({ db }) =>
				getDoc(fsDoc(db, "users", user.uid)).then((snap) => {
					if (snap.exists() && snap.data().photoURL) setProfilePhoto(snap.data().photoURL);
				}),
			),
		);
	}, [user?.uid]);

	const handlePickProfilePhoto = async () => {
		const uri = await pickImageAsBase64([1, 1]);
		if (!uri) return;
		setProfilePhoto(uri);
		try {
			const { updateUserProfile } = await import("../../firebaseHooks");
			await updateUserProfile(user.uid, { photoURL: uri });
		} catch {
			Alert.alert("Error", "Could not save photo.");
		}
	};

	const handleRemoveProfilePhoto = async () => {
		setProfilePhoto("");
		try {
			const { updateUserProfile } = await import("../../firebaseHooks");
			await updateUserProfile(user.uid, { photoURL: "" });
		} catch { /* silent */ }
	};

	const confirmDelete = () =>
		Alert.alert(
			"Delete Account",
			"This will permanently delete your account, all children, and all food log data. This cannot be undone.",
			[
				{ text: "Cancel", style: "cancel" },
				{ text: "Yes, Delete Everything", style: "destructive", onPress: () =>
					Alert.alert("Final Confirmation", "Last chance — this cannot be reversed.", [
						{ text: "Cancel", style: "cancel" },
						{ text: "Delete My Account", style: "destructive", onPress: onDeleteAccount },
					]),
				},
			],
		);

	return (
		<ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>

			{/* Account card */}
			<View style={[s.card, { marginBottom: 20, flexDirection: "row", alignItems: "center", gap: 14 }]}>
				<View style={{ alignItems: "center", gap: 4 }}>
					<TouchableOpacity onPress={handlePickProfilePhoto} activeOpacity={0.8}>
						<View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: C.primaryPurple, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
							{profilePhoto
								? <Image source={{ uri: profilePhoto }} style={{ width: 60, height: 60 }} resizeMode="cover" />
								: <Icon name="user" size={26} color="#fff" />}
						</View>
						<View style={{ position: "absolute", bottom: 0, right: 0, width: 20, height: 20, borderRadius: 10, backgroundColor: C.primaryPurple, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: C.white }}>
							<Icon name="Camera" size={10} color="#fff" />
						</View>
					</TouchableOpacity>
					{profilePhoto && (
						<TouchableOpacity onPress={handleRemoveProfilePhoto}>
							<Text style={{ fontSize: 10, color: "#c0392b", fontWeight: "700" }}>Remove</Text>
						</TouchableOpacity>
					)}
				</View>
				<View style={{ flex: 1 }}>
					<Text style={{ fontWeight: "700", fontSize: 15, color: C.primaryPinkDark }}>{user.email}</Text>
					<View style={{ marginTop: 4 }}>
						<View style={{ backgroundColor: isPro ? C.statGreenBg : C.bgPurple, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: "flex-start" }}>
							<Text style={{ fontSize: 11, fontWeight: "700", color: isPro ? C.statGreenText : C.mutedText }}>
								{isPro ? "PRO ACCOUNT" : "FREE ACCOUNT"}
							</Text>
						</View>
						{isPro && (
							<TouchableOpacity onPress={() => Linking.openURL("https://apps.apple.com/account/subscriptions")} style={{ marginTop: 5 }}>
								<Text style={{ fontSize: 11, color: C.primaryPurple, fontWeight: "600" }}>Manage subscription →</Text>
							</TouchableOpacity>
						)}
					</View>
				</View>
			</View>

			{/* Upgrade card */}
			{!isPro && (
				<View style={{ backgroundColor: "#2d1f5e", borderRadius: 20, padding: 20, marginBottom: 20, overflow: "hidden" }}>
					{/* decorative blobs */}
					<View style={{ position: "absolute", top: -24, right: -24, width: 110, height: 110, borderRadius: 55, backgroundColor: "rgba(155,127,232,0.18)" }} />
					<View style={{ position: "absolute", bottom: -16, left: -16, width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(61,184,122,0.12)" }} />

					{/* Header */}
					<View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 }}>
						<View style={{ backgroundColor: "#f5c842", borderRadius: 10, width: 34, height: 34, alignItems: "center", justifyContent: "center" }}>
							<Icon name="crown" size={17} color="#2d1f5e" />
						</View>
						<View>
							<Text style={{ fontWeight: "900", fontSize: 17, color: C.white, letterSpacing: -0.3 }}>Munch Sprouts Pro</Text>
							<Text style={{ fontSize: 12, color: "#f5c842", fontWeight: "700" }}>
								{upgradePlan === "lifetime" ? "£39.99 one-off" : upgradePlan === "yearly" ? "£19.99 / year" : "£2.99 / month"}
							</Text>
						</View>
					</View>

					{/* Plan toggle */}
					<View style={{ flexDirection: "row", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 12, padding: 4, marginTop: 14, marginBottom: 2 }}>
						{[
							{ key: "monthly",  label: "Monthly",  price: "£2.99/mo" },
							{ key: "yearly",   label: "Yearly",   price: "£19.99/yr", badge: "Save 28%" },
							{ key: "lifetime", label: "Lifetime", price: "£39.99",    badge: "Best Value" },
						].map(({ key, label, price, badge }) => {
							const active = upgradePlan === key;
							return (
								<TouchableOpacity
									key={key}
									onPress={() => setUpgradePlan(key)}
									activeOpacity={0.8}
									style={{
										flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 10,
										backgroundColor: active ? "#f5c842" : "transparent",
									}}>
									<View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
										<Text style={{ fontWeight: "800", fontSize: 13, color: active ? "#2d1f5e" : "rgba(255,255,255,0.6)" }}>
											{label}
										</Text>
										{badge && (
											<View style={{ backgroundColor: active ? "#2d1f5e" : "rgba(245,200,66,0.25)", borderRadius: 999, paddingHorizontal: 5, paddingVertical: 1 }}>
												<Text style={{ fontSize: 9, fontWeight: "700", color: active ? "#f5c842" : "#f5c842" }}>{badge}</Text>
											</View>
										)}
									</View>
									<Text style={{ fontSize: 11, fontWeight: "600", color: active ? "#2d1f5e" : "rgba(255,255,255,0.45)", marginTop: 1 }}>{price}</Text>
								</TouchableOpacity>
							);
						})}
					</View>

					{/* Feature list */}
					<View style={{ marginTop: 14, marginBottom: 16, gap: 8 }}>
						{[
							{ icon: "🍽️", label: "All recipes",              sub: "Full library of BLW meal ideas" },
							{ icon: "📸", label: "Photo memories",            sub: "Attach photos to food log entries" },
							{ icon: "👨‍👩‍👧", label: "Family sharing",            sub: "Invite a partner or caregiver" },
							{ icon: "👶", label: "Unlimited child profiles",  sub: "Track multiple children" },
							{ icon: "🏆", label: "Milestones",                sub: "Celebrate weaning achievements" },
							{ icon: "⏰", label: "Meal time tracking",        sub: "Log breakfast, lunch, dinner & more" },
							{ icon: "📋", label: "Symptom tracking",          sub: "Log symptoms alongside bottle feeds" },
							{ icon: "📄", label: "PDF export",                sub: "Download full reports" },
							{ icon: "📅", label: "Meal planner",              sub: "Coming soon", soon: true },
							{ icon: "🛒", label: "Shopping list",             sub: "Coming soon", soon: true },
							{ icon: "📊", label: "Insights & trends",         sub: "Coming soon", soon: true },
						].map(({ icon, label, sub, soon }) => (
							<View key={label} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
								<Text style={{ fontSize: 16, width: 26, textAlign: "center" }}>{icon}</Text>
								<View style={{ flex: 1 }}>
									<View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
										<Text style={{ fontSize: 13, fontWeight: "700", color: C.white }}>{label}</Text>
										{soon && (
											<View style={{ backgroundColor: "rgba(245,200,66,0.2)", borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 }}>
												<Text style={{ fontSize: 9, fontWeight: "700", color: "#f5c842" }}>SOON</Text>
											</View>
										)}
									</View>
									<Text style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{sub}</Text>
								</View>
								{!soon && <Icon name="check" size={13} color="#3db87a" />}
							</View>
						))}
					</View>

					{/* CTA */}
					<TouchableOpacity
						onPress={() => { setUpgradeLoading(true); onUpgradePro?.(upgradePlan).finally(() => setUpgradeLoading(false)); }}
						disabled={upgradeLoading} activeOpacity={0.85}
						style={{ backgroundColor: "#f5c842", borderRadius: 14, paddingVertical: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, opacity: upgradeLoading ? 0.7 : 1 }}>
						{upgradeLoading ? <ActivityIndicator color="#2d1f5e" /> : (
							<>
								<Icon name="crown" size={15} color="#2d1f5e" />
								<Text style={{ color: "#2d1f5e", fontWeight: "800", fontSize: 15 }}>
									{upgradePlan === "lifetime"
										? "Get Lifetime Access — £39.99"
										: upgradePlan === "yearly"
										? "Start Pro — £19.99/year"
										: "Start Pro — £2.99/month"}
								</Text>
							</>
						)}
					</TouchableOpacity>
					<View style={{ flexDirection: "row", justifyContent: "center", gap: 20, paddingTop: 10 }}>
						<TouchableOpacity onPress={onRestorePurchases}>
							<Text style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontWeight: "600" }}>Restore purchase</Text>
						</TouchableOpacity>
						<Text style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", fontWeight: "600" }}>·</Text>
						<TouchableOpacity onPress={() => Linking.openURL("https://apps.apple.com/account/subscriptions")}>
							<Text style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontWeight: "600" }}>Manage subscription</Text>
						</TouchableOpacity>
					</View>
				</View>
			)}

			{/* Appearance */}
			<SectionLabel>Appearance</SectionLabel>
			<View style={{ backgroundColor: C.white, borderRadius: 16, padding: 16, marginBottom: 10, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 }}>
				<Text style={{ fontWeight: "700", fontSize: 14, color: C.textCharcoal, marginBottom: 12 }}>Colour Theme</Text>
				{THEMES.map((t) => (
					<TouchableOpacity key={t.id} onPress={() => setTheme(t.id)} activeOpacity={0.8}
						style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 12, backgroundColor: theme === t.id ? C.bgPurple : "transparent", borderRadius: 12, marginBottom: 4, borderWidth: 1.5, borderColor: theme === t.id ? C.primaryPurple : "transparent" }}>
						<View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: t.dot, alignItems: "center", justifyContent: "center", shadowColor: t.dot, shadowOpacity: 0.4, shadowRadius: 4, elevation: 2 }}>
							{theme === t.id && <Icon name="check" size={16} color="#fff" />}
						</View>
						<View style={{ flex: 1 }}>
							<Text style={{ fontWeight: "700", fontSize: 14, color: theme === t.id ? C.primaryPurple : C.textCharcoal }}>{t.label}</Text>
							<Text style={{ fontSize: 12, color: C.mutedText, marginTop: 2 }}>{t.sublabel}</Text>
						</View>
						{theme === t.id && (
							<View style={{ backgroundColor: C.primaryPurple, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
								<Text style={{ fontSize: 10, fontWeight: "700", color: "#fff" }}>Active</Text>
							</View>
						)}
					</TouchableOpacity>
				))}
			</View>

			{/* Dashboard */}
			<SectionLabel>Dashboard</SectionLabel>
			<View style={{ backgroundColor: C.white, borderRadius: 16, padding: 16, marginBottom: 10, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 }}>
				<DashRow
					icon="bottle" iconBg="#d4e8f5" iconColor="#2a5f8f"
					label="Show Milk on Dashboard" sublabel="Display today's bottle feeds on the home screen"
					value={showMilkOnDashboard} onPress={onToggleMilkOnDashboard}
				/>
				<DashRow
					icon="shield" iconBg="#ece8f9" iconColor="#7b5ea7"
					label="Show Allergen Tracker" sublabel="Display allergen progress and reminders on the home screen"
					value={showAllergenOnDashboard} onPress={onToggleAllergenOnDashboard} mt={16}
				/>
				{/* Weight unit preference */}
				<View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginTop: 16 }}>
					<View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: "#e6f7ef", alignItems: "center", justifyContent: "center" }}>
						<Icon name="scale" size={20} color="#2d7a55" />
					</View>
					<View style={{ flex: 1 }}>
						<Text style={{ fontWeight: "700", fontSize: 14, color: C.textCharcoal }}>Weight Unit</Text>
						<Text style={{ fontSize: 12, color: C.mutedText, marginTop: 2 }}>Preferred display for weight measurements</Text>
					</View>
					<View style={{ flexDirection: "row", backgroundColor: C.bgPurple, borderRadius: 10, overflow: "hidden" }}>
						{["lbs", "kg"].map((u) => (
							<TouchableOpacity
								key={u}
								onPress={() => onSetWeightPreference?.(u)}
								style={{ paddingHorizontal: 14, paddingVertical: 7, backgroundColor: weightPreference === u ? C.primaryPurple : "transparent" }}>
								<Text style={{ fontWeight: "700", fontSize: 13, color: weightPreference === u ? "#fff" : C.mutedText }}>{u}</Text>
							</TouchableOpacity>
						))}
					</View>
				</View>
			</View>

			{/* Notifications */}
			<SectionLabel>Notifications</SectionLabel>
			<View style={{ backgroundColor: C.white, borderRadius: 16, padding: 16, marginBottom: 10, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 }}>
				{/* Toggle row */}
				<View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
					<View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: "#d4e8f5", alignItems: "center", justifyContent: "center" }}>
						<Icon name="bottle" size={20} color="#2a5f8f" />
					</View>
					<View style={{ flex: 1 }}>
						<Text style={{ fontWeight: "700", fontSize: 14, color: C.textCharcoal }}>Bottle Feeding Reminders</Text>
						<Text style={{ fontSize: 12, color: C.mutedText, marginTop: 2 }}>Get daily reminders to feed your baby</Text>
					</View>
					<Switch
						value={bottleRemindersEnabled}
						onValueChange={onToggleBottleReminders}
						trackColor={{ false: C.borderLight, true: "#2a5f8f" }}
						thumbColor="#ffffff"
					/>
				</View>

				{/* Time list */}
				{bottleRemindersEnabled && (
					<View style={{ marginTop: 16 }}>
						{bottleReminderTimes.length === 0 ? (
							<Text style={{ fontSize: 13, color: C.mutedText, textAlign: "center", paddingVertical: 8 }}>
								No reminders set — tap "Add Time" below
							</Text>
						) : (
							bottleReminderTimes.map((t, i) => (
								<View key={i} style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#f0f6fc", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8 }}>
									<Text style={{ flex: 1, fontWeight: "700", fontSize: 14, color: "#2a5f8f" }}>
										{fmt24(t.hour, t.minute)}
									</Text>
									<TouchableOpacity onPress={() => onRemoveBottleReminderTime?.(i)}
										style={{ backgroundColor: "#fde8e8", borderRadius: 8, padding: 7 }}>
										<Icon name="trash" size={14} color="#c0392b" />
									</TouchableOpacity>
								</View>
							))
						)}
						<TouchableOpacity onPress={() => setShowTimePicker(true)}
							style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.bgPurple, borderRadius: 10, paddingVertical: 11, marginTop: 4 }}>
							<Icon name="plus" size={16} color={C.primaryPurple} />
							<Text style={{ fontWeight: "700", fontSize: 14, color: C.primaryPurple }}>Add Time</Text>
						</TouchableOpacity>
					</View>
				)}
			</View>

			{/* Time Picker Modal */}
			<Modal visible={showTimePicker} transparent animationType="fade" onRequestClose={() => setShowTimePicker(false)}>
				<View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" }}>
					<View style={{ backgroundColor: C.white, borderRadius: 20, padding: 24, width: "85%", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 16, elevation: 10 }}>
						<Text style={{ fontWeight: "800", fontSize: 17, color: C.textCharcoal, textAlign: "center", marginBottom: 24 }}>Set Reminder Time</Text>

						<View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 }}>
							{/* Hour picker */}
							<View style={{ alignItems: "center", gap: 8 }}>
								<TouchableOpacity onPress={() => setPickerHour((h) => h === 12 ? 1 : h + 1)}
									style={{ backgroundColor: C.bgPurple, borderRadius: 10, padding: 10 }}>
									<Icon name="chevUp" size={18} color={C.primaryPurple} />
								</TouchableOpacity>
								<View style={{ width: 64, height: 52, backgroundColor: "#f0f6fc", borderRadius: 12, alignItems: "center", justifyContent: "center" }}>
									<Text style={{ fontWeight: "800", fontSize: 26, color: "#2a5f8f" }}>{String(pickerHour).padStart(2, "0")}</Text>
								</View>
								<TouchableOpacity onPress={() => setPickerHour((h) => h === 1 ? 12 : h - 1)}
									style={{ backgroundColor: C.bgPurple, borderRadius: 10, padding: 10 }}>
									<Icon name="chevDown" size={18} color={C.primaryPurple} />
								</TouchableOpacity>
								<Text style={{ fontSize: 11, color: C.mutedText, fontWeight: "600" }}>Hour</Text>
							</View>

							<Text style={{ fontSize: 28, fontWeight: "800", color: C.textCharcoal, marginBottom: 20 }}>:</Text>

							{/* Minute picker */}
							<View style={{ alignItems: "center", gap: 8 }}>
								<TouchableOpacity onPress={() => setPickerMinute((m) => (m + 5) % 60)}
									style={{ backgroundColor: C.bgPurple, borderRadius: 10, padding: 10 }}>
									<Icon name="chevUp" size={18} color={C.primaryPurple} />
								</TouchableOpacity>
								<View style={{ width: 64, height: 52, backgroundColor: "#f0f6fc", borderRadius: 12, alignItems: "center", justifyContent: "center" }}>
									<Text style={{ fontWeight: "800", fontSize: 26, color: "#2a5f8f" }}>{String(pickerMinute).padStart(2, "0")}</Text>
								</View>
								<TouchableOpacity onPress={() => setPickerMinute((m) => m === 0 ? 55 : m - 5)}
									style={{ backgroundColor: C.bgPurple, borderRadius: 10, padding: 10 }}>
									<Icon name="chevDown" size={18} color={C.primaryPurple} />
								</TouchableOpacity>
								<Text style={{ fontSize: 11, color: C.mutedText, fontWeight: "600" }}>Minute</Text>
							</View>

							{/* AM/PM */}
							<View style={{ alignItems: "center", gap: 8, marginBottom: 20 }}>
								{["AM", "PM"].map((p) => (
									<TouchableOpacity key={p} onPress={() => setPickerAmPm(p)}
										style={{ width: 52, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: pickerAmPm === p ? "#2a5f8f" : C.bgPurple }}>
										<Text style={{ fontWeight: "700", fontSize: 13, color: pickerAmPm === p ? "#fff" : C.mutedText }}>{p}</Text>
									</TouchableOpacity>
								))}
							</View>
						</View>

						<View style={{ flexDirection: "row", gap: 10, marginTop: 24 }}>
							<TouchableOpacity onPress={() => setShowTimePicker(false)}
								style={{ flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: C.bgPurple, alignItems: "center" }}>
								<Text style={{ fontWeight: "700", color: C.mutedText }}>Cancel</Text>
							</TouchableOpacity>
							<TouchableOpacity onPress={handleConfirmTime}
								style={{ flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: "#2a5f8f", alignItems: "center" }}>
								<Text style={{ fontWeight: "700", color: "#fff" }}>Add Time</Text>
							</TouchableOpacity>
						</View>
					</View>
				</View>
			</Modal>

			{/* Gallery */}
			<MoreRow
				icon="Camera" iconBg={C.bgPurple}
				label="Photo Gallery"
				sublabel={`${photoEntries.length} food photo${photoEntries.length !== 1 ? "s" : ""} saved`}
				onPress={() => setShowGallery(true)}
			/>

			{/* Data Export */}
			<SectionLabel mt={4}>Data</SectionLabel>
			<MoreRow
				icon="pdf" iconBg={isPro ? "#ede8f7" : C.bgPurple}
				label="Export as PDF"
				sublabel={isPro ? "Download your food, milk & allergen data as a PDF" : "Pro feature — upgrade to unlock"}
				color={isPro ? undefined : C.mutedText}
				onPress={isPro
					? () => Alert.alert(
						"Export as PDF",
						"What would you like to include?",
						[
							{ text: "Everything",    onPress: () => exportFoodLogAsPDF(foodLog, childName, bottleLog, { food: true,  milk: true,  allergens: true  }) },
							{ text: "Food Log",      onPress: () => exportFoodLogAsPDF(foodLog, childName, bottleLog, { food: true,  milk: false, allergens: false }) },
							{ text: "Milk & Bottles",onPress: () => exportFoodLogAsPDF(foodLog, childName, bottleLog, { food: false, milk: true,  allergens: false }) },
							{ text: "Allergens Only",onPress: () => exportFoodLogAsPDF(foodLog, childName, bottleLog, { food: false, milk: false, allergens: true  }) },
							{ text: "Cancel", style: "cancel" },
						],
					)
					: onUpgradePro
				}
				right={isPro ? undefined : (
					<View style={{ backgroundColor: C.warningStroke, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
						<Text style={{ fontSize: 10, fontWeight: "700", color: C.white }}>PRO</Text>
					</View>
				)}
			/>

			{/* Account */}
			<SectionLabel mt={4}>Account</SectionLabel>
			<MoreRow icon="key" iconBg="#e8f0ff" label="Change Password" sublabel="Update your account password" onPress={() => setShowChangePassword(true)} />
			<MoreRow icon="logout" iconBg={C.statRedBg} label="Sign Out" sublabel="Sign out of your account" color="#c0392b" onPress={onLogout} right={<View />} />

			{/* Family Sharing */}
			<SectionLabel mt={10}>Family Sharing</SectionLabel>
			<MoreRow
				icon={isPro ? "users" : "lock"}
				iconBg={isPro ? C.statBlueBg : C.bgPurple}
				label="Share with Family"
				sublabel={isPro ? "Invite a partner or caregiver by email" : "Pro feature — upgrade to unlock"}
				color={isPro ? undefined : C.mutedText}
				onPress={isPro ? () => setShowSharing(true) : onUpgradePro}
				right={isPro ? undefined : (
					<View style={{ backgroundColor: C.warningStroke, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
						<Text style={{ fontSize: 10, fontWeight: "700", color: C.white }}>PRO</Text>
					</View>
				)}
			/>
			<FamilySharingModal
				visible={showSharing} onClose={() => setShowSharing(false)}
				user={user} ownedChildren={ownedChildren} defaultChildId={defaultChildId}
				onManageSharing={onManageSharing}
			/>

			{/* Support */}
			<SectionLabel mt={10}>Support</SectionLabel>
			<MoreRow icon="info" iconBg={C.statBlueBg} label="Contact Support" sublabel="Get help, report bugs or request features" onPress={() => setShowSupport(true)} />
			<SupportModal visible={showSupport} onClose={() => setShowSupport(false)} user={user} />

			{/* Danger Zone */}
			<SectionLabel mt={10}>Danger Zone</SectionLabel>
			<MoreRow icon="trash" iconBg={C.statRedBg} label="Delete Account" sublabel="Permanently delete account and all data" color="#c0392b" onPress={confirmDelete} right={<View />} />

			{/* Photo Gallery Modal */}
			<Modal visible={showGallery} animationType="slide" onRequestClose={() => setShowGallery(false)}>
				<View style={{ flex: 1, backgroundColor: C.bgMain }}>
					<View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: Platform.OS === "ios" ? 56 : 20, paddingBottom: 16, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.borderLight }}>
						<View>
							<Text style={{ fontWeight: "800", fontSize: 20, color: C.primaryPinkDark }}>Photo Gallery</Text>
							<Text style={{ fontSize: 12, color: C.mutedText, marginTop: 2 }}>
								{photoEntries.length} food photo{photoEntries.length !== 1 ? "s" : ""}
							</Text>
						</View>
						<TouchableOpacity onPress={() => setShowGallery(false)} style={{ backgroundColor: C.bgPurple, borderRadius: 10, padding: 10 }}>
							<Icon name="close" size={18} color={C.mutedText} />
						</TouchableOpacity>
					</View>

					{photoEntries.length === 0 ? (
						<View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
							<Icon name="Camera" size={52} color={C.secondaryPurple} />
							<Text style={{ fontWeight: "700", fontSize: 16, color: C.mutedText }}>No photos yet</Text>
							<Text style={{ fontSize: 13, color: C.mutedText, textAlign: "center", paddingHorizontal: 40 }}>
								Add photos when logging food to see them here
							</Text>
						</View>
					) : (
						<FlatList
							data={photoEntries}
							keyExtractor={(item) => item.id}
							numColumns={3}
							contentContainerStyle={{ padding: 16, gap: 4 }}
							columnWrapperStyle={{ gap: 4, marginBottom: 4 }}
							renderItem={({ item }) => (
								<TouchableOpacity onPress={() => setLightboxPhoto(item)} activeOpacity={0.85}
									style={{ width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: 10, overflow: "hidden", backgroundColor: C.bgPurple }}>
									<Image source={{ uri: item.photoUri }} style={{ width: THUMB_SIZE, height: THUMB_SIZE }} resizeMode="cover" />
									<View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.45)", paddingHorizontal: 5, paddingVertical: 4 }}>
										<Text style={{ fontSize: 9, fontWeight: "700", color: "#fff" }} numberOfLines={1}>{item.name}</Text>
									</View>
								</TouchableOpacity>
							)}
						/>
					)}

					{/* Lightbox */}
					{lightboxPhoto && (
						<View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#000", zIndex: 100 }}>
							<TouchableOpacity onPress={() => setLightboxPhoto(null)}
								style={{ position: "absolute", top: Platform.OS === "ios" ? 56 : 20, right: 20, zIndex: 10, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 20, padding: 10 }}>
								<Icon name="close" size={20} color="#fff" />
							</TouchableOpacity>
							<ZoomableImage uri={lightboxPhoto.photoUri} />
							<Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, textAlign: "center", paddingBottom: 4 }}>
								Pinch to zoom · Double-tap to reset
							</Text>
							<View style={{ backgroundColor: "rgba(0,0,0,0.7)", paddingHorizontal: 24, paddingVertical: 18, paddingBottom: Platform.OS === "ios" ? 36 : 18 }}>
								<Text style={{ fontSize: 18, fontWeight: "800", color: "#fff", marginBottom: 4 }}>{lightboxPhoto.name}</Text>
								<View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
									{lightboxPhoto.date     && <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{lightboxPhoto.date}</Text>}
									{lightboxPhoto.reaction && <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>· {lightboxPhoto.reaction}</Text>}
									{lightboxPhoto.form     && <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>· {lightboxPhoto.form}</Text>}
								</View>
							</View>
						</View>
					)}
				</View>
			</Modal>

			<PasswordChangeModal visible={showChangePassword} onClose={() => setShowChangePassword(false)} user={user} />
		</ScrollView>
	);
}
