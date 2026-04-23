import React, { useState, useEffect, useCallback } from "react";
import {
	View,
	Image,
	Text,
	TextInput,
	TouchableOpacity,
	ScrollView,
	StyleSheet,
	Platform,
	StatusBar,
	Modal,
	Alert,
	KeyboardAvoidingView,
	ActivityIndicator,
} from "react-native";
import {
	SafeAreaView,
	useSafeAreaInsets,
	SafeAreaProvider,
} from "react-native-safe-area-context";
import Svg, {
	Path,
	Line,
	Polyline,
	Circle,
	Rect,
	Polygon,
} from "react-native-svg";
import {
	updatePassword,
	EmailAuthProvider,
	reauthenticateWithCredential,
} from "firebase/auth";
import { auth } from "./firebase";
import {
	useAuth,
	logOut,
	fetchChildren,
	fetchFoodLog,
	addFoodEntry,
	updateFoodEntry,
	deleteFoodEntry,
	addChild as fbAddChild,
	updateChild as fbUpdateChild,
	deleteChild as fbDeleteChild,
	deleteAccount,
} from "./firebaseHooks";
import AuthScreen from "./AuthScreen";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import Purchases, { LOG_LEVEL } from "react-native-purchases";

// ─── COLOURS ──────────────────────────────────────────────────────────────────
const C = {
	bgMain: "#fdf5e2",
	bgPurple: "#ede8f7",
	bgGreen: "#e8f7ee",
	bgWarning: "#fff4e5",
	primaryPurple: "#9b7fe8",
	secondaryPurple: "#c4b0f0",
	primaryPurpleDark: "#7a5fcb",
	primaryGreen: "#3db87a",
	primaryGreenLight: "#5dd39e",
	primaryPinkDark: "#5a2d7a",
	textCharcoal: "#3d3d3d",
	warningStroke: "#e07b39",
	white: "#ffffff",
	border: "#d9d0f0",
	borderLight: "#ece8f9",
	mutedText: "#8a7aaa",
};

const CATEGORIES = [
	{ value: "Vegetables", color: C.primaryGreen },
	{ value: "Fruits", color: "#e05c7a" },
	{ value: "Grains", color: "#d4a017" },
	{ value: "Proteins", color: C.warningStroke },
	{ value: "Dairy", color: C.secondaryPurple },
	{ value: "Legumes", color: "#3db8a0" },
	{ value: "Liquids", color: "#4ab8d8" },
	{ value: "Other", color: C.mutedText },
];
const FORMS = [
	"Purée",
	"Mashed",
	"Soft/Cut",
	"Finger Food",
	"Mixed Texture",
	"Liquid",
	"Sippy Cup",
	"Open Cup",
];
const REACTIONS = [
	{
		value: "Loved",
		color: C.primaryGreen,
		bg: C.bgGreen,
		border: C.primaryGreenLight,
	},
	{ value: "Good", color: "#2e9e60", bg: "#d6f5e6", border: "#5dd39e" },
	{ value: "Neutral", color: "#b07d20", bg: "#fff8e1", border: "#f0c94a" },
	{
		value: "Rejected",
		color: C.warningStroke,
		bg: C.bgWarning,
		border: C.warningStroke,
	},
	{ value: "Allergic", color: "#c0392b", bg: "#fde8e8", border: "#e07070" },
];

const RECIPES = [
	{
		id: 1,
		title: "Banana Oat Pancakes",
		category: "Breakfast",
		ageGroup: "6m+",
		time: "15 min",
		tags: ["dairy-free", "egg-free"],
		locked: false,
		description: "Soft, naturally sweet pancakes perfect for little hands.",
		ingredients: [
			"1 ripe banana",
			"4 tbsp rolled oats",
			"1 egg",
			"Pinch of cinnamon",
			"Coconut oil for frying",
		],
		steps: [
			"Mash the banana well until smooth.",
			"Blend oats to a rough flour and mix in.",
			"Beat in the egg and cinnamon.",
			"Heat coconut oil in a non-stick pan on medium-low.",
			"Drop tablespoons of batter and cook 2–3 min each side.",
			"Cool completely. Cut into strips for easy gripping.",
		],
	},
	{
		id: 2,
		title: "Sweet Potato Fingers",
		category: "Finger Foods",
		ageGroup: "6m+",
		time: "30 min",
		tags: ["vegan", "iron-rich"],
		locked: false,
		description:
			"Soft-baked wedges that are easy to pick up and naturally sweet.",
		ingredients: [
			"1 medium sweet potato",
			"1 tsp olive oil",
			"Pinch of cumin (optional)",
		],
		steps: [
			"Preheat oven to 200°C / 180°C fan.",
			"Peel sweet potato and cut into finger-sized wedges.",
			"Toss in olive oil and cumin.",
			"Spread on lined baking tray.",
			"Bake 25–30 minutes until soft and slightly golden.",
			"Cool until just warm before serving.",
		],
	},
	{
		id: 3,
		title: "Salmon & Broccoli Bites",
		category: "Mains",
		ageGroup: "7m+",
		time: "25 min",
		tags: ["omega-3", "iron-rich"],
		locked: true,
		description: "Omega-3 packed bites with hidden veg.",
		ingredients: [
			"150g cooked salmon",
			"80g cooked broccoli",
			"2 tbsp breadcrumbs",
			"1 egg yolk",
		],
		steps: [
			"Flake salmon and finely chop broccoli.",
			"Mix with breadcrumbs and egg yolk.",
			"Shape into small patties.",
			"Bake at 180°C for 15–18 minutes.",
			"Cool before serving.",
		],
	},
	{
		id: 4,
		title: "Avocado Toast Soldiers",
		category: "Breakfast",
		ageGroup: "6m+",
		time: "10 min",
		tags: ["healthy-fats"],
		locked: true,
		description: "Creamy avocado on toast cut into soldiers.",
		ingredients: [
			"½ ripe avocado",
			"1 slice wholemeal toast",
			"Squeeze of lemon juice",
		],
		steps: [
			"Mash avocado with lemon juice.",
			"Toast bread until golden.",
			"Spread avocado on toast.",
			"Cut into soldiers and serve.",
		],
	},
	{
		id: 5,
		title: "Lentil & Veggie Fritters",
		category: "Mains",
		ageGroup: "7m+",
		time: "35 min",
		tags: ["high-protein", "iron-rich"],
		locked: true,
		description: "Iron-rich fritters packed with hidden veg.",
		ingredients: [
			"100g cooked red lentils",
			"1 grated carrot",
			"1 grated courgette",
			"2 tbsp plain flour",
			"1 egg",
		],
		steps: [
			"Squeeze moisture from grated veg.",
			"Mix lentils, veg, flour, egg.",
			"Shape into patties.",
			"Fry on medium heat 3–4 min each side.",
			"Drain and cool before serving.",
		],
	},
	{
		id: 6,
		title: "Mango Yoghurt Pots",
		category: "Snacks",
		ageGroup: "6m+",
		time: "5 min",
		tags: ["probiotic"],
		locked: true,
		description: "A quick creamy snack full of probiotics.",
		ingredients: [
			"3 tbsp full-fat plain yoghurt",
			"2 tbsp fresh or frozen mango",
			"Optional: pinch of cardamom",
		],
		steps: [
			"Defrost mango if frozen.",
			"Mash or blend mango to a purée.",
			"Swirl through yoghurt.",
			"Serve in a bowl or on a preloaded spoon.",
		],
	},
];

// ─── DATE HELPERS ─────────────────────────────────────────────────────────────
function calcAgeWeeks(dob) {
	if (!dob) return null;
	return Math.floor((Date.now() - new Date(dob)) / (7 * 24 * 60 * 60 * 1000));
}
function calcAgeMonths(dob) {
	if (!dob) return null;
	const b = new Date(dob),
		n = new Date();
	return (
		(n.getFullYear() - b.getFullYear()) * 12 + (n.getMonth() - b.getMonth())
	);
}
function formatDate(d) {
	if (!d) return "";
	return new Date(d).toLocaleDateString("en-GB", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}
function normalize(s) {
	return s.toLowerCase().trim();
}
function groupByFood(log) {
	const g = {};
	log.forEach((e) => {
		const k = normalize(e.name);
		if (!g[k])
			g[k] = { key: k, name: e.name, category: e.category, attempts: [] };
		g[k].attempts.push(e);
	});
	return g;
}
function reactionCfg(r) {
	return REACTIONS.find((x) => x.value === r) || REACTIONS[2];
}

// Build arrays for the date picker wheels
const MONTHS = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
];
function getDaysInMonth(month, year) {
	return new Date(year, month, 0).getDate();
}
function buildYears(from, to) {
	const y = [];
	for (let i = to; i >= from; i--) y.push(String(i));
	return y;
}
function buildDays(month, year) {
	const n = getDaysInMonth(month, year);
	const d = [];
	for (let i = 1; i <= n; i++) d.push(String(i).padStart(2, "0"));
	return d;
}

// ─── SVG ICONS ────────────────────────────────────────────────────────────────
function Icon({ name, size = 18, color = C.mutedText }) {
	const p = {
		stroke: color,
		strokeWidth: 2,
		strokeLinecap: "round",
		strokeLinejoin: "round",
		fill: "none",
	};
	const icons = {
		home: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Path {...p} d="M3 12L12 3l9 9" />
				<Path {...p} d="M9 21V12h6v9" />
				<Path {...p} d="M3 12v9h6" />
				<Path {...p} d="M15 21v-9h6V21" />
			</Svg>
		),
		list: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Line {...p} x1="8" y1="6" x2="21" y2="6" />
				<Line {...p} x1="8" y1="12" x2="21" y2="12" />
				<Line {...p} x1="8" y1="18" x2="21" y2="18" />
				<Circle {...p} cx="3" cy="6" r="1" fill={color} />
				<Circle {...p} cx="3" cy="12" r="1" fill={color} />
				<Circle {...p} cx="3" cy="18" r="1" fill={color} />
			</Svg>
		),
		plus: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Line {...p} x1="12" y1="5" x2="12" y2="19" />
				<Line {...p} x1="5" y1="12" x2="19" y2="12" />
			</Svg>
		),
		users: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Path {...p} d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
				<Circle {...p} cx="9" cy="7" r="4" />
				<Path {...p} d="M23 21v-2a4 4 0 0 0-3-3.87" />
				<Path {...p} d="M16 3.13a4 4 0 0 1 0 7.75" />
			</Svg>
		),
		chef: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Path
					{...p}
					d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z"
				/>
				<Line {...p} x1="6" y1="17" x2="18" y2="17" />
			</Svg>
		),
		settings: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Circle {...p} cx="12" cy="12" r="3" />
				<Path
					{...p}
					d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
				/>
			</Svg>
		),
		logout: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Path {...p} d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
				<Polyline {...p} points="16 17 21 12 16 7" />
				<Line {...p} x1="21" y1="12" x2="9" y2="12" />
			</Svg>
		),
		star: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Polygon
					{...p}
					points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
				/>
			</Svg>
		),
		starFill: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Polygon
					stroke={color}
					strokeWidth={0}
					fill={color}
					points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
				/>
			</Svg>
		),
		edit: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Path
					{...p}
					d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
				/>
				<Path
					{...p}
					d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
				/>
			</Svg>
		),
		trash: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Polyline {...p} points="3 6 5 6 21 6" />
				<Path {...p} d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
				<Path {...p} d="M10 11v6M14 11v6" />
				<Path {...p} d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
			</Svg>
		),
		close: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Line {...p} x1="18" y1="6" x2="6" y2="18" />
				<Line {...p} x1="6" y1="6" x2="18" y2="18" />
			</Svg>
		),
		chevDown: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Polyline {...p} points="6 9 12 15 18 9" />
			</Svg>
		),
		chevUp: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Polyline {...p} points="18 15 12 9 6 15" />
			</Svg>
		),
		chevRight: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Polyline {...p} points="9 18 15 12 9 6" />
			</Svg>
		),
		check: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Polyline {...p} points="20 6 9 17 4 12" />
			</Svg>
		),
		alert: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Path
					{...p}
					d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
				/>
				<Line {...p} x1="12" y1="9" x2="12" y2="13" />
				<Line {...p} x1="12" y1="17" x2="12.01" y2="17" />
			</Svg>
		),
		lock: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Rect {...p} x="3" y="11" width="18" height="11" rx="2" />
				<Path {...p} d="M7 11V7a5 5 0 0 1 10 0v4" />
			</Svg>
		),
		unlock: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Rect {...p} x="3" y="11" width="18" height="11" rx="2" />
				<Path {...p} d="M7 11V7a5 5 0 0 1 9.9-1" />
			</Svg>
		),
		search: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Circle {...p} cx="11" cy="11" r="8" />
				<Line {...p} x1="21" y1="21" x2="16.65" y2="16.65" />
			</Svg>
		),
		clock: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Circle {...p} cx="12" cy="12" r="10" />
				<Polyline {...p} points="12 6 12 12 16 14" />
			</Svg>
		),
		chart: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Line {...p} x1="18" y1="20" x2="18" y2="10" />
				<Line {...p} x1="12" y1="20" x2="12" y2="4" />
				<Line {...p} x1="6" y1="20" x2="6" y2="14" />
			</Svg>
		),
		grid: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Rect {...p} x="3" y="3" width="7" height="7" />
				<Rect {...p} x="14" y="3" width="7" height="7" />
				<Rect {...p} x="14" y="14" width="7" height="7" />
				<Rect {...p} x="3" y="14" width="7" height="7" />
			</Svg>
		),
		water: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Path
					{...p}
					fill={color}
					d="M12 2C6 9 4 13 4 16a8 8 0 0 0 16 0c0-3-2-7-8-14z"
				/>
			</Svg>
		),
		baby: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Circle {...p} cx="12" cy="8" r="4" />
				<Path {...p} d="M8 14c-3 1.5-5 3.5-5 5h18c0-1.5-2-3.5-5-5" />
			</Svg>
		),
		info: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Circle {...p} cx="12" cy="12" r="10" />
				<Line {...p} x1="12" y1="16" x2="12" y2="12" />
				<Line {...p} x1="12" y1="8" x2="12.01" y2="8" />
			</Svg>
		),
		utensils: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Path {...p} d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
				<Path {...p} d="M7 2v20" />
				<Path {...p} d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />
			</Svg>
		),
		key: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Path
					{...p}
					d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"
				/>
			</Svg>
		),
		crown: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Path {...p} d="M2 20h20M5 20V10l7-7 7 7v10" />
				<Path {...p} d="M9 20v-5h6v5" />
			</Svg>
		),
		user: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Path {...p} d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
				<Circle {...p} cx="12" cy="7" r="4" />
			</Svg>
		),
		calendar: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Rect {...p} x="3" y="4" width="18" height="18" rx="2" />
				<Line {...p} x1="16" y1="2" x2="16" y2="6" />
				<Line {...p} x1="8" y1="2" x2="8" y2="6" />
				<Line {...p} x1="3" y1="10" x2="21" y2="10" />
			</Svg>
		),
		download: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Path {...p} d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
				<Polyline {...p} points="7 10 12 15 17 10" />
				<Line {...p} x1="12" y1="15" x2="12" y2="3" />
			</Svg>
		),
	};
	return icons[name] || null;
}

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────
function Card({ children, style, danger = false }) {
	return (
		<View
			style={[
				s.card,
				danger && { backgroundColor: "#fde8e8", borderColor: "#e07070" },
				style,
			]}>
			{children}
		</View>
	);
}
function SectionTitle({ children, icon }) {
	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				gap: 8,
				marginBottom: 14,
			}}>
			{icon && <Icon name={icon} size={16} color={C.primaryPurple} />}
			<Text style={s.sectionTitle}>{children}</Text>
		</View>
	);
}
function ReactionBadge({ reaction }) {
	const r = reactionCfg(reaction);
	return (
		<View
			style={{
				backgroundColor: r.bg,
				borderColor: r.border,
				borderWidth: 1.5,
				borderRadius: 999,
				paddingHorizontal: 10,
				paddingVertical: 3,
			}}>
			<Text style={{ color: r.color, fontSize: 11, fontWeight: "700" }}>
				{reaction}
			</Text>
		</View>
	);
}
function StatCard({ icon, label, value, color, bg }) {
	return (
		<View style={[s.statCard, { backgroundColor: bg }]}>
			<Icon name={icon} size={18} color={color} />
			<Text style={[s.statValue, { color }]}>{value}</Text>
			<Text style={s.statLabel}>{label}</Text>
		</View>
	);
}
function PrimaryBtn({ label, onPress, color, icon }) {
	return (
		<TouchableOpacity
			onPress={onPress}
			style={[s.btnPrimary, color && { backgroundColor: color }]}
			activeOpacity={0.8}>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					gap: 8,
					justifyContent: "center",
				}}>
				{icon && <Icon name={icon} size={14} color={C.white} />}
				<Text style={s.btnPrimaryText}>{label}</Text>
			</View>
		</TouchableOpacity>
	);
}
function SecondaryBtn({ onPress, children, style: extra }) {
	return (
		<TouchableOpacity
			onPress={onPress}
			style={[s.btnSecondary, extra]}
			activeOpacity={0.8}>
			{children}
		</TouchableOpacity>
	);
}
function DangerBtn({ onPress, children, style: extra }) {
	return (
		<TouchableOpacity
			onPress={onPress}
			style={[s.btnDanger, extra]}
			activeOpacity={0.8}>
			{children}
		</TouchableOpacity>
	);
}

// ─── PICKER MODAL (generic — used for form/texture, sort options etc) ─────────
function PickerModal({ visible, title, options, value, onSelect, onClose }) {
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

// ─── DATE PICKER MODAL ────────────────────────────────────────────────────────
// Replaces free-text date entry with a 3-column day/month/year picker.
function DatePickerModal({
	visible,
	title,
	value,
	onSelect,
	onClose,
	minYear = 2000,
	maxYear = new Date().getFullYear(),
}) {
	// Parse existing value or default to today
	const parseDate = (v) => {
		if (v) {
			const d = new Date(v);
			if (!isNaN(d))
				return {
					day: String(d.getDate()).padStart(2, "0"),
					month: d.getMonth(),
					year: String(d.getFullYear()),
				};
		}
		const now = new Date();
		return {
			day: String(now.getDate()).padStart(2, "0"),
			month: now.getMonth(),
			year: String(now.getFullYear()),
		};
	};
	const initial = parseDate(value);
	const [day, setDay] = useState(initial.day);
	const [month, setMonth] = useState(initial.month); // 0-indexed
	const [year, setYear] = useState(initial.year);
	const [showDayPicker, setShowDayPicker] = useState(false);
	const [showMonthPicker, setShowMonthPicker] = useState(false);
	const [showYearPicker, setShowYearPicker] = useState(false);

	const years = buildYears(minYear, maxYear);
	const days = buildDays(month + 1, parseInt(year));

	const confirm = () => {
		// Clamp day if month change made it invalid
		const maxDay = getDaysInMonth(month + 1, parseInt(year));
		const safeDay = Math.min(parseInt(day), maxDay);
		const d = String(safeDay).padStart(2, "0");
		const m = String(month + 1).padStart(2, "0");
		onSelect(`${year}-${m}-${d}`);
		onClose();
	};

	if (!visible) return null;

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
				<View
					style={[s.pickerSheet, { maxHeight: "70%" }]}
					onStartShouldSetResponder={() => true}>
					<Text style={s.pickerTitle}>{title}</Text>

					{/* Three column selectors */}
					<View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
						{/* Day */}
						<View style={{ flex: 1 }}>
							<Text style={[s.label, { marginBottom: 6 }]}>Day</Text>
							<TouchableOpacity
								onPress={() => setShowDayPicker(true)}
								style={[
									s.input,
									{
										flexDirection: "row",
										justifyContent: "space-between",
										alignItems: "center",
									},
								]}>
								<Text style={{ color: C.textCharcoal, fontWeight: "600" }}>
									{day}
								</Text>
								<Icon name="chevDown" size={14} color={C.mutedText} />
							</TouchableOpacity>
						</View>
						{/* Month */}
						<View style={{ flex: 1.5 }}>
							<Text style={[s.label, { marginBottom: 6 }]}>Month</Text>
							<TouchableOpacity
								onPress={() => setShowMonthPicker(true)}
								style={[
									s.input,
									{
										flexDirection: "row",
										justifyContent: "space-between",
										alignItems: "center",
									},
								]}>
								<Text style={{ color: C.textCharcoal, fontWeight: "600" }}>
									{MONTHS[month]}
								</Text>
								<Icon name="chevDown" size={14} color={C.mutedText} />
							</TouchableOpacity>
						</View>
						{/* Year */}
						<View style={{ flex: 1.2 }}>
							<Text style={[s.label, { marginBottom: 6 }]}>Year</Text>
							<TouchableOpacity
								onPress={() => setShowYearPicker(true)}
								style={[
									s.input,
									{
										flexDirection: "row",
										justifyContent: "space-between",
										alignItems: "center",
									},
								]}>
								<Text style={{ color: C.textCharcoal, fontWeight: "600" }}>
									{year}
								</Text>
								<Icon name="chevDown" size={14} color={C.mutedText} />
							</TouchableOpacity>
						</View>
					</View>

					{/* Preview */}
					<View
						style={{
							backgroundColor: C.bgPurple,
							borderRadius: 10,
							padding: 12,
							marginBottom: 16,
							alignItems: "center",
						}}>
						<Text
							style={{
								color: C.primaryPinkDark,
								fontWeight: "700",
								fontSize: 14,
							}}>
							{formatDate(
								`${year}-${String(month + 1).padStart(2, "0")}-${day}`,
							)}
						</Text>
					</View>

					<TouchableOpacity onPress={confirm} style={s.btnPrimary}>
						<Text style={s.btnPrimaryText}>Confirm Date</Text>
					</TouchableOpacity>

					{/* Nested pickers */}
					<PickerModal
						visible={showDayPicker}
						title="Select Day"
						options={days}
						value={day}
						onSelect={setDay}
						onClose={() => setShowDayPicker(false)}
					/>
					<PickerModal
						visible={showMonthPicker}
						title="Select Month"
						options={MONTHS}
						value={MONTHS[month]}
						onSelect={(v) => setMonth(MONTHS.indexOf(v))}
						onClose={() => setShowMonthPicker(false)}
					/>
					<PickerModal
						visible={showYearPicker}
						title="Select Year"
						options={years}
						value={year}
						onSelect={setYear}
						onClose={() => setShowYearPicker(false)}
					/>
				</View>
			</TouchableOpacity>
		</Modal>
	);
}

// ─── DATE FIELD ───────────────────────────────────────────────────────────────
// A tappable field that opens DatePickerModal instead of a text input.
function DateField({ label, value, onChange, minYear, maxYear }) {
	const [open, setOpen] = useState(false);
	return (
		<View>
			<Text style={s.label}>{label}</Text>
			<TouchableOpacity
				onPress={() => setOpen(true)}
				style={[
					s.input,
					{
						flexDirection: "row",
						justifyContent: "space-between",
						alignItems: "center",
					},
				]}>
				<Text
					style={{
						color: value ? C.textCharcoal : C.mutedText,
						fontWeight: "600",
					}}>
					{value ? formatDate(value) : "Select date…"}
				</Text>
				<Icon name="calendar" size={16} color={C.mutedText} />
			</TouchableOpacity>
			<DatePickerModal
				visible={open}
				title={label}
				value={value}
				onSelect={onChange}
				onClose={() => setOpen(false)}
				minYear={minYear}
				maxYear={maxYear}
			/>
		</View>
	);
}

// ─── FOOD FORM ────────────────────────────────────────────────────────────────
function FoodForm({ onSubmit, initial = {}, buttonLabel = "Add to Log" }) {
	const today = new Date().toISOString().split("T")[0];
	const [form, setForm] = useState({
		date: today,
		name: "",
		category: "",
		form: "",
		reaction: "",
		notes: "",
		favourite: false,
		...initial,
	});
	const [showFormPicker, setShowFormPicker] = useState(false);
	const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
	const handleSubmit = () => {
		if (!form.date || !form.name || !form.category) {
			onSubmit(null, "Please fill in Date, Name and Category.");
			return;
		}
		onSubmit(form);
		if (!initial.id)
			setForm({
				date: today,
				name: "",
				category: "",
				form: "",
				reaction: "",
				notes: "",
				favourite: false,
			});
	};
	return (
		<View style={{ gap: 16 }}>
			{/* Date — now uses DateField instead of TextInput */}
			<DateField
				label="Date"
				value={form.date}
				onChange={(v) => set("date", v)}
				minYear={2020}
				maxYear={new Date().getFullYear() + 1}
			/>

			{/* Name — FIX: backgroundColor explicitly white, no yellow autofill */}
			<View>
				<Text style={s.label}>Food or Drink Name</Text>
				<TextInput
					value={form.name}
					onChangeText={(v) => set("name", v)}
					placeholder="e.g. Banana, Water, Formula"
					style={[s.input, { backgroundColor: C.white }]}
					placeholderTextColor={C.mutedText}
					autoComplete="off"
					autoCorrect={false}
				/>
			</View>

			{/* Category */}
			<View>
				<Text style={s.label}>Category</Text>
				<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
					{CATEGORIES.map((c) => {
						const sel = form.category === c.value;
						return (
							<TouchableOpacity
								key={c.value}
								onPress={() => set("category", c.value)}
								style={{
									backgroundColor: sel ? c.color : C.bgPurple,
									borderColor: sel ? c.color : C.border,
									borderWidth: 2,
									borderRadius: 10,
									padding: 8,
									alignItems: "center",
									width: "22%",
									gap: 4,
								}}
								activeOpacity={0.8}>
								<Text
									style={{
										fontSize: 9,
										fontWeight: "700",
										color: sel ? C.white : C.mutedText,
										textAlign: "center",
										textTransform: "uppercase",
									}}>
									{c.value}
								</Text>
							</TouchableOpacity>
						);
					})}
				</View>
			</View>

			{/* Form/Texture */}
			<View>
				<Text style={s.label}>Form / Texture</Text>
				<TouchableOpacity
					onPress={() => setShowFormPicker(true)}
					style={[
						s.input,
						{
							flexDirection: "row",
							justifyContent: "space-between",
							alignItems: "center",
							backgroundColor: C.white,
						},
					]}>
					<Text
						style={{
							color: form.form ? C.textCharcoal : C.mutedText,
							fontWeight: "600",
						}}>
						{form.form || "Select form…"}
					</Text>
					<Icon name="chevDown" size={14} color={C.mutedText} />
				</TouchableOpacity>
				<PickerModal
					visible={showFormPicker}
					title="Form / Texture"
					options={FORMS}
					value={form.form}
					onSelect={(v) => set("form", v)}
					onClose={() => setShowFormPicker(false)}
				/>
			</View>

			{/* Reaction */}
			<View>
				<Text style={s.label}>Reaction</Text>
				<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
					{REACTIONS.map((r) => {
						const sel = form.reaction === r.value;
						return (
							<TouchableOpacity
								key={r.value}
								onPress={() => set("reaction", r.value)}
								style={{
									backgroundColor: sel ? r.bg : C.bgPurple,
									borderColor: sel ? r.border : C.border,
									borderWidth: 2,
									borderRadius: 10,
									paddingVertical: 10,
									paddingHorizontal: 6,
									flex: 1,
									alignItems: "center",
									minWidth: "30%",
								}}
								activeOpacity={0.8}>
								<Text
									style={{
										fontWeight: "700",
										fontSize: 11,
										color: sel ? r.color : C.mutedText,
										textTransform: "uppercase",
									}}>
									{r.value}
								</Text>
							</TouchableOpacity>
						);
					})}
				</View>
			</View>

			{/* Notes */}
			<View>
				<Text style={s.label}>Notes (optional)</Text>
				<TextInput
					value={form.notes}
					onChangeText={(v) => set("notes", v)}
					placeholder="Texture feedback, observations…"
					multiline
					numberOfLines={3}
					style={[
						s.input,
						{ height: 80, textAlignVertical: "top", backgroundColor: C.white },
					]}
					placeholderTextColor={C.mutedText}
					autoComplete="off"
				/>
			</View>

			{/* Favourite */}
			<TouchableOpacity
				onPress={() => set("favourite", !form.favourite)}
				style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
				activeOpacity={0.8}>
				<View
					style={{
						width: 22,
						height: 22,
						borderRadius: 6,
						borderWidth: 2,
						borderColor: C.primaryPurple,
						backgroundColor: form.favourite ? C.primaryPurple : C.white,
						alignItems: "center",
						justifyContent: "center",
					}}>
					{form.favourite && <Icon name="check" size={13} color={C.white} />}
				</View>
				<Icon name="starFill" size={14} color="#d4a017" />
				<Text
					style={{
						fontWeight: "700",
						fontSize: 13,
						color: C.textCharcoal,
						textTransform: "uppercase",
						letterSpacing: 0.5,
					}}>
					Mark as Favourite
				</Text>
			</TouchableOpacity>

			<PrimaryBtn label={buttonLabel} onPress={handleSubmit} />
		</View>
	);
}

// ─── LOADING SCREEN ───────────────────────────────────────────────────────────
function LoadingScreen() {
	return (
		<View
			style={{
				flex: 1,
				alignItems: "center",
				justifyContent: "center",
				backgroundColor: C.bgMain,
			}}>
			<ActivityIndicator size="large" color={C.primaryPurple} />
			<Text
				style={{
					color: C.primaryPurple,
					fontWeight: "700",
					marginTop: 12,
					textTransform: "uppercase",
					letterSpacing: 0.5,
				}}>
				Loading…
			</Text>
		</View>
	);
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function DashboardScreen({ child, foodLog, onNavigate }) {
	const groups = groupByFood(foodLog);
	const keys = Object.keys(groups);
	const unique = keys.length,
		total = foodLog.length;
	const liked = keys.filter((k) =>
		groups[k].attempts.some(
			(a) => a.reaction === "Loved" || a.reaction === "Good",
		),
	).length;
	const disliked = keys.filter((k) =>
		groups[k].attempts.some((a) => a.reaction === "Rejected"),
	).length;
	const allergic = foodLog.filter((f) => f.reaction === "Allergic").length;
	const favourites = keys.filter((k) =>
		groups[k].attempts.some((a) => a.favourite),
	);
	const liquids = keys.filter((k) => groups[k].category === "Liquids").length;
	const weeks = child ? calcAgeWeeks(child.dob) : null;
	const months = child ? calcAgeMonths(child.dob) : null;
	const catBreakdown = {};
	keys.forEach((k) => {
		const cat = groups[k].category || "Other";
		catBreakdown[cat] = (catBreakdown[cat] || 0) + 1;
	});
	const recent = [...foodLog]
		.sort((a, b) => new Date(b.date) - new Date(a.date))
		.slice(0, 5);
	return (
		<ScrollView
			style={{ flex: 1 }}
			contentContainerStyle={{ gap: 16, paddingBottom: 20 }}
			showsVerticalScrollIndicator={false}>
			{child ? (
				<View
					style={{
						backgroundColor: C.primaryPurple,
						borderRadius: 20,
						padding: 22,
						flexDirection: "row",
						justifyContent: "space-between",
						alignItems: "center",
					}}>
					<View style={{ flex: 1 }}>
						<Text
							style={{
								fontSize: 10,
								fontWeight: "700",
								color: "rgba(255,255,255,0.8)",
								textTransform: "uppercase",
								letterSpacing: 1,
							}}>
							Tracking for
						</Text>
						<Text
							style={{
								fontSize: 26,
								fontWeight: "700",
								color: C.white,
								marginTop: 2,
							}}>
							{child.name}
						</Text>
						{weeks !== null && (
							<Text
								style={{
									fontSize: 13,
									color: "rgba(255,255,255,0.9)",
									marginTop: 4,
								}}>
								{weeks} weeks · {months} months old
							</Text>
						)}
						{child.weaningStart && (
							<Text
								style={{
									fontSize: 11,
									color: "rgba(255,255,255,0.7)",
									marginTop: 2,
								}}>
								Weaning from {formatDate(child.weaningStart)}
							</Text>
						)}
					</View>
					<Icon name="baby" size={50} color="rgba(255,255,255,0.2)" />
				</View>
			) : (
				<Card>
					<View style={{ alignItems: "center", paddingVertical: 16 }}>
						<Icon name="baby" size={38} color={C.secondaryPurple} />
						<Text
							style={{
								color: C.mutedText,
								fontWeight: "600",
								marginTop: 10,
								fontSize: 13,
							}}>
							No child selected.
						</Text>
						<TouchableOpacity
							onPress={() => onNavigate("children")}
							style={{ marginTop: 8 }}>
							<Text
								style={{
									color: C.primaryPurple,
									fontWeight: "700",
									textDecorationLine: "underline",
								}}>
								Add a child
							</Text>
						</TouchableOpacity>
					</View>
				</Card>
			)}
			<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
				<StatCard
					icon="grid"
					label="Foods Tried"
					value={unique}
					color={C.primaryPurple}
					bg={C.bgPurple}
				/>
				<StatCard
					icon="list"
					label="Attempts"
					value={total}
					color="#4ab8d8"
					bg="#e8f6fb"
				/>
				<StatCard
					icon="check"
					label="Liked"
					value={liked}
					color={C.primaryGreen}
					bg={C.bgGreen}
				/>
				<StatCard
					icon="alert"
					label="Disliked"
					value={disliked}
					color={C.warningStroke}
					bg={C.bgWarning}
				/>
				<StatCard
					icon="alert"
					label="Allergic"
					value={allergic}
					color="#c0392b"
					bg="#fde8e8"
				/>
				<StatCard
					icon="starFill"
					label="Favourites"
					value={favourites.length}
					color="#d4a017"
					bg="#fef9e7"
				/>
				<StatCard
					icon="water"
					label="Liquids"
					value={liquids}
					color="#4ab8d8"
					bg="#e8f6fb"
				/>
			</View>
			{Object.keys(catBreakdown).length > 0 && (
				<Card>
					<SectionTitle icon="chart">Category Breakdown</SectionTitle>
					{Object.entries(catBreakdown)
						.sort((a, b) => b[1] - a[1])
						.map(([cat, count]) => {
							const cfg =
								CATEGORIES.find((c) => c.value === cat) || CATEGORIES[7];
							const pct = Math.round((count / unique) * 100);
							return (
								<View
									key={cat}
									style={{
										flexDirection: "row",
										alignItems: "center",
										gap: 10,
										marginBottom: 10,
									}}>
									<View style={{ flex: 1 }}>
										<View
											style={{
												flexDirection: "row",
												justifyContent: "space-between",
												marginBottom: 4,
											}}>
											<Text style={s.smallLabel}>{cat}</Text>
											<Text style={s.smallLabel}>{count}</Text>
										</View>
										<View
											style={{
												backgroundColor: C.borderLight,
												borderRadius: 999,
												height: 7,
												overflow: "hidden",
											}}>
											<View
												style={{
													backgroundColor: cfg.color,
													height: "100%",
													width: `${pct}%`,
													borderRadius: 999,
												}}
											/>
										</View>
									</View>
								</View>
							);
						})}
				</Card>
			)}
			{recent.length > 0 && (
				<Card>
					<View
						style={{
							flexDirection: "row",
							justifyContent: "space-between",
							alignItems: "center",
							marginBottom: 14,
						}}>
						<SectionTitle icon="clock">Recent Activity</SectionTitle>
						<TouchableOpacity onPress={() => onNavigate("log")}>
							<Text
								style={{
									color: C.primaryPurple,
									fontWeight: "700",
									fontSize: 12,
									textTransform: "uppercase",
								}}>
								View All →
							</Text>
						</TouchableOpacity>
					</View>
					{recent.map((e) => (
						<View
							key={e.id}
							style={{
								flexDirection: "row",
								alignItems: "center",
								gap: 12,
								padding: 10,
								backgroundColor: C.white,
								borderColor: C.borderLight,
								borderWidth: 2,
								borderRadius: 12,
								marginBottom: 6,
							}}>
							<View style={{ flex: 1 }}>
								<Text
									style={{
										fontWeight: "700",
										fontSize: 13,
										color: C.textCharcoal,
									}}>
									{e.name}
									{e.favourite ? " ★" : ""}
								</Text>
								<Text
									style={{ fontSize: 11, color: C.mutedText, marginTop: 2 }}>
									{formatDate(e.date)}
									{e.form ? ` · ${e.form}` : ""}
								</Text>
							</View>
							<ReactionBadge reaction={e.reaction} />
						</View>
					))}
				</Card>
			)}
			{foodLog.length === 0 && (
				<View style={{ alignItems: "center", paddingVertical: 40 }}>
					<Icon name="utensils" size={42} color={C.secondaryPurple} />
					<Text style={[s.sectionTitle, { marginTop: 14, marginBottom: 8 }]}>
						No foods logged yet
					</Text>
					<Text style={{ color: C.mutedText, fontSize: 13, marginBottom: 18 }}>
						Start tracking your little one's weaning journey
					</Text>
					<TouchableOpacity
						onPress={() => onNavigate("add")}
						style={[s.btnPrimary, { paddingHorizontal: 28 }]}>
						<Text style={s.btnPrimaryText}>Log First Food</Text>
					</TouchableOpacity>
				</View>
			)}
		</ScrollView>
	);
}

async function exportFoodLogAsPDF(foodLog, childName) {
	if (!foodLog.length) {
		Alert.alert("Nothing to export", "Add some food entries first.");
		return;
	}

	const groups = groupByFood(foodLog);
	const keys = Object.keys(groups);

	// Build HTML rows for each food group
	const rows = keys
		.map((key) => {
			const g = groups[key];
			const latest = g.attempts.at(-1);
			const likedCnt = g.attempts.filter(
				(a) => a.reaction === "Loved" || a.reaction === "Good",
			).length;
			const pct = Math.round((likedCnt / g.attempts.length) * 100);
			const hasAllergy = g.attempts.some((a) => a.reaction === "Allergic");

			const attemptsHTML = g.attempts
				.map(
					(a, i) => `
      <tr style="background:${i % 2 === 0 ? "#f9f7fe" : "#ffffff"}">
        <td style="padding:8px 12px;color:#8a7aaa;font-size:12px;">Attempt ${i + 1}</td>
        <td style="padding:8px 12px;font-size:12px;">${formatDate(a.date)}</td>
        <td style="padding:8px 12px;font-size:12px;">${a.form || "—"}</td>
        <td style="padding:8px 12px;font-size:12px;color:${reactionCfg(a.reaction).color};font-weight:700;">${a.reaction || "—"}</td>
        <td style="padding:8px 12px;font-size:12px;color:#8a7aaa;font-style:italic;">${a.notes || ""}</td>
      </tr>
    `,
				)
				.join("");

			return `
      <div style="margin-bottom:20px;border-radius:12px;overflow:hidden;border:2px solid ${hasAllergy ? "#e07070" : "#ece8f9"};">
        <div style="background:${hasAllergy ? "#fde8e8" : "#ede8f7"};padding:12px 16px;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <span style="font-weight:700;font-size:15px;color:#5a2d7a;">${g.name}</span>
            ${hasAllergy ? '<span style="margin-left:10px;background:#fee2e2;color:#c0392b;border-radius:999px;padding:2px 10px;font-size:11px;font-weight:700;">⚠ ALLERGY</span>' : ""}
          </div>
          <div style="display:flex;gap:12px;align-items:center;">
            <span style="font-size:12px;color:#8a7aaa;">${g.category || "—"}</span>
            <span style="font-size:12px;color:#8a7aaa;">${g.attempts.length} attempt${g.attempts.length !== 1 ? "s" : ""}</span>
            <span style="font-size:12px;color:#3db87a;font-weight:700;">${pct}% liked</span>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f3f0fa;">
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:#8a7aaa;text-transform:uppercase;letter-spacing:0.5px;">#</th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:#8a7aaa;text-transform:uppercase;letter-spacing:0.5px;">Date</th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:#8a7aaa;text-transform:uppercase;letter-spacing:0.5px;">Form</th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:#8a7aaa;text-transform:uppercase;letter-spacing:0.5px;">Reaction</th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:#8a7aaa;text-transform:uppercase;letter-spacing:0.5px;">Notes</th>
            </tr>
          </thead>
          <tbody>${attemptsHTML}</tbody>
        </table>
      </div>
    `;
		})
		.join("");

	const totalFoods = keys.length;
	const totalAttempts = foodLog.length;
	const liked = keys.filter((k) =>
		groups[k].attempts.some(
			(a) => a.reaction === "Loved" || a.reaction === "Good",
		),
	).length;
	const allergic = foodLog.filter((f) => f.reaction === "Allergic").length;

	const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8"/>
      <style>
        body { font-family: -apple-system, Helvetica, Arial, sans-serif; margin: 0; padding: 32px; background: #ffffff; color: #3d3d3d; }
        h1 { color: #5a2d7a; font-size: 26px; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 1px; }
        .subtitle { color: #8a7aaa; font-size: 14px; margin-bottom: 24px; }
        .stats { display: flex; gap: 16px; margin-bottom: 28px; flex-wrap: wrap; }
        .stat { background: #ede8f7; border-radius: 10px; padding: 12px 18px; text-align: center; }
        .stat-val { font-size: 24px; font-weight: 700; color: #9b7fe8; }
        .stat-lbl { font-size: 11px; color: #8a7aaa; text-transform: uppercase; letter-spacing: 0.5px; }
        .section-title { font-size: 13px; font-weight: 700; color: #5a2d7a; text-transform: uppercase; letter-spacing: 1px; margin: 24px 0 12px; }
        .footer { margin-top: 40px; padding-top: 16px; border-top: 2px solid #ece8f9; font-size: 11px; color: #8a7aaa; text-align: center; }
      </style>
    </head>
    <body>
      <h1>🌱 Munch Sprouts</h1>
      <p class="subtitle">
        Food Log Report${childName ? ` — ${childName}` : ""} &nbsp;·&nbsp; Generated ${formatDate(new Date().toISOString().split("T")[0])}
      </p>

      <div class="stats">
        <div class="stat"><div class="stat-val">${totalFoods}</div><div class="stat-lbl">Foods tried</div></div>
        <div class="stat"><div class="stat-val">${totalAttempts}</div><div class="stat-lbl">Total attempts</div></div>
        <div class="stat"><div class="stat-val">${liked}</div><div class="stat-lbl">Liked</div></div>
        ${allergic > 0 ? `<div class="stat" style="background:#fde8e8;"><div class="stat-val" style="color:#c0392b;">${allergic}</div><div class="stat-lbl" style="color:#c0392b;">Allergic reactions</div></div>` : ""}
      </div>

      <div class="section-title">Food Log (${totalFoods} foods)</div>
      ${rows}

      <div class="footer">
        Generated by Munch Sprouts · For informational purposes only.<br/>
        Always consult your GP or Health Visitor before starting weaning.
      </div>
    </body>
    </html>
  `;

	try {
		const { uri } = await Print.printToFileAsync({ html, base64: false });
		await Sharing.shareAsync(uri, {
			mimeType: "application/pdf",
			dialogTitle: `${childName || "MunchSprouts"} Food Log`,
			UTI: "com.adobe.pdf",
		});
	} catch (e) {
		Alert.alert("Export failed", "Could not generate PDF. Please try again.");
	}
}

// ─── LOG SCREEN ───────────────────────────────────────────────────────────────
function LogScreen({
	foodLog,
	childName,
	onEdit,
	onDelete,
	onToggleFavourite,
}) {
	const [search, setSearch] = useState("");
	const [sortBy, setSortBy] = useState("date-desc");
	const [expanded, setExpanded] = useState(new Set());
	const groups = groupByFood(foodLog);
	let keys = Object.keys(groups);
	if (search)
		keys = keys.filter((k) =>
			normalize(groups[k].name).includes(normalize(search)),
		);
	if (sortBy === "date-desc")
		keys.sort(
			(a, b) =>
				new Date(groups[b].attempts.at(-1).date) -
				new Date(groups[a].attempts.at(-1).date),
		);
	else if (sortBy === "alpha") keys.sort((a, b) => a.localeCompare(b));
	else if (sortBy === "attempts")
		keys.sort((a, b) => groups[b].attempts.length - groups[a].attempts.length);
	const toggle = (k) =>
		setExpanded((p) => {
			const n = new Set(p);
			n.has(k) ? n.delete(k) : n.add(k);
			return n;
		});
	return (
		<View style={{ flex: 1 }}>
			<Card style={{ marginBottom: 12 }}>
				<View
					style={[
						s.input,
						{
							flexDirection: "row",
							alignItems: "center",
							gap: 8,
							marginBottom: 10,
							backgroundColor: C.white,
						},
					]}>
					<Icon name="search" size={14} color={C.mutedText} />
					<TextInput
						value={search}
						onChangeText={setSearch}
						placeholder="Search foods…"
						style={{ flex: 1, color: C.textCharcoal, fontWeight: "600" }}
						placeholderTextColor={C.mutedText}
					/>
				</View>
				<View style={{ flexDirection: "row", gap: 8 }}>
					{["date-desc", "alpha", "attempts"].map((opt) => (
						<TouchableOpacity
							key={opt}
							onPress={() => setSortBy(opt)}
							style={{
								backgroundColor: sortBy === opt ? C.primaryPurple : C.bgPurple,
								borderColor: sortBy === opt ? C.primaryPurple : C.border,
								borderWidth: 2,
								borderRadius: 999,
								paddingHorizontal: 12,
								paddingVertical: 5,
							}}>
							<Text
								style={{
									fontSize: 10,
									fontWeight: "700",
									color: sortBy === opt ? C.white : C.mutedText,
									textTransform: "uppercase",
								}}>
								{opt === "date-desc"
									? "Newest"
									: opt === "alpha"
										? "A–Z"
										: "Attempts"}
							</Text>
						</TouchableOpacity>
					))}
				</View>
			</Card>
			<Text style={[s.smallLabel, { marginBottom: 8 }]}>
				{keys.length} food{keys.length !== 1 ? "s" : ""}
			</Text>
			<ScrollView
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{ gap: 10, paddingBottom: 20 }}>
				{keys.map((key) => {
					const g = groups[key];
					const latest = g.attempts.at(-1);
					const likedCnt = g.attempts.filter(
						(a) => a.reaction === "Loved" || a.reaction === "Good",
					).length;
					const pct = Math.round((likedCnt / g.attempts.length) * 100);
					const hasAllergy = g.attempts.some((a) => a.reaction === "Allergic");
					const hasFav = g.attempts.some((a) => a.favourite);
					const isOpen = expanded.has(key);
					return (
						<View
							key={key}
							style={[
								s.card,
								{
									padding: 0,
									overflow: "hidden",
									borderColor: hasAllergy ? "#e07070" : C.borderLight,
									backgroundColor: hasAllergy ? "#fde8e8" : C.white,
								},
							]}>
							<TouchableOpacity
								onPress={() => toggle(key)}
								style={{
									flexDirection: "row",
									alignItems: "center",
									padding: 14,
									gap: 12,
								}}
								activeOpacity={0.8}>
								<View style={{ flex: 1 }}>
									<View
										style={{
											flexDirection: "row",
											alignItems: "center",
											gap: 6,
											flexWrap: "wrap",
										}}>
										<Text
											style={{
												fontWeight: "700",
												fontSize: 14,
												color: C.primaryPinkDark,
											}}>
											{g.name}
										</Text>
										{hasFav && (
											<Icon name="starFill" size={12} color="#d4a017" />
										)}
										{hasAllergy && (
											<View
												style={{
													backgroundColor: "#fde8e8",
													borderColor: "#e07070",
													borderWidth: 1,
													borderRadius: 999,
													paddingHorizontal: 6,
													paddingVertical: 1,
												}}>
												<Text
													style={{
														fontSize: 9,
														fontWeight: "700",
														color: "#c0392b",
														textTransform: "uppercase",
													}}>
													Allergy
												</Text>
											</View>
										)}
										<View
											style={{
												backgroundColor: C.bgPurple,
												borderColor: C.border,
												borderWidth: 1.5,
												borderRadius: 999,
												paddingHorizontal: 6,
												paddingVertical: 1,
											}}>
											<Text
												style={{
													fontSize: 9,
													fontWeight: "700",
													color: C.primaryPurple,
												}}>
												{g.attempts.length}×
											</Text>
										</View>
									</View>
									<View
										style={{
											flexDirection: "row",
											alignItems: "center",
											gap: 8,
											marginTop: 5,
										}}>
										<ReactionBadge reaction={latest.reaction} />
										<Text style={{ fontSize: 11, color: C.mutedText }}>
											{formatDate(latest.date)}
										</Text>
									</View>
									<View
										style={{
											flexDirection: "row",
											alignItems: "center",
											gap: 6,
											marginTop: 6,
										}}>
										<View
											style={{
												backgroundColor: C.borderLight,
												borderRadius: 999,
												height: 6,
												width: 60,
												overflow: "hidden",
											}}>
											<View
												style={{
													backgroundColor: C.primaryGreen,
													height: "100%",
													width: `${pct}%`,
													borderRadius: 999,
												}}
											/>
										</View>
										<Text
											style={{
												fontSize: 10,
												color: C.mutedText,
												fontWeight: "700",
											}}>
											{pct}%
										</Text>
									</View>
								</View>
								<Icon
									name={isOpen ? "chevUp" : "chevDown"}
									size={15}
									color={C.mutedText}
								/>
							</TouchableOpacity>
							{isOpen &&
								g.attempts.map((a, i) => (
									<View
										key={a.id}
										style={{
											padding: 12,
											backgroundColor: i % 2 === 0 ? C.bgPurple : C.white,
											borderTopWidth: 1,
											borderTopColor: C.borderLight,
										}}>
										<View
											style={{
												flexDirection: "row",
												justifyContent: "space-between",
												alignItems: "flex-start",
												gap: 8,
											}}>
											<View style={{ flex: 1 }}>
												<Text style={[s.smallLabel, { marginBottom: 5 }]}>
													Attempt {i + 1} · {formatDate(a.date)}
													{a.favourite ? " ★" : ""}
												</Text>
												<View
													style={{
														flexDirection: "row",
														gap: 6,
														flexWrap: "wrap",
														alignItems: "center",
													}}>
													{a.form && (
														<View
															style={{
																backgroundColor: C.bgPurple,
																borderColor: C.border,
																borderWidth: 1.5,
																borderRadius: 999,
																paddingHorizontal: 8,
																paddingVertical: 2,
															}}>
															<Text
																style={{
																	fontSize: 10,
																	fontWeight: "700",
																	color: C.mutedText,
																	textTransform: "uppercase",
																}}>
																{a.form}
															</Text>
														</View>
													)}
													<ReactionBadge reaction={a.reaction} />
												</View>
												{a.notes ? (
													<Text
														style={{
															fontSize: 11,
															color: C.mutedText,
															marginTop: 6,
															fontStyle: "italic",
														}}>
														"{a.notes}"
													</Text>
												) : null}
											</View>
											<View style={{ flexDirection: "row", gap: 5 }}>
												<SecondaryBtn
													onPress={() => onToggleFavourite(a.id)}
													style={{ padding: 7 }}>
													<Icon
														name={a.favourite ? "starFill" : "star"}
														size={13}
														color="#d4a017"
													/>
												</SecondaryBtn>
												<SecondaryBtn
													onPress={() => onEdit(a)}
													style={{ padding: 7 }}>
													<Icon name="edit" size={13} color={C.primaryPurple} />
												</SecondaryBtn>
												<DangerBtn
													onPress={() =>
														Alert.alert("Delete", "Delete this entry?", [
															{ text: "Cancel" },
															{
																text: "Delete",
																style: "destructive",
																onPress: () => onDelete(a.id),
															},
														])
													}
													style={{ padding: 7 }}>
													<Icon
														name="trash"
														size={13}
														color={C.warningStroke}
													/>
												</DangerBtn>
											</View>
										</View>
									</View>
								))}
						</View>
					);
				})}
			</ScrollView>
			<TouchableOpacity
				onPress={() => exportFoodLogAsPDF(foodLog, childName)}
				style={{
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "center",
					gap: 8,
					backgroundColor: C.bgPurple,
					borderColor: C.primaryPurple,
					borderWidth: 2,
					borderRadius: 12,
					paddingVertical: 12,
					marginTop: 12,
				}}
				activeOpacity={0.8}>
				<Icon name="download" size={16} color={C.primaryPurple} />
				<Text
					style={{
						fontWeight: "700",
						fontSize: 13,
						color: C.primaryPurple,
						textTransform: "uppercase",
						letterSpacing: 0.5,
					}}>
					Export as PDF
				</Text>
			</TouchableOpacity>
		</View>
	);
}

// ─── CHILDREN SCREEN ──────────────────────────────────────────────────────────
function ChildrenScreen({
	children,
	activeChildId,
	onSetActive,
	onAdd,
	onEdit,
	onDelete,
}) {
	const [modalVisible, setModalVisible] = useState(false);
	const [editTarget, setEditTarget] = useState(null);
	const [form, setForm] = useState({ name: "", dob: "", weaningStart: "" });
	const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
	const openAdd = () => {
		setForm({ name: "", dob: "", weaningStart: "" });
		setEditTarget(null);
		setModalVisible(true);
	};
	const openEdit = (child) => {
		setForm({
			name: child.name,
			dob: child.dob,
			weaningStart: child.weaningStart || "",
		});
		setEditTarget(child);
		setModalVisible(true);
	};
	const save = () => {
		if (!form.name || !form.dob) return;
		editTarget ? onEdit({ ...editTarget, ...form }) : onAdd({ ...form }); // ← removed id: Date.now()
		setModalVisible(false);
	};
	return (
		<View style={{ flex: 1 }}>
			<View
				style={{
					flexDirection: "row",
					justifyContent: "space-between",
					alignItems: "center",
					marginBottom: 16,
				}}>
				<Text style={s.pageTitle}>Children</Text>
				<TouchableOpacity
					onPress={openAdd}
					style={[s.btnPrimary, { paddingHorizontal: 16, width: "auto" }]}>
					<View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
						<Icon name="plus" size={13} color={C.white} />
						<Text style={s.btnPrimaryText}>Add Child</Text>
					</View>
				</TouchableOpacity>
			</View>
			<ScrollView
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{ gap: 12 }}>
				{children.length === 0 && (
					<Card>
						<View style={{ alignItems: "center", paddingVertical: 32 }}>
							<Icon name="users" size={38} color={C.secondaryPurple} />
							<Text
								style={{
									color: C.mutedText,
									fontWeight: "600",
									marginTop: 12,
									textTransform: "uppercase",
									fontSize: 12,
								}}>
								No children added yet
							</Text>
						</View>
					</Card>
				)}
				{children.map((child) => {
					const weeks = calcAgeWeeks(child.dob),
						months = calcAgeMonths(child.dob),
						isActive = child.id === activeChildId;
					return (
						<Card
							key={child.id}
							style={{
								borderColor: isActive ? C.primaryPurple : C.borderLight,
								backgroundColor: isActive ? C.bgPurple : C.white,
							}}>
							<View
								style={{
									flexDirection: "row",
									justifyContent: "space-between",
									alignItems: "flex-start",
									gap: 12,
								}}>
								<View style={{ flex: 1 }}>
									<View
										style={{
											flexDirection: "row",
											alignItems: "center",
											gap: 8,
										}}>
										<Text
											style={{
												fontWeight: "700",
												fontSize: 16,
												color: C.primaryPinkDark,
												textTransform: "uppercase",
												letterSpacing: 0.5,
											}}>
											{child.name}
										</Text>
										{isActive && (
											<View
												style={{
													backgroundColor: C.primaryPurple,
													borderRadius: 999,
													paddingHorizontal: 8,
													paddingVertical: 2,
												}}>
												<Text
													style={{
														fontSize: 9,
														fontWeight: "700",
														color: C.white,
														textTransform: "uppercase",
													}}>
													Active
												</Text>
											</View>
										)}
									</View>
									<Text
										style={{ fontSize: 12, color: C.mutedText, marginTop: 4 }}>
										Born {formatDate(child.dob)} · {weeks} weeks ({months}{" "}
										months)
									</Text>
									{child.weaningStart ? (
										<Text
											style={{
												fontSize: 11,
												color: C.mutedText,
												marginTop: 2,
											}}>
											Weaning from {formatDate(child.weaningStart)}
										</Text>
									) : null}
								</View>
								<View style={{ flexDirection: "row", gap: 6 }}>
									{!isActive && (
										<TouchableOpacity
											onPress={() => onSetActive(child.id)}
											style={[
												s.btnPrimary,
												{
													width: "auto",
													paddingHorizontal: 12,
													paddingVertical: 8,
												},
											]}>
											<Text style={[s.btnPrimaryText, { fontSize: 11 }]}>
												Select
											</Text>
										</TouchableOpacity>
									)}
									<SecondaryBtn
										onPress={() => openEdit(child)}
										style={{ padding: 8 }}>
										<Icon name="edit" size={13} color={C.primaryPurple} />
									</SecondaryBtn>
									<DangerBtn
										onPress={() =>
											Alert.alert(
												"Delete",
												`Delete ${child.name} and all their data?`,
												[
													{ text: "Cancel" },
													{
														text: "Delete",
														style: "destructive",
														onPress: () => onDelete(child.id),
													},
												],
											)
										}
										style={{ padding: 8 }}>
										<Icon name="trash" size={13} color={C.warningStroke} />
									</DangerBtn>
								</View>
							</View>
						</Card>
					);
				})}
			</ScrollView>

			{/* Add / Edit Modal — now uses DateField for DOB and weaning date */}
			<Modal
				visible={modalVisible}
				transparent
				animationType="slide"
				onRequestClose={() => setModalVisible(false)}>
				<KeyboardAvoidingView
					behavior={Platform.OS === "ios" ? "padding" : "height"}
					style={s.modalOverlay}>
					<View style={s.modalSheet}>
						<View
							style={{
								flexDirection: "row",
								justifyContent: "space-between",
								alignItems: "center",
								marginBottom: 20,
							}}>
							<Text style={s.modalTitle}>
								{editTarget ? "Edit Child" : "Add Child"}
							</Text>
							<TouchableOpacity
								onPress={() => setModalVisible(false)}
								style={{
									backgroundColor: C.bgPurple,
									borderRadius: 8,
									padding: 6,
								}}>
								<Icon name="close" size={15} color={C.mutedText} />
							</TouchableOpacity>
						</View>
						<ScrollView showsVerticalScrollIndicator={false}>
							<View style={{ gap: 16, paddingBottom: 20 }}>
								{/* Name — FIX: backgroundColor white, autoComplete off */}
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
								{/* DOB — DateField */}
								<DateField
									label="Date of Birth"
									value={form.dob}
									onChange={(v) => set("dob", v)}
									minYear={2018}
									maxYear={new Date().getFullYear()}
								/>
								{/* Weaning Start — DateField */}
								<DateField
									label="Weaning Start Date (optional)"
									value={form.weaningStart}
									onChange={(v) => set("weaningStart", v)}
									minYear={2018}
									maxYear={new Date().getFullYear() + 1}
								/>
								<PrimaryBtn
									label={editTarget ? "Update Child" : "Save Child"}
									onPress={save}
								/>
							</View>
						</ScrollView>
					</View>
				</KeyboardAvoidingView>
			</Modal>
		</View>
	);
}

// ─── RECIPES SCREEN ───────────────────────────────────────────────────────────
function RecipesScreen({ isPro, onUpgradePro }) {
	const [expandedId, setExpandedId] = useState(null);
	const [filterAge, setFilterAge] = useState("all");
	const [upgradeLoading, setUpgradeLoading] = useState(false);
	const ageGroups = ["all", "6m+", "7m+", "9m+", "12m+"];
	const filtered =
		filterAge === "all"
			? RECIPES
			: RECIPES.filter((r) => r.ageGroup === filterAge);
	const toggle = (id, locked) => {
		if (locked && !isPro) return;
		setExpandedId((prev) => (prev === id ? null : id));
	};
	return (
		<ScrollView
			showsVerticalScrollIndicator={false}
			contentContainerStyle={{ gap: 14, paddingBottom: 20 }}>
			{!isPro && (
				<View
					style={{
						backgroundColor: "#2d1f5e",
						borderRadius: 16,
						padding: 20,
						overflow: "hidden",
					}}>
					{/* Background decoration circles */}
					<View
						style={{
							position: "absolute",
							top: -20,
							right: -20,
							width: 120,
							height: 120,
							borderRadius: 60,
							backgroundColor: "rgba(155,127,232,0.2)",
						}}
					/>
					<View
						style={{
							position: "absolute",
							bottom: -30,
							left: -10,
							width: 80,
							height: 80,
							borderRadius: 40,
							backgroundColor: "rgba(155,127,232,0.15)",
						}}
					/>

					{/* Header */}
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: 10,
							marginBottom: 12,
						}}>
						<View
							style={{
								backgroundColor: C.warningStroke,
								borderRadius: 10,
								width: 36,
								height: 36,
								alignItems: "center",
								justifyContent: "center",
							}}>
							<Icon name="crown" size={18} color={C.white} />
						</View>
						<Text
							style={{
								fontWeight: "700",
								fontSize: 18,
								color: C.white,
								letterSpacing: 0.5,
							}}>
							Munch Sprouts Pro
						</Text>
					</View>

					{/* Price */}
					<View
						style={{
							flexDirection: "row",
							alignItems: "baseline",
							gap: 4,
							marginBottom: 12,
						}}>
						<Text style={{ fontSize: 32, fontWeight: "700", color: C.white }}>
							£4.99
						</Text>
						<Text style={{ fontSize: 14, color: "rgba(255,255,255,0.7)" }}>
							one-off
						</Text>
					</View>

					{/* Features */}
					{[
						"Access to all BLW recipes",
						"Recipes for every age group (6m+, 7m+, 9m+, 12m+)",
						"Nutritionist-approved meal ideas",
						"New recipes added regularly",
						"More premium features coming soon",
					].map((feature, i) => (
						<View
							key={i}
							style={{
								flexDirection: "row",
								alignItems: "center",
								gap: 8,
								marginBottom: 6,
							}}>
							<View
								style={{
									width: 18,
									height: 18,
									borderRadius: 9,
									backgroundColor: C.primaryGreen,
									alignItems: "center",
									justifyContent: "center",
									flexShrink: 0,
								}}>
								<Icon name="check" size={11} color={C.white} />
							</View>
							<Text
								style={{
									fontSize: 13,
									color: "rgba(255,255,255,0.9)",
									flex: 1,
								}}>
								{feature}
							</Text>
						</View>
					))}

					{/* Purchase button */}
					<TouchableOpacity
						onPress={() => {
							setUpgradeLoading(true);
							onUpgradePro().finally(() => setUpgradeLoading(false));
						}}
						disabled={upgradeLoading}
						style={{
							backgroundColor: C.warningStroke,
							borderRadius: 12,
							paddingVertical: 14,
							alignItems: "center",
							justifyContent: "center",
							marginTop: 16,
							flexDirection: "row",
							gap: 8,
							opacity: upgradeLoading ? 0.7 : 1,
						}}
						activeOpacity={0.85}>
						{upgradeLoading ? (
							<ActivityIndicator color={C.white} />
						) : (
							<>
								<Icon name="crown" size={16} color={C.white} />
								<Text
									style={{
										color: C.white,
										fontWeight: "700",
										fontSize: 15,
										letterSpacing: 0.5,
									}}>
									Upgrade for £4.99
								</Text>
							</>
						)}
					</TouchableOpacity>

					<Text
						style={{
							fontSize: 11,
							color: "rgba(255,255,255,0.5)",
							textAlign: "center",
							marginTop: 8,
						}}>
						One-off payment · No subscription · Billed through{" "}
						{Platform.OS === "ios" ? "Apple" : "Google"} Play
					</Text>
				</View>
			)}
			{!isPro && (
				<TouchableOpacity
					onPress={onRestorePurchases}
					style={{ alignItems: "center", paddingVertical: 8, marginBottom: 6 }}>
					<Text
						style={{ fontSize: 13, color: C.primaryPurple, fontWeight: "700" }}>
						Restore previous purchase
					</Text>
				</TouchableOpacity>
			)}
			{isPro && (
				<Card
					style={{
						backgroundColor: C.bgGreen,
						borderColor: C.primaryGreenLight,
					}}>
					<View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
						<Icon name="unlock" size={22} color={C.primaryGreen} />
						<Text
							style={{
								fontWeight: "700",
								fontSize: 13,
								color: "#2e7d52",
								textTransform: "uppercase",
								letterSpacing: 0.5,
							}}>
							Pro — All recipes unlocked
						</Text>
					</View>
				</Card>
			)}
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}>
				{ageGroups.map((ag) => (
					<TouchableOpacity
						key={ag}
						onPress={() => setFilterAge(ag)}
						style={{
							backgroundColor: filterAge === ag ? C.primaryPurple : C.bgPurple,
							borderColor: filterAge === ag ? C.primaryPurple : C.border,
							borderWidth: 2,
							borderRadius: 999,
							paddingHorizontal: 14,
							paddingVertical: 6,
						}}>
						<Text
							style={{
								fontSize: 11,
								fontWeight: "700",
								color: filterAge === ag ? C.white : C.mutedText,
								textTransform: "uppercase",
							}}>
							{ag === "all" ? "All Ages" : ag}
						</Text>
					</TouchableOpacity>
				))}
			</ScrollView>
			<Text style={s.pageTitle}>
				{filterAge === "all" ? "All Recipes" : `Recipes for ${filterAge}`}
			</Text>
			{filtered.map((r) => {
				const effectiveLocked = r.locked && !isPro;
				const isOpen = expandedId === r.id && !effectiveLocked;
				return (
					<View
						key={r.id}
						style={[
							s.card,
							{
								padding: 0,
								overflow: "hidden",
								borderColor: isOpen ? C.primaryPurple : C.borderLight,
								opacity: effectiveLocked ? 0.75 : 1,
							},
						]}>
						<TouchableOpacity
							onPress={() => toggle(r.id, r.locked)}
							style={{
								flexDirection: "row",
								gap: 14,
								alignItems: "center",
								padding: 18,
							}}
							activeOpacity={effectiveLocked ? 1 : 0.8}>
							<View
								style={{
									backgroundColor: C.bgPurple,
									borderRadius: 12,
									padding: 12,
								}}>
								<Icon name="utensils" size={21} color={C.primaryPurple} />
							</View>
							<View style={{ flex: 1 }}>
								<View
									style={{
										flexDirection: "row",
										alignItems: "center",
										gap: 8,
										marginBottom: 6,
									}}>
									<Text
										style={{
											fontWeight: "700",
											fontSize: 13,
											color: C.primaryPinkDark,
											textTransform: "uppercase",
											letterSpacing: 0.5,
											flex: 1,
										}}>
										{r.title}
									</Text>
									{effectiveLocked && (
										<Icon name="lock" size={12} color={C.mutedText} />
									)}
									{!effectiveLocked && (
										<Icon
											name={isOpen ? "chevUp" : "chevDown"}
											size={15}
											color={C.mutedText}
										/>
									)}
								</View>
								<View
									style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
									<View style={s.tagPurple}>
										<Text style={s.tagPurpleText}>{r.category}</Text>
									</View>
									<View style={s.tagGreen}>
										<Text style={s.tagGreenText}>{r.ageGroup}</Text>
									</View>
									<View style={s.tagPurple}>
										<Text style={s.tagPurpleText}>{r.time}</Text>
									</View>
									{r.tags.map((t) => (
										<View key={t} style={s.tagWarning}>
											<Text style={s.tagWarningText}>{t}</Text>
										</View>
									))}
								</View>
							</View>
						</TouchableOpacity>
						{isOpen && (
							<View
								style={{
									borderTopWidth: 2,
									borderTopColor: C.borderLight,
									padding: 18,
								}}>
								{r.description ? (
									<Text
										style={{
											fontSize: 13,
											color: C.textCharcoal,
											marginBottom: 16,
											lineHeight: 20,
											fontStyle: "italic",
										}}>
										{r.description}
									</Text>
								) : null}
								<Text style={[s.sectionTitle, { marginBottom: 10 }]}>
									Ingredients
								</Text>
								{r.ingredients.map((ing, i) => (
									<View
										key={i}
										style={{
											flexDirection: "row",
											alignItems: "flex-start",
											gap: 10,
											backgroundColor: C.bgPurple,
											borderRadius: 10,
											borderWidth: 1.5,
											borderColor: C.borderLight,
											padding: 10,
											marginBottom: 6,
										}}>
										<View
											style={{
												width: 6,
												height: 6,
												borderRadius: 3,
												backgroundColor: C.primaryPurple,
												marginTop: 6,
												flexShrink: 0,
											}}
										/>
										<Text
											style={{
												fontSize: 13,
												color: C.textCharcoal,
												fontWeight: "600",
												flex: 1,
											}}>
											{ing}
										</Text>
									</View>
								))}
								<Text
									style={[s.sectionTitle, { marginTop: 14, marginBottom: 10 }]}>
									Method
								</Text>
								{r.steps.map((step, i) => (
									<View
										key={i}
										style={{
											flexDirection: "row",
											alignItems: "flex-start",
											gap: 12,
											backgroundColor: i % 2 === 0 ? C.white : C.bgPurple,
											borderRadius: 10,
											borderWidth: 1.5,
											borderColor: C.borderLight,
											padding: 10,
											marginBottom: 6,
										}}>
										<View
											style={{
												backgroundColor: C.primaryPurple,
												borderRadius: 11,
												width: 22,
												height: 22,
												alignItems: "center",
												justifyContent: "center",
												flexShrink: 0,
											}}>
											<Text
												style={{
													fontSize: 11,
													fontWeight: "700",
													color: C.white,
												}}>
												{i + 1}
											</Text>
										</View>
										<Text
											style={{
												fontSize: 13,
												color: C.textCharcoal,
												lineHeight: 20,
												flex: 1,
												paddingTop: 2,
											}}>
											{step}
										</Text>
									</View>
								))}
							</View>
						)}
						{effectiveLocked && (
							<View
								style={{
									borderTopWidth: 2,
									borderTopColor: C.borderLight,
									padding: 10,
									flexDirection: "row",
									alignItems: "center",
									gap: 8,
								}}>
								<Icon name="lock" size={13} color={C.mutedText} />
								<Text
									style={{
										fontSize: 11,
										fontWeight: "700",
										color: C.mutedText,
										textTransform: "uppercase",
									}}>
									Upgrade to Pro to view this recipe
								</Text>
							</View>
						)}
					</View>
				);
			})}
		</ScrollView>
	);
}

// ─── SETTINGS SCREEN ──────────────────────────────────────────────────────────
function SettingsScreen({
	user,
	isPro,
	onLogout,
	onDeleteAccount,
	onUpgradePro,
	onRestorePurchases,
}) {
	const [showChangePassword, setShowChangePassword] = useState(false);
	const [currentPw, setCurrentPw] = useState("");
	const [newPw, setNewPw] = useState("");
	const [confirmPw, setConfirmPw] = useState("");
	const [pwLoading, setPwLoading] = useState(false);
	const [upgradeLoading, setUpgradeLoading] = useState(false);

	const handleChangePassword = async () => {
		if (!currentPw || !newPw || !confirmPw) {
			Alert.alert("Missing Fields", "Please fill in all password fields.");
			return;
		}
		if (newPw !== confirmPw) {
			Alert.alert("Mismatch", "New passwords do not match.");
			return;
		}
		if (newPw.length < 6) {
			Alert.alert("Too Short", "Password must be at least 6 characters.");
			return;
		}
		setPwLoading(true);
		try {
			const credential = EmailAuthProvider.credential(user.email, currentPw);
			await reauthenticateWithCredential(auth.currentUser, credential);
			await updatePassword(auth.currentUser, newPw);
			Alert.alert("Success", "Password updated successfully.");
			setCurrentPw("");
			setNewPw("");
			setConfirmPw("");
			setShowChangePassword(false);
		} catch (e) {
			const msgs = {
				"auth/wrong-password": "Current password is incorrect.",
				"auth/too-many-requests": "Too many attempts. Please try again later.",
				"auth/invalid-credential": "Current password is incorrect.",
			};
			Alert.alert("Error", msgs[e.code] || e.message);
		}
		setPwLoading(false);
	};

	const SettingsRow = ({
		icon,
		label,
		sublabel,
		onPress,
		color,
		rightElement,
	}) => (
		<TouchableOpacity
			onPress={onPress}
			style={{
				flexDirection: "row",
				alignItems: "center",
				gap: 14,
				padding: 16,
				backgroundColor: C.white,
				borderRadius: 14,
				borderWidth: 2,
				borderColor: C.borderLight,
				marginBottom: 10,
			}}
			activeOpacity={0.8}>
			<View
				style={{
					width: 38,
					height: 38,
					borderRadius: 10,
					backgroundColor: C.bgPurple,
					alignItems: "center",
					justifyContent: "center",
				}}>
				<Icon name={icon} size={18} color={color || C.primaryPurple} />
			</View>
			<View style={{ flex: 1 }}>
				<Text
					style={{
						fontWeight: "700",
						fontSize: 14,
						color: color || C.textCharcoal,
					}}>
					{label}
				</Text>
				{sublabel && (
					<Text style={{ fontSize: 12, color: C.mutedText, marginTop: 2 }}>
						{sublabel}
					</Text>
				)}
			</View>
			{rightElement || <Icon name="chevRight" size={16} color={C.mutedText} />}
		</TouchableOpacity>
	);

	return (
		<ScrollView
			showsVerticalScrollIndicator={false}
			contentContainerStyle={{ gap: 6, paddingBottom: 30 }}>
			{/* Account info card */}
			<Card style={{ marginBottom: 10 }}>
				<View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
					<View
						style={{
							width: 48,
							height: 48,
							borderRadius: 24,
							backgroundColor: C.primaryPurple,
							alignItems: "center",
							justifyContent: "center",
						}}>
						<Icon name="user" size={22} color={C.white} />
					</View>
					<View style={{ flex: 1 }}>
						<Text
							style={{
								fontWeight: "700",
								fontSize: 15,
								color: C.primaryPinkDark,
							}}>
							{user.email}
						</Text>
						<View
							style={{
								flexDirection: "row",
								alignItems: "center",
								gap: 6,
								marginTop: 4,
							}}>
							{isPro ? (
								<View
									style={{
										backgroundColor: C.bgGreen,
										borderColor: C.primaryGreenLight,
										borderWidth: 1.5,
										borderRadius: 999,
										paddingHorizontal: 10,
										paddingVertical: 2,
									}}>
									<Text
										style={{
											fontSize: 11,
											fontWeight: "700",
											color: C.primaryGreen,
										}}>
										PRO ACCOUNT
									</Text>
								</View>
							) : (
								<View
									style={{
										backgroundColor: C.bgPurple,
										borderColor: C.border,
										borderWidth: 1.5,
										borderRadius: 999,
										paddingHorizontal: 10,
										paddingVertical: 2,
									}}>
									<Text
										style={{
											fontSize: 11,
											fontWeight: "700",
											color: C.mutedText,
										}}>
										FREE ACCOUNT
									</Text>
								</View>
							)}
						</View>
					</View>
				</View>
			</Card>

			{/* ── Upgrade to Pro card — only shown on free accounts ── */}
			{!isPro && (
				<View
					style={{
						backgroundColor: "#2d1f5e",
						borderRadius: 16,
						padding: 20,
						marginBottom: 10,
						overflow: "hidden",
					}}>
					{/* Background decoration */}
					<View
						style={{
							position: "absolute",
							top: -20,
							right: -20,
							width: 120,
							height: 120,
							borderRadius: 60,
							backgroundColor: "rgba(155,127,232,0.2)",
						}}
					/>
					<View
						style={{
							position: "absolute",
							bottom: -30,
							left: -10,
							width: 80,
							height: 80,
							borderRadius: 40,
							backgroundColor: "rgba(155,127,232,0.15)",
						}}
					/>

					{/* Crown + Pro badge */}
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: 10,
							marginBottom: 12,
						}}>
						<View
							style={{
								backgroundColor: C.warningStroke,
								borderRadius: 10,
								width: 36,
								height: 36,
								alignItems: "center",
								justifyContent: "center",
							}}>
							<Icon name="crown" size={18} color={C.white} />
						</View>
						<Text
							style={{
								fontWeight: "700",
								fontSize: 18,
								color: C.white,
								letterSpacing: 0.5,
							}}>
							Munch Sprouts Pro
						</Text>
					</View>

					{/* Price */}
					<View
						style={{
							flexDirection: "row",
							alignItems: "baseline",
							gap: 4,
							marginBottom: 12,
						}}>
						<Text style={{ fontSize: 32, fontWeight: "700", color: C.white }}>
							£4.99
						</Text>
						<Text style={{ fontSize: 14, color: "rgba(255,255,255,0.7)" }}>
							one-off
						</Text>
					</View>

					{/* Features list */}
					{[
						"Access to all BLW recipes",
						"Recipes for every age group (6m+, 7m+, 9m+, 12m+)",
						"Nutritionist-approved meal ideas",
						"New recipes added regularly",
						"More premium features coming soon",
					].map((feature, i) => (
						<View
							key={i}
							style={{
								flexDirection: "row",
								alignItems: "center",
								gap: 8,
								marginBottom: 6,
							}}>
							<View
								style={{
									width: 18,
									height: 18,
									borderRadius: 9,
									backgroundColor: C.primaryGreen,
									alignItems: "center",
									justifyContent: "center",
									flexShrink: 0,
								}}>
								<Icon name="check" size={11} color={C.white} />
							</View>
							<Text
								style={{
									fontSize: 13,
									color: "rgba(255,255,255,0.9)",
									flex: 1,
								}}>
								{feature}
							</Text>
						</View>
					))}

					{/* Purchase button */}
					<TouchableOpacity
						onPress={() => {
							setUpgradeLoading(true);
							onUpgradePro().finally(() => setUpgradeLoading(false));
						}}
						disabled={upgradeLoading}
						style={{
							backgroundColor: C.warningStroke,
							borderRadius: 12,
							paddingVertical: 14,
							alignItems: "center",
							justifyContent: "center",
							marginTop: 16,
							flexDirection: "row",
							gap: 8,
							opacity: upgradeLoading ? 0.7 : 1,
						}}
						activeOpacity={0.85}>
						{upgradeLoading ? (
							<ActivityIndicator color={C.white} />
						) : (
							<>
								<Icon name="crown" size={16} color={C.white} />
								<Text
									style={{
										color: C.white,
										fontWeight: "700",
										fontSize: 15,
										letterSpacing: 0.5,
									}}>
									Upgrade for £4.99
								</Text>
							</>
						)}
					</TouchableOpacity>

					<Text
						style={{
							fontSize: 11,
							color: "rgba(255,255,255,0.5)",
							textAlign: "center",
							marginTop: 8,
						}}>
						One-off payment · No subscription · Billed through{" "}
						{Platform.OS === "ios" ? "Apple" : "Google"} Play
					</Text>
				</View>
			)}

			<Text
				style={[
					s.smallLabel,
					{ paddingLeft: 4, marginBottom: 4, marginTop: 4 },
				]}>
				Account
			</Text>
			<SettingsRow
				icon="key"
				label="Change Password"
				sublabel="Update your account password"
				onPress={() => setShowChangePassword(true)}
			/>
			<SettingsRow
				icon="logout"
				label="Sign Out"
				sublabel="Sign out of your account"
				color="#c0392b"
				onPress={onLogout}
				rightElement={<View />}
			/>

			{/* Delete Account */}
			<View
				style={{
					marginTop: 16,
					borderTopWidth: 2,
					borderTopColor: C.borderLight,
					paddingTop: 16,
				}}>
				<Text style={[s.smallLabel, { paddingLeft: 4, marginBottom: 8 }]}>
					Danger Zone
				</Text>
				<SettingsRow
					icon="trash"
					label="Delete Account"
					sublabel="Permanently delete your account and all data"
					color="#c0392b"
					onPress={() => {
						Alert.alert(
							"Delete Account",
							"This will permanently delete your account, all children, and all food log data. This cannot be undone.\n\nAre you absolutely sure?",
							[
								{ text: "Cancel", style: "cancel" },
								{
									text: "Yes, Delete Everything",
									style: "destructive",
									onPress: () => {
										Alert.alert(
											"Final Confirmation",
											"Last chance — this is permanent and cannot be reversed.",
											[
												{ text: "Cancel", style: "cancel" },
												{
													text: "Delete My Account",
													style: "destructive",
													onPress: onDeleteAccount,
												},
											],
										);
									},
								},
							],
						);
					}}
					rightElement={<View />}
				/>
			</View>

			{/* Change Password Modal */}
			<Modal
				visible={showChangePassword}
				transparent
				animationType="slide"
				onRequestClose={() => setShowChangePassword(false)}>
				<KeyboardAvoidingView
					behavior={Platform.OS === "ios" ? "padding" : "height"}
					style={s.modalOverlay}>
					<View style={s.modalSheet}>
						<View
							style={{
								flexDirection: "row",
								justifyContent: "space-between",
								alignItems: "center",
								marginBottom: 20,
							}}>
							<Text style={s.modalTitle}>Change Password</Text>
							<TouchableOpacity
								onPress={() => setShowChangePassword(false)}
								style={{
									backgroundColor: C.bgPurple,
									borderRadius: 8,
									padding: 6,
								}}>
								<Icon name="close" size={15} color={C.mutedText} />
							</TouchableOpacity>
						</View>
						<View style={{ gap: 14 }}>
							<View>
								<Text style={s.label}>Current Password</Text>
								<TextInput
									value={currentPw}
									onChangeText={setCurrentPw}
									placeholder="Enter current password"
									secureTextEntry
									style={[s.input, { backgroundColor: C.white }]}
									placeholderTextColor={C.mutedText}
									autoComplete="off"
								/>
							</View>
							<View>
								<Text style={s.label}>New Password</Text>
								<TextInput
									value={newPw}
									onChangeText={setNewPw}
									placeholder="At least 6 characters"
									secureTextEntry
									style={[s.input, { backgroundColor: C.white }]}
									placeholderTextColor={C.mutedText}
									autoComplete="off"
								/>
							</View>
							<View>
								<Text style={s.label}>Confirm New Password</Text>
								<TextInput
									value={confirmPw}
									onChangeText={setConfirmPw}
									placeholder="Repeat new password"
									secureTextEntry
									style={[s.input, { backgroundColor: C.white }]}
									placeholderTextColor={C.mutedText}
									autoComplete="off"
								/>
							</View>
							<TouchableOpacity
								onPress={handleChangePassword}
								disabled={pwLoading}
								style={[s.btnPrimary, pwLoading && { opacity: 0.6 }]}
								activeOpacity={0.8}>
								{pwLoading ? (
									<ActivityIndicator color={C.white} />
								) : (
									<Text style={s.btnPrimaryText}>Update Password</Text>
								)}
							</TouchableOpacity>
						</View>
					</View>
				</KeyboardAvoidingView>
			</Modal>
		</ScrollView>
	);
}

// ─── EDIT MODAL ───────────────────────────────────────────────────────────────
function EditModal({ visible, entry, onSubmit, onClose }) {
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
					<View
						style={{
							flexDirection: "row",
							justifyContent: "space-between",
							alignItems: "center",
							marginBottom: 20,
						}}>
						<Text style={s.modalTitle}>Edit Entry</Text>
						<TouchableOpacity
							onPress={onClose}
							style={{
								backgroundColor: C.bgPurple,
								borderRadius: 8,
								padding: 6,
							}}>
							<Icon name="close" size={15} color={C.mutedText} />
						</TouchableOpacity>
					</View>
					<ScrollView>
						{entry && (
							<FoodForm
								initial={entry}
								onSubmit={onSubmit}
								buttonLabel="Update Entry"
							/>
						)}
					</ScrollView>
				</View>
			</KeyboardAvoidingView>
		</Modal>
	);
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
function MainApp({ user, isPro }) {
	const [page, setPage] = useState("dashboard");
	const [foodLog, setFoodLog] = useState([]);
	const [children, setChildren] = useState([]);
	const [activeChildId, setActiveChildId] = useState(null);
	const [dataLoaded, setDataLoaded] = useState(false);
	const [editEntry, setEditEntry] = useState(null);
	const [toasts, setToasts] = useState([]);
	const insets = useSafeAreaInsets();

	useEffect(() => {
		if (!user) return;
		Promise.all([fetchFoodLog(user.uid), fetchChildren(user.uid)])
			.then(([log, kids]) => {
				setFoodLog(log);
				setChildren(kids);
				if (kids.length > 0) setActiveChildId(kids[0].id);
				setDataLoaded(true);
			})
			.catch((err) => {
				console.error("Error loading data:", err);
				setDataLoaded(true);
			});
	}, [user]);

	useEffect(() => {
		if (!user) return;
		const apiKey =
			Platform.OS === "ios"
				? "appl_your_ios_key_here"
				: "goog_your_android_key_here";

		Purchases.configure({ apiKey, appUserID: user.uid });
	}, [user]);

	const activeChild =
		children.find((c) => c.id === activeChildId) || children[0] || null;
	const childLog = activeChild
		? foodLog.filter((f) => f.childId === activeChild.id)
		: foodLog;

	const toast = (msg, type = "success") => {
		const id = Date.now();
		setToasts((p) => [...p, { id, msg, type }]);
		setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3000);
	};

	const addFood = async (form, err) => {
		if (!form) {
			Alert.alert("Missing Info", err || "Please fill in required fields.");
			return;
		}
		console.log(
			"activeChild at time of logging:",
			activeChild?.id,
			typeof activeChild?.id,
		);
		const existing = childLog.filter(
			(f) => normalize(f.name) === normalize(form.name),
		);
		const entry = {
			childId: activeChild?.id || null,
			attemptNum: existing.length + 1,
			...form,
		};
		console.log(
			"entry.childId being saved:",
			entry.childId,
			typeof entry.childId,
		);
		try {
			const newId = await addFoodEntry(user.uid, entry);
			setFoodLog((p) => [...p, { id: newId, ...entry }]);
			toast(
				existing.length === 0
					? `Added "${form.name}"`
					: `"${form.name}" attempt #${existing.length + 1}`,
			);
			setPage("log");
		} catch (e) {
			Alert.alert("Error", "Could not save entry. Check your connection.");
		}
	};

	const editFood = async (updated, err) => {
		if (!updated) {
			Alert.alert("Missing Info", err || "Please fill required fields.");
			return;
		}
		try {
			await updateFoodEntry(updated.id, updated);
			setFoodLog((p) =>
				p.map((f) => (f.id === updated.id ? { ...f, ...updated } : f)),
			);
			setEditEntry(null);
			toast("Entry updated");
		} catch (e) {
			Alert.alert("Error", "Could not update entry.");
		}
	};

	const deleteFood = async (id) => {
		try {
			await deleteFoodEntry(id);
			setFoodLog((p) => p.filter((f) => f.id !== id));
			toast("Entry deleted");
		} catch (e) {
			Alert.alert("Error", "Could not delete entry.");
		}
	};

	const toggleFav = async (id) => {
		const entry = foodLog.find((f) => f.id === id);
		if (!entry) return;
		const newVal = !entry.favourite;
		try {
			await updateFoodEntry(id, { favourite: newVal });
			setFoodLog((p) =>
				p.map((f) => (f.id === id ? { ...f, favourite: newVal } : f)),
			);
		} catch (e) {}
	};

	const addChild = async (child) => {
		try {
			const newId = await fbAddChild(user.uid, child);
			const newChild = { id: newId, ...child };
			setChildren((p) => [...p, newChild]);
			if (!activeChildId) setActiveChildId(newId);
			toast(`${child.name} added`);
		} catch (e) {
			Alert.alert("Error", "Could not add child.");
		}
	};

	const editChild = async (updated) => {
		try {
			await fbUpdateChild(updated.id, updated);
			setChildren((p) => p.map((c) => (c.id === updated.id ? updated : c)));
			toast("Updated");
		} catch (e) {
			Alert.alert("Error", "Could not update child.");
		}
	};

	const deleteChild = async (id) => {
		try {
			await fbDeleteChild(id, user.uid);
			// Only runs if delete succeeded
			setChildren((p) => p.filter((c) => c.id !== id));
			setFoodLog((p) => p.filter((f) => f.childId !== id));
			if (activeChildId === id) {
				const remaining = children.filter((c) => c.id !== id);
				setActiveChildId(remaining.length > 0 ? remaining[0].id : null);
			}
			toast("Child removed");
		} catch (e) {
			console.warn("deleteChild error:", e.message);
			// Still update local state since child was deleted from Firestore
			setChildren((p) => p.filter((c) => c.id !== id));
			setFoodLog((p) => p.filter((f) => f.childId !== id));
			if (activeChildId === id) {
				const remaining = children.filter((c) => c.id !== id);
				setActiveChildId(remaining.length > 0 ? remaining[0].id : null);
			}
			toast("Child removed");
		}
	};

	const handleLogout = () =>
		Alert.alert("Sign Out", "Are you sure you want to sign out?", [
			{ text: "Cancel" },
			{ text: "Sign Out", style: "destructive", onPress: () => logOut() },
		]);

	const importDataFromJson = async () => {
		try {
			const result = await DocumentPicker.getDocumentAsync({
				type: "application/json",
				copyToCacheDirectory: true,
				multiple: false,
			});

			if (result.canceled) return;

			const file = result.assets?.[0];

			if (!file?.uri) {
				Alert.alert("Import failed", "Could not read the selected file.");
				return;
			}

			let content = "";
			try {
				content = await FileSystem.readAsStringAsync(file.uri);
			} catch (readError) {
				Alert.alert(
					"Import failed",
					"The file was selected, but could not be read from storage.",
				);
				return;
			}

			let parsed;
			try {
				parsed = JSON.parse(content);
			} catch {
				Alert.alert("Import failed", "The selected file is not valid JSON.");
				return;
			}

			const importedChild = parsed?.child ?? null;
			const importedFoodLog = Array.isArray(parsed?.log) ? parsed.log : [];

			if (!importedChild || !Array.isArray(importedFoodLog)) {
				Alert.alert(
					"Import failed",
					"The file is valid JSON, but it is not a valid Munch Sprouts backup.",
				);
				return;
			}

			if (!importedChild.name || !importedChild.dob) {
				Alert.alert(
					"Import failed",
					"The backup file is missing required child details.",
				);
				return;
			}

			const validEntries = importedFoodLog.filter(
				(entry) => entry?.date && entry?.name && entry?.category,
			);

			if (!validEntries.length) {
				Alert.alert(
					"Import failed",
					"This backup does not contain any valid food log entries.",
				);
				return;
			}

			Alert.alert(
				"Import backup",
				`Import ${validEntries.length} food log entr${validEntries.length === 1 ? "y" : "ies"} for ${importedChild.name}?`,
				[
					{ text: "Cancel", style: "cancel" },
					{
						text: "Import",
						onPress: async () => {
							try {
								const newChildId = await fbAddChild(user.uid, {
									name: importedChild.name,
									dob: importedChild.dob,
									weaningStart: importedChild.weaningStart || "",
								});

								for (const entry of validEntries) {
									await addFoodEntry(user.uid, {
										childId: newChildId,
										date: entry.date,
										name: entry.name,
										category: entry.category,
										form: entry.form || "",
										reaction: entry.reaction || "",
										notes: entry.notes || "",
										favourite: !!entry.favourite,
									});
								}

								const [updatedLog, updatedChildren] = await Promise.all([
									fetchFoodLog(user.uid),
									fetchChildren(user.uid),
								]);

								setFoodLog(updatedLog);
								setChildren(updatedChildren);
								setActiveChildId(newChildId);

								Alert.alert(
									"Import complete",
									`${importedChild.name} and ${validEntries.length} food log entr${validEntries.length === 1 ? "y has" : "ies have"} been imported.`,
								);
							} catch (e) {
								Alert.alert(
									"Import failed",
									"Could not import this backup. Please try again.",
								);
							}
						},
					},
				],
			);
		} catch (e) {
			Alert.alert(
				"Import failed",
				"Something went wrong while selecting the file.",
			);
		}
	};

	// ── Delete account ──
	const handleDeleteAccount = async () => {
		try {
			await deleteAccount(user.uid);
			// logOut happens automatically as Firebase auth state changes
		} catch (e) {
			// If it requires recent login (Firebase security requirement)
			if (e.code === "auth/requires-recent-login") {
				Alert.alert(
					"Please sign in again",
					"For security, please sign out and sign back in before deleting your account.",
				);
			} else {
				Alert.alert("Error", e.message || "Could not delete account.");
			}
		}
	};

	// ── In-app purchase — upgrade to Pro ──
	const handleUpgradePro = async () => {
		try {
			// Configure RevenueCat with your API keys
			const apiKey =
				Platform.OS === "ios"
					? "" // paste your RevenueCat iOS key
					: ""; // paste your RevenueCat Android key

			Purchases.setLogLevel(LOG_LEVEL.DEBUG);
			await Purchases.configure({ apiKey, appUserID: user.uid });

			// Fetch available offerings
			const offerings = await Purchases.getOfferings();

			if (
				!offerings.current ||
				offerings.current.availablePackages.length === 0
			) {
				Alert.alert(
					"Not available",
					"Purchase not available right now. Please try again later.",
				);
				return;
			}

			// Get the pro package
			const proPackage = offerings.current.availablePackages[0];

			// Trigger the purchase
			const { customerInfo } = await Purchases.purchasePackage(proPackage);

			// Check if pro entitlement is now active
			if (customerInfo.entitlements.active["pro"]) {
				// Update Firestore to mark user as pro
				const { doc, updateDoc } = await import("firebase/firestore");
				const { db } = await import("./firebase");
				await updateDoc(doc(db, "users", user.uid), { plan: "pro" });

				Alert.alert(
					"Welcome to Pro! 🎉",
					"You now have access to all recipes and premium features. Thank you for your support!",
				);
			}
		} catch (e) {
			if (e.userCancelled) {
				// User cancelled the purchase sheet — no action needed
				return;
			}
			Alert.alert(
				"Purchase failed",
				e.message || "Something went wrong. Please try again.",
			);
		}
	};

	const handleRestorePurchases = async () => {
		try {
			const customerInfo = await Purchases.restorePurchases();
			if (customerInfo.entitlements.active["pro"]) {
				const { doc, updateDoc } = await import("firebase/firestore");
				const { db } = await import("./firebase");
				await updateDoc(doc(db, "users", user.uid), { plan: "pro" });
				Alert.alert("Restored", "Your Pro purchase has been restored.");
			} else {
				Alert.alert(
					"Nothing to restore",
					"No previous Pro purchase found on this account.",
				);
			}
		} catch (e) {
			Alert.alert("Error", e.message || "Could not restore purchases.");
		}
	};

	const migrateChildIds = async () => {
		if (!activeChild) {
			Alert.alert("No child selected", "Select an active child first.");
			return;
		}
		Alert.alert(
			"Fix Food Log",
			`This reassigns food log entries with old numeric IDs to ${activeChild.name}. Run once only.`,
			[
				{ text: "Cancel" },
				{
					text: "Fix Now",
					onPress: async () => {
						try {
							// Fetch ALL food log entries for this user
							const q = query(
								collection(db, "foodLog"),
								where("userId", "==", user.uid),
							);
							const snap = await getDocs(q);
							let fixed = 0;
							await Promise.all(
								snap.docs.map(async (d) => {
									const data = d.data();
									// If childId is a number it's the old broken format
									if (typeof data.childId === "number") {
										await updateFoodEntry(d.id, { childId: activeChild.id });
										fixed++;
									}
								}),
							);
							// Refresh local food log from Firestore
							const updatedLog = await fetchFoodLog(user.uid);
							setFoodLog(updatedLog);
							Alert.alert(
								"Done",
								fixed > 0
									? `Fixed ${fixed} entries — now assigned to ${activeChild.name}.`
									: "No entries needed fixing.",
							);
						} catch (e) {
							Alert.alert("Migration failed", e.message || String(e));
						}
					},
				},
			],
		);
	};

	if (!dataLoaded) return <LoadingScreen />;

	// Settings added as 6th tab
	const nav = [
		{ id: "dashboard", icon: "home", label: "Home" },
		{ id: "log", icon: "list", label: "Log" },
		{ id: "add", icon: "plus", label: "Add" },
		{ id: "children", icon: "users", label: "Children" },
		{ id: "recipes", icon: "chef", label: "Recipes" },
	];
	const titles = {
		dashboard: "Dashboard",
		log: "Food Log",
		add: "Log Food",
		children: "Children",
		recipes: "Recipes",
		settings: "Settings",
	};

	return (
		<SafeAreaView
			style={{ flex: 1, backgroundColor: C.bgMain }}
			edges={["top"]}>
			<StatusBar barStyle="dark-content" backgroundColor={C.white} />
			{/* Header */}
			<View style={s.header}>
				<View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
					<Image
						source={require("./assets/logo.png")}
						style={{ width: 40, height: 40 }}
						resizeMode="contain"
					/>
					<View>
						<Text style={s.appName}>Munch Sprouts</Text>
						<Text style={s.pageSubtitle}>{titles[page]}</Text>
					</View>
				</View>
				<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
					{activeChild && (
						<TouchableOpacity
							onPress={() => setPage("children")}
							style={{
								backgroundColor: C.bgPurple,
								borderColor: C.border,
								borderWidth: 2,
								borderRadius: 999,
								paddingHorizontal: 12,
								paddingVertical: 5,
								flexDirection: "row",
								alignItems: "center",
								gap: 6,
							}}>
							<Icon name="baby" size={13} color={C.primaryPurple} />
							<Text
								style={{
									fontSize: 12,
									fontWeight: "700",
									color: C.primaryPurple,
									textTransform: "uppercase",
								}}>
								{activeChild.name}
							</Text>
						</TouchableOpacity>
					)}

					{/* Settings button */}
					<TouchableOpacity
						onPress={() => setPage("settings")}
						style={{
							backgroundColor:
								page === "settings" ? C.primaryPurple : C.bgPurple,
							borderColor: page === "settings" ? C.primaryPurple : C.border,
							borderWidth: 2,
							borderRadius: 10,
							padding: 7,
							alignItems: "center",
							justifyContent: "center",
						}}>
						<Icon
							name="settings"
							size={16}
							color={page === "settings" ? C.white : C.primaryPurple}
						/>
					</TouchableOpacity>
				</View>
			</View>

			{/* Page Content */}
			<View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}>
				{page === "dashboard" && (
					<DashboardScreen
						child={activeChild}
						foodLog={childLog}
						onNavigate={setPage}
					/>
				)}
				{page === "log" && (
					<LogScreen
						foodLog={childLog}
						childName={activeChild?.name || null}
						onEdit={setEditEntry}
						onDelete={deleteFood}
						onToggleFavourite={toggleFav}
					/>
				)}
				{page === "add" && (
					<KeyboardAvoidingView
						behavior={Platform.OS === "ios" ? "padding" : "height"}
						style={{ flex: 1 }}>
						<ScrollView
							showsVerticalScrollIndicator={false}
							contentContainerStyle={{ paddingBottom: 40 }}>
							<Card>
								<SectionTitle icon="plus">Log Food or Drink</SectionTitle>
								<FoodForm onSubmit={addFood} />
							</Card>
						</ScrollView>
					</KeyboardAvoidingView>
				)}
				{page === "children" && (
					<ChildrenScreen
						children={children}
						activeChildId={activeChild?.id}
						onSetActive={setActiveChildId}
						onAdd={addChild}
						onEdit={editChild}
						onDelete={deleteChild}
					/>
				)}
				{page === "recipes" && (
					<RecipesScreen isPro={isPro} onUpgradePro={handleUpgradePro} />
				)}
				{page === "settings" && (
					<SettingsScreen
						user={user}
						isPro={isPro}
						onLogout={handleLogout}
						onDeleteAccount={handleDeleteAccount}
						onUpgradePro={handleUpgradePro}
						onRestorePurchases={handleRestorePurchases}
						onImportJson={importDataFromJson}
					/>
				)}
			</View>

			{/* Bottom Nav */}
			<View
				style={[
					s.bottomNav,
					{ paddingBottom: insets.bottom > 0 ? insets.bottom : 8 },
				]}>
				{nav.map((n) => {
					const active = page === n.id,
						isAdd = n.id === "add";
					return (
						<TouchableOpacity
							key={n.id}
							onPress={() => setPage(n.id)}
							style={s.navItem}
							activeOpacity={0.8}>
							{isAdd ? (
								<View style={s.navAddBtn}>
									<Icon name="plus" size={22} color={C.white} />
								</View>
							) : (
								<Icon
									name={n.icon}
									size={isAdd ? 22 : 19}
									color={active ? C.primaryPurple : C.mutedText}
								/>
							)}
							<Text style={[s.navLabel, active && { color: C.primaryPurple }]}>
								{n.label}
							</Text>
							{active && !isAdd && <View style={s.navDot} />}
						</TouchableOpacity>
					);
				})}
			</View>

			<EditModal
				visible={!!editEntry}
				entry={editEntry}
				onSubmit={editFood}
				onClose={() => setEditEntry(null)}
			/>

			{/* Toasts */}
			<View style={s.toastContainer} pointerEvents="none">
				{toasts.map((t) => (
					<View
						key={t.id}
						style={[
							s.toast,
							{
								backgroundColor: t.type === "warning" ? C.bgWarning : C.bgGreen,
								borderColor:
									t.type === "warning" ? C.warningStroke : C.primaryGreenLight,
							},
						]}>
						<Text
							style={{
								color: t.type === "warning" ? C.warningStroke : "#2e7d52",
								fontWeight: "700",
								fontSize: 13,
							}}>
							{t.msg}
						</Text>
					</View>
				))}
			</View>
		</SafeAreaView>
	);
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
function Root() {
	const { user, loading, isPro } = useAuth();
	if (loading) return <LoadingScreen />;
	if (!user) return <AuthScreen />;
	return <MainApp user={user} isPro={isPro} />;
}

export default function App() {
	return (
		<SafeAreaProvider>
			<Root />
		</SafeAreaProvider>
	);
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
	card: {
		backgroundColor: C.bgPurple,
		borderColor: C.borderLight,
		borderWidth: 2,
		borderRadius: 16,
		padding: 18,
		shadowColor: "#9b7fe8",
		shadowOpacity: 0.08,
		shadowRadius: 10,
		shadowOffset: { width: 0, height: 2 },
		elevation: 2,
	},
	header: {
		backgroundColor: C.white,
		paddingHorizontal: 18,
		paddingVertical: 13,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		borderBottomWidth: 2,
		borderBottomColor: C.borderLight,
		shadowColor: "#9b7fe8",
		shadowOpacity: 0.1,
		shadowRadius: 10,
		elevation: 3,
	},
	appName: {
		fontWeight: "700",
		fontSize: 16,
		color: C.primaryPinkDark,
		textTransform: "uppercase",
		letterSpacing: 0.8,
		lineHeight: 18,
	},
	pageSubtitle: { fontSize: 14, color: C.mutedText, lineHeight: 18 },
	pageTitle: {
		fontWeight: "700",
		fontSize: 18,
		color: C.primaryPinkDark,
		textTransform: "uppercase",
		letterSpacing: 0.5,
	},
	sectionTitle: {
		fontWeight: "700",
		fontSize: 13,
		color: C.primaryPinkDark,
		textTransform: "uppercase",
		letterSpacing: 0.8,
	},
	smallLabel: {
		fontSize: 11,
		fontWeight: "700",
		color: C.mutedText,
		textTransform: "uppercase",
		letterSpacing: 0.6,
	},
	label: {
		fontSize: 11,
		fontWeight: "700",
		color: C.mutedText,
		textTransform: "uppercase",
		letterSpacing: 0.7,
		marginBottom: 5,
	},
	// KEY FIX: backgroundColor explicitly white on all inputs to prevent yellow autofill bg
	input: {
		borderWidth: 2,
		borderColor: C.border,
		borderRadius: 12,
		paddingHorizontal: 14,
		paddingVertical: 10,
		backgroundColor: C.white,
		color: C.textCharcoal,
		fontWeight: "600",
		fontSize: 14,
	},
	btnPrimary: {
		backgroundColor: C.primaryPurple,
		borderRadius: 12,
		paddingVertical: 14,
		paddingHorizontal: 20,
		alignItems: "center",
		justifyContent: "center",
		width: "100%",
	},
	btnPrimaryText: {
		color: C.white,
		fontWeight: "700",
		fontSize: 13,
		textTransform: "uppercase",
		letterSpacing: 0.5,
	},
	btnOutline: {
		backgroundColor: "transparent",
		borderWidth: 2,
		borderColor: C.primaryPurple,
		borderRadius: 12,
		paddingVertical: 10,
		paddingHorizontal: 16,
		alignItems: "center",
		justifyContent: "center",
	},
	btnOutlineText: {
		color: C.primaryPurple,
		fontWeight: "700",
		fontSize: 12,
		textTransform: "uppercase",
		letterSpacing: 0.5,
	},
	btnSecondary: {
		backgroundColor: C.bgPurple,
		borderColor: C.border,
		borderWidth: 2,
		borderRadius: 10,
		padding: 8,
	},
	btnDanger: {
		backgroundColor: C.bgWarning,
		borderColor: C.warningStroke,
		borderWidth: 2,
		borderRadius: 10,
		padding: 8,
	},
	statCard: {
		borderColor: C.borderLight,
		borderWidth: 2,
		borderRadius: 14,
		padding: 14,
		gap: 6,
		flex: 1,
		minWidth: 85,
		maxWidth: "48%",
	},
	statValue: { fontSize: 24, fontWeight: "700", lineHeight: 26 },
	statLabel: {
		fontSize: 10,
		color: C.mutedText,
		fontWeight: "700",
		textTransform: "uppercase",
		letterSpacing: 0.5,
		lineHeight: 13,
	},
	bottomNav: {
		backgroundColor: C.white,
		borderTopWidth: 2,
		borderTopColor: C.borderLight,
		flexDirection: "row",
		paddingTop: 6,
		shadowColor: "#9b7fe8",
		shadowOpacity: 0.1,
		shadowRadius: 10,
		elevation: 8,
	},
	navItem: { flex: 1, alignItems: "center", gap: 3, paddingBottom: 4 },
	navLabel: {
		fontSize: 8,
		fontWeight: "700",
		color: C.mutedText,
		textTransform: "uppercase",
		letterSpacing: 0.5,
	},
	navDot: {
		width: 16,
		height: 3,
		backgroundColor: C.primaryPurple,
		borderRadius: 999,
		marginTop: 1,
	},
	navAddBtn: {
		backgroundColor: C.primaryPurple,
		borderRadius: 14,
		width: 46,
		height: 46,
		alignItems: "center",
		justifyContent: "center",
		marginTop: -14,
		shadowColor: C.primaryPurple,
		shadowOpacity: 0.45,
		shadowRadius: 8,
		elevation: 6,
	},
	modalOverlay: {
		flex: 1,
		backgroundColor: "rgba(90,45,122,0.35)",
		justifyContent: "flex-end",
	},
	modalSheet: {
		backgroundColor: C.white,
		borderTopLeftRadius: 24,
		borderTopRightRadius: 24,
		padding: 28,
		maxHeight: "90%",
		borderTopWidth: 2,
		borderColor: C.border,
	},
	modalTitle: {
		fontWeight: "700",
		fontSize: 17,
		color: C.primaryPinkDark,
		textTransform: "uppercase",
		letterSpacing: 0.6,
	},
	pickerOverlay: {
		flex: 1,
		backgroundColor: "rgba(0,0,0,0.35)",
		justifyContent: "flex-end",
	},
	pickerSheet: {
		backgroundColor: C.white,
		borderTopLeftRadius: 24,
		borderTopRightRadius: 24,
		padding: 24,
		maxHeight: "60%",
	},
	pickerTitle: {
		fontWeight: "700",
		fontSize: 15,
		color: C.primaryPinkDark,
		textTransform: "uppercase",
		letterSpacing: 0.6,
		marginBottom: 14,
	},
	pickerItem: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingVertical: 14,
		paddingHorizontal: 12,
		borderRadius: 10,
		marginBottom: 4,
	},
	pickerItemText: { fontSize: 14, color: C.textCharcoal, fontWeight: "600" },
	tagPurple: {
		backgroundColor: C.bgPurple,
		borderColor: C.border,
		borderWidth: 1.5,
		borderRadius: 999,
		paddingHorizontal: 9,
		paddingVertical: 2,
	},
	tagPurpleText: {
		fontSize: 10,
		fontWeight: "700",
		color: C.primaryPurple,
		textTransform: "uppercase",
	},
	tagGreen: {
		backgroundColor: C.bgGreen,
		borderColor: C.primaryGreenLight,
		borderWidth: 1.5,
		borderRadius: 999,
		paddingHorizontal: 9,
		paddingVertical: 2,
	},
	tagGreenText: { fontSize: 10, fontWeight: "700", color: C.primaryGreen },
	tagWarning: {
		backgroundColor: C.bgWarning,
		borderColor: C.warningStroke,
		borderWidth: 1.5,
		borderRadius: 999,
		paddingHorizontal: 9,
		paddingVertical: 2,
	},
	tagWarningText: { fontSize: 10, fontWeight: "700", color: C.warningStroke },
	toastContainer: {
		position: "absolute",
		bottom: 90,
		right: 16,
		gap: 8,
		zIndex: 9999,
	},
	toast: {
		borderWidth: 1.5,
		borderRadius: 12,
		paddingHorizontal: 16,
		paddingVertical: 10,
		maxWidth: 280,
		shadowColor: "#000",
		shadowOpacity: 0.1,
		shadowRadius: 8,
	},
});
