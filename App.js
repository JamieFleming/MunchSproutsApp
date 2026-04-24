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
	Ellipse,
	G,
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
	fetchRecipes,
	fetchFavouriteRecipes,
	toggleRecipeFavourite,
	addFoodEntry,
	updateFoodEntry,
	deleteFoodEntry,
	addChild as fbAddChild,
	updateChild as fbUpdateChild,
	deleteChild as fbDeleteChild,
	deleteAccount,
	sendPasswordReset,
} from "./firebaseHooks";
import AuthScreen from "./AuthScreen";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import Purchases, { LOG_LEVEL } from "react-native-purchases";

// ─── COLOURS ──────────────────────────────────────────────────────────────────
const C = {
	bgMain: "#ffffff", // white base throughout
	bgPurple: "#f0ecfc", // lighter purple tint for cards/chips
	bgGreen: "#eaf7f0",
	bgWarning: "#fff5eb",
	primaryPurple: "#9b7fe8",
	secondaryPurple: "#c4b0f0",
	primaryPurpleDark: "#7a5fcb",
	primaryGreen: "#3db87a",
	primaryGreenLight: "#5dd39e",
	primaryPinkDark: "#5a2d7a",
	textCharcoal: "#2d2d2d",
	warningStroke: "#e07b39",
	white: "#ffffff",
	border: "#e0d8f8", // soft purple border
	borderLight: "#ede8fb",
	mutedText: "#8a7aaa",
	// Pastel stat colours
	statGreenBg: "#d4f0e0",
	statGreenText: "#2d7a55",
	statRedBg: "#fad4d4",
	statRedText: "#a83232",
	statBlueBg: "#d4e8f5",
	statBlueText: "#2a5f8f",
	statOrangeBg: "#fde8cc",
	statOrangeText: "#a85a1a",
	statNeutralBg: "#fde8cc",
	statNeutralText: "#7a5a1a",
};

const CATEGORIES = [
	{ value: "Vegetables", color: "#4caf7d", bg: "#d4f0e0" },
	{ value: "Fruits", color: "#e05c7a", bg: "#fad4de" },
	{ value: "Grains", color: "#d4a017", bg: "#fde8cc" },
	{ value: "Proteins", color: "#e07b39", bg: "#fde8d4" },
	{ value: "Dairy", color: "#9b7fe8", bg: "#ede8f7" },
	{ value: "Legumes", color: "#3db8a0", bg: "#d4f0ea" },
	{ value: "Liquids", color: "#4ab8d8", bg: "#d4eef5" },
	{ value: "Other", color: "#8a7aaa", bg: "#ece8f9" },
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
	{ value: "Loved", color: "#2d7a55", bg: "#d4f0e0", border: "#a8dcc0" },
	{ value: "Good", color: "#3a7a3a", bg: "#ddf0dd", border: "#a8d8a8" },
	{ value: "Neutral", color: "#7a5a1a", bg: "#fde8cc", border: "#ddc8a8" },
	{ value: "Rejected", color: "#a83232", bg: "#fad4d4", border: "#dca8a8" },
	{ value: "Allergic", color: "#c0392b", bg: "#fde8e8", border: "#e07070" },
];

// ─── RECIPES ──────────────────────────────────────────────────────────────────
// const RECIPES = [
// 	{
// 		id: 1,
// 		title: "Banana Oat Pancakes",
// 		category: "Breakfast",
// 		ageGroup: "6m+",
// 		time: "15 min",
// 		tags: ["dairy-free", "egg-free"],
// 		locked: false,
// 		description: "Soft, naturally sweet pancakes perfect for little hands.",
// 		ingredients: [
// 			"1 ripe banana",
// 			"4 tbsp rolled oats",
// 			"1 egg",
// 			"Pinch of cinnamon",
// 			"Coconut oil for frying",
// 		],
// 		steps: [
// 			"Mash the banana well until smooth.",
// 			"Blend oats to a rough flour and mix in.",
// 			"Beat in the egg and cinnamon.",
// 			"Heat coconut oil in a non-stick pan on medium-low.",
// 			"Drop tablespoons of batter and cook 2–3 min each side.",
// 			"Cool completely. Cut into strips for easy gripping.",
// 		],
// 	},
// 	{
// 		id: 2,
// 		title: "Sweet Potato Fingers",
// 		category: "Finger Foods",
// 		ageGroup: "6m+",
// 		time: "30 min",
// 		tags: ["vegan", "iron-rich"],
// 		locked: false,
// 		description:
// 			"Soft-baked wedges that are easy to pick up and naturally sweet.",
// 		ingredients: [
// 			"1 medium sweet potato",
// 			"1 tsp olive oil",
// 			"Pinch of cumin (optional)",
// 		],
// 		steps: [
// 			"Preheat oven to 200°C / 180°C fan.",
// 			"Peel sweet potato and cut into finger-sized wedges.",
// 			"Toss in olive oil and cumin.",
// 			"Spread on lined baking tray.",
// 			"Bake 25–30 minutes until soft and slightly golden.",
// 			"Cool until just warm before serving.",
// 		],
// 	},
// 	{
// 		id: 3,
// 		title: "Salmon & Broccoli Bites",
// 		category: "Mains",
// 		ageGroup: "7m+",
// 		time: "25 min",
// 		tags: ["omega-3", "iron-rich"],
// 		locked: true,
// 		description: "Omega-3 packed bites with hidden veg.",
// 		ingredients: [
// 			"150g cooked salmon",
// 			"80g cooked broccoli",
// 			"2 tbsp breadcrumbs",
// 			"1 egg yolk",
// 		],
// 		steps: [
// 			"Flake salmon and finely chop broccoli.",
// 			"Mix with breadcrumbs and egg yolk.",
// 			"Shape into small patties.",
// 			"Bake at 180°C for 15–18 minutes.",
// 			"Cool before serving.",
// 		],
// 	},
// 	{
// 		id: 4,
// 		title: "Avocado Toast Soldiers",
// 		category: "Breakfast",
// 		ageGroup: "6m+",
// 		time: "10 min",
// 		tags: ["healthy-fats"],
// 		locked: true,
// 		description: "Creamy avocado on toast cut into soldiers.",
// 		ingredients: [
// 			"½ ripe avocado",
// 			"1 slice wholemeal toast",
// 			"Squeeze of lemon juice",
// 		],
// 		steps: [
// 			"Mash avocado with lemon juice.",
// 			"Toast bread until golden.",
// 			"Spread avocado on toast.",
// 			"Cut into soldiers and serve.",
// 		],
// 	},
// 	{
// 		id: 5,
// 		title: "Lentil & Veggie Fritters",
// 		category: "Mains",
// 		ageGroup: "7m+",
// 		time: "35 min",
// 		tags: ["high-protein", "iron-rich"],
// 		locked: true,
// 		description: "Iron-rich fritters packed with hidden veg.",
// 		ingredients: [
// 			"100g cooked red lentils",
// 			"1 grated carrot",
// 			"1 grated courgette",
// 			"2 tbsp plain flour",
// 			"1 egg",
// 		],
// 		steps: [
// 			"Squeeze moisture from grated veg.",
// 			"Mix lentils, veg, flour, egg.",
// 			"Shape into patties.",
// 			"Fry on medium heat 3–4 min each side.",
// 			"Drain and cool before serving.",
// 		],
// 	},
// 	{
// 		id: 6,
// 		title: "Mango Yoghurt Pots",
// 		category: "Snacks",
// 		ageGroup: "6m+",
// 		time: "5 min",
// 		tags: ["probiotic"],
// 		locked: true,
// 		description: "A quick creamy snack full of probiotics.",
// 		ingredients: [
// 			"3 tbsp full-fat plain yoghurt",
// 			"2 tbsp fresh or frozen mango",
// 			"Optional: pinch of cardamom",
// 		],
// 		steps: [
// 			"Defrost mango if frozen.",
// 			"Mash or blend mango to a purée.",
// 			"Swirl through yoghurt.",
// 			"Serve in a bowl or on a preloaded spoon.",
// 		],
// 	},
// ];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
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
function getDaysInMonth(m, y) {
	return new Date(y, m, 0).getDate();
}
function buildYears(from, to) {
	const y = [];
	for (let i = to; i >= from; i--) y.push(String(i));
	return y;
}
function buildDays(m, y) {
	const n = getDaysInMonth(m, y),
		d = [];
	for (let i = 1; i <= n; i++) d.push(String(i).padStart(2, "0"));
	return d;
}

// ─── SVG ICON LIBRARY ─────────────────────────────────────────────────────────
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
		chef: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Path
					{...p}
					d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z"
				/>
				<Line {...p} x1="6" y1="17" x2="18" y2="17" />
			</Svg>
		),
		more: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Line {...p} x1="3" y1="6" x2="21" y2="6" />
				<Line {...p} x1="3" y1="12" x2="21" y2="12" />
				<Line {...p} x1="3" y1="18" x2="21" y2="18" />
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
				<Path {...p} d="M2 20h20M5 20l-2-9 5 4 4-8 4 8 5-4-2 9" />
			</Svg>
		),
		user: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Path {...p} d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
				<Circle {...p} cx="12" cy="7" r="4" />
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
		heart: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Path
					{...p}
					d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
				/>
			</Svg>
		),
		pdf: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Path
					{...p}
					d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
				/>
				<Polyline {...p} points="14 2 14 8 20 8" />
				<Line {...p} x1="16" y1="13" x2="8" y2="13" />
				<Line {...p} x1="16" y1="17" x2="8" y2="17" />
				<Polyline {...p} points="10 9 9 9 8 9" />
			</Svg>
		),
	};
	return icons[name] || null;
}

// ─── CATEGORY SVG ICONS (illustrated, pastel) ─────────────────────────────────
function CategoryIcon({ category, size = 32 }) {
	const cfg = CATEGORIES.find((c) => c.value === category) || CATEGORIES[7];
	const s2 = size * 0.55;
	const icons = {
		Vegetables: (
			<Svg width={s2} height={s2} viewBox="0 0 24 24">
				<Path
					stroke={cfg.color}
					strokeWidth={2}
					strokeLinecap="round"
					strokeLinejoin="round"
					fill="none"
					d="M2 22c1-5 4-9 8-10 1 3 3 5 5 6-2 1-4 3-5 6"
				/>
				<Path
					stroke={cfg.color}
					strokeWidth={2}
					strokeLinecap="round"
					strokeLinejoin="round"
					fill="none"
					d="M22 2s-8 2-10 10C8 16 6 19 2 22c3-1 7-3 10-8 2 1 4 1 6-1-1-3-1-7 4-11z"
				/>
			</Svg>
		),
		Fruits: (
			<Svg width={s2} height={s2} viewBox="0 0 24 24">
				<Path
					stroke={cfg.color}
					strokeWidth={2}
					strokeLinecap="round"
					strokeLinejoin="round"
					fill="none"
					d="M12 20.94c1.5 0 2.75-.67 4-2 1.5-1.67 2-3.5 2-5.44C18 9 15.87 7 13.5 7c-.87 0-1.5.2-2 .5-.5-.3-1.13-.5-2-.5C7.13 7 5 9 5 13.5c0 1.94.5 3.77 2 5.44 1.25 1.33 2.5 2 4 2z"
				/>
				<Path
					stroke={cfg.color}
					strokeWidth={2}
					strokeLinecap="round"
					fill="none"
					d="M12 7V3"
				/>
			</Svg>
		),
		Grains: (
			<Svg width={s2} height={s2} viewBox="0 0 24 24">
				<Path
					stroke={cfg.color}
					strokeWidth={2}
					strokeLinecap="round"
					strokeLinejoin="round"
					fill="none"
					d="M2 22 16 8"
				/>
				<Path
					stroke={cfg.color}
					strokeWidth={2}
					strokeLinecap="round"
					strokeLinejoin="round"
					fill="none"
					d="M3.47 12.53 5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94z"
				/>
				<Path
					stroke={cfg.color}
					strokeWidth={2}
					strokeLinecap="round"
					strokeLinejoin="round"
					fill="none"
					d="M7.47 8.53 9 7l1.53 1.53a3.5 3.5 0 0 1 0 4.94L9 15l-1.53-1.53a3.5 3.5 0 0 1 0-4.94z"
				/>
			</Svg>
		),
		Proteins: (
			<Svg width={s2} height={s2} viewBox="0 0 24 24">
				<Path
					stroke={cfg.color}
					strokeWidth={2}
					strokeLinecap="round"
					strokeLinejoin="round"
					fill="none"
					d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"
				/>
				<Path
					stroke={cfg.color}
					strokeWidth={2}
					strokeLinecap="round"
					strokeLinejoin="round"
					fill="none"
					d="M7 2v20"
				/>
				<Path
					stroke={cfg.color}
					strokeWidth={2}
					strokeLinecap="round"
					strokeLinejoin="round"
					fill="none"
					d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"
				/>
			</Svg>
		),
		Dairy: (
			<Svg width={s2} height={s2} viewBox="0 0 24 24">
				<Path
					stroke={cfg.color}
					strokeWidth={2}
					strokeLinecap="round"
					strokeLinejoin="round"
					fill="none"
					d="M8 2h8"
				/>
				<Path
					stroke={cfg.color}
					strokeWidth={2}
					strokeLinecap="round"
					strokeLinejoin="round"
					fill="none"
					d="M9 2v2.789a4 4 0 0 1-.672 2.219l-.656.984A4 4 0 0 0 7 10.212V20a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-9.789a4 4 0 0 0-.672-2.219l-.656-.984A4 4 0 0 1 15 4.788V2"
				/>
			</Svg>
		),
		Legumes: (
			<Svg width={s2} height={s2} viewBox="0 0 24 24">
				<Path
					stroke={cfg.color}
					strokeWidth={2}
					strokeLinecap="round"
					strokeLinejoin="round"
					fill="none"
					d="M10.5 22C6.5 22 2 17.52 2 13c0-3 1.9-5.5 5-6.5 1.3-.4 3.1.1 4.3 1.3C13.4 9.9 16 11 18 11c2 0 4-1 4-3-2 0-4-1-4-3 0-1.1.9-2 2-2"
				/>
				<Path
					stroke={cfg.color}
					strokeWidth={2}
					strokeLinecap="round"
					fill="none"
					d="M14.5 22c2-1.5 3.5-4 3.5-7 0-3-2-5-5-5"
				/>
			</Svg>
		),
		Liquids: (
			<Svg width={s2} height={s2} viewBox="0 0 24 24">
				<Path
					stroke={cfg.color}
					strokeWidth={2}
					strokeLinecap="round"
					strokeLinejoin="round"
					fill={cfg.color + "44"}
					d="M12 2C6 9 4 13 4 16a8 8 0 0 0 16 0c0-3-2-7-8-14z"
				/>
			</Svg>
		),
		Other: (
			<Svg width={s2} height={s2} viewBox="0 0 24 24">
				<Path
					stroke={cfg.color}
					strokeWidth={2}
					strokeLinecap="round"
					strokeLinejoin="round"
					fill="none"
					d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"
				/>
				<Path
					stroke={cfg.color}
					strokeWidth={2}
					strokeLinecap="round"
					fill="none"
					d="M7 2v20"
				/>
			</Svg>
		),
	};
	return (
		<View
			style={{
				width: size,
				height: size,
				borderRadius: size * 0.28,
				backgroundColor: cfg.bg,
				alignItems: "center",
				justifyContent: "center",
			}}>
			{icons[category] || icons.Other}
		</View>
	);
}

// ─── REACTION SVG FACES ───────────────────────────────────────────────────────
function ReactionFace({ reaction, size = 40 }) {
	const cfg = reactionCfg(reaction);
	const c = cfg.color;
	const bg = cfg.bg;
	const faces = {
		Loved: (
			<Svg width={size} height={size} viewBox="0 0 40 40">
				<Circle cx="20" cy="20" r="18" fill={bg} stroke={c} strokeWidth="1.5" />
				<Circle cx="14" cy="17" r="2.5" fill={c} />
				<Circle cx="26" cy="17" r="2.5" fill={c} />
				<Path
					d="M12 25 Q20 33 28 25"
					stroke={c}
					strokeWidth="2.2"
					strokeLinecap="round"
					fill="none"
				/>
				<Path
					d="M15 14 Q14 11 11 12"
					stroke={c}
					strokeWidth="1.5"
					strokeLinecap="round"
					fill="none"
				/>
				<Path
					d="M25 14 Q26 11 29 12"
					stroke={c}
					strokeWidth="1.5"
					strokeLinecap="round"
					fill="none"
				/>
			</Svg>
		),
		Good: (
			<Svg width={size} height={size} viewBox="0 0 40 40">
				<Circle cx="20" cy="20" r="18" fill={bg} stroke={c} strokeWidth="1.5" />
				<Circle cx="14" cy="17" r="2.5" fill={c} />
				<Circle cx="26" cy="17" r="2.5" fill={c} />
				<Path
					d="M13 25 Q20 31 27 25"
					stroke={c}
					strokeWidth="2.2"
					strokeLinecap="round"
					fill="none"
				/>
			</Svg>
		),
		Neutral: (
			<Svg width={size} height={size} viewBox="0 0 40 40">
				<Circle cx="20" cy="20" r="18" fill={bg} stroke={c} strokeWidth="1.5" />
				<Circle cx="14" cy="17" r="2.5" fill={c} />
				<Circle cx="26" cy="17" r="2.5" fill={c} />
				<Line
					x1="13"
					y1="26"
					x2="27"
					y2="26"
					stroke={c}
					strokeWidth="2.2"
					strokeLinecap="round"
				/>
			</Svg>
		),
		Rejected: (
			<Svg width={size} height={size} viewBox="0 0 40 40">
				<Circle cx="20" cy="20" r="18" fill={bg} stroke={c} strokeWidth="1.5" />
				<Circle cx="14" cy="17" r="2.5" fill={c} />
				<Circle cx="26" cy="17" r="2.5" fill={c} />
				<Path
					d="M13 28 Q20 22 27 28"
					stroke={c}
					strokeWidth="2.2"
					strokeLinecap="round"
					fill="none"
				/>
				<Path
					d="M15 14 Q14 11 11 13"
					stroke={c}
					strokeWidth="1.5"
					strokeLinecap="round"
					fill="none"
				/>
				<Path
					d="M25 14 Q26 11 29 13"
					stroke={c}
					strokeWidth="1.5"
					strokeLinecap="round"
					fill="none"
				/>
			</Svg>
		),
		Allergic: (
			<Svg width={size} height={size} viewBox="0 0 40 40">
				<Circle
					cx="20"
					cy="20"
					r="18"
					fill="#fde8e8"
					stroke="#c0392b"
					strokeWidth="1.5"
				/>
				<Path
					d="M13 12 L27 28 M27 12 L13 28"
					stroke="#c0392b"
					strokeWidth="2.5"
					strokeLinecap="round"
				/>
				{/* <Text fill="#c0392b" fontSize="9" fontWeight="bold" x="14" y="38">
					ALLERGY
				</Text> */}
			</Svg>
		),
	};
	return faces[reaction] || faces.Neutral;
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
				flexDirection: "row",
				alignItems: "center",
				gap: 6,
				backgroundColor: r.bg,
				borderRadius: 999,
				paddingHorizontal: 10,
				paddingVertical: 5,
			}}>
			<ReactionFace reaction={reaction} size={18} />
			<Text style={{ color: r.color, fontSize: 12, fontWeight: "700" }}>
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

// ─── PICKER MODAL ─────────────────────────────────────────────────────────────
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

// ─── DATE PICKER ──────────────────────────────────────────────────────────────
function DatePickerModal({
	visible,
	title,
	value,
	onSelect,
	onClose,
	minYear = 2000,
	maxYear = new Date().getFullYear(),
}) {
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
	const [month, setMonth] = useState(initial.month);
	const [year, setYear] = useState(initial.year);
	const [showDay, setShowDay] = useState(false);
	const [showMonth, setShowMonth] = useState(false);
	const [showYear, setShowYear] = useState(false);
	const years = buildYears(minYear, maxYear);
	const days = buildDays(month + 1, parseInt(year));
	const confirm = () => {
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
					<View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
						<View style={{ flex: 1 }}>
							<Text style={[s.label, { marginBottom: 6 }]}>Day</Text>
							<TouchableOpacity
								onPress={() => setShowDay(true)}
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
						<View style={{ flex: 1.5 }}>
							<Text style={[s.label, { marginBottom: 6 }]}>Month</Text>
							<TouchableOpacity
								onPress={() => setShowMonth(true)}
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
						<View style={{ flex: 1.2 }}>
							<Text style={[s.label, { marginBottom: 6 }]}>Year</Text>
							<TouchableOpacity
								onPress={() => setShowYear(true)}
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
					<View
						style={{
							backgroundColor: C.bgPurple,
							borderRadius: 12,
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
					<PickerModal
						visible={showDay}
						title="Day"
						options={days}
						value={day}
						onSelect={setDay}
						onClose={() => setShowDay(false)}
					/>
					<PickerModal
						visible={showMonth}
						title="Month"
						options={MONTHS}
						value={MONTHS[month]}
						onSelect={(v) => setMonth(MONTHS.indexOf(v))}
						onClose={() => setShowMonth(false)}
					/>
					<PickerModal
						visible={showYear}
						title="Year"
						options={years}
						value={year}
						onSelect={setYear}
						onClose={() => setShowYear(false)}
					/>
				</View>
			</TouchableOpacity>
		</Modal>
	);
}

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
		<View style={{ gap: 18 }}>
			<DateField
				label="Date"
				value={form.date}
				onChange={(v) => set("date", v)}
				minYear={2020}
				maxYear={new Date().getFullYear() + 1}
			/>
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

			{/* Category — illustrated icons */}
			<View>
				<Text style={s.label}>Category</Text>
				<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
					{CATEGORIES.map((c) => {
						const sel = form.category === c.value;
						return (
							<TouchableOpacity
								key={c.value}
								onPress={() => set("category", c.value)}
								style={{
									alignItems: "center",
									gap: 6,
									width: "22%",
									opacity: sel ? 1 : 0.7,
								}}
								activeOpacity={0.8}>
								<View
									style={{
										borderWidth: 2.5,
										borderColor: sel ? c.color : "transparent",
										borderRadius: 16,
										padding: 2,
									}}>
									<CategoryIcon category={c.value} size={48} />
								</View>
								<Text
									style={{
										fontSize: 9,
										fontWeight: "700",
										color: sel ? c.color : C.mutedText,
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

			{/* Reaction — SVG faces */}
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
									backgroundColor: sel ? r.bg : C.white,
									borderColor: sel ? r.border : C.borderLight,
									borderWidth: 2,
									borderRadius: 16,
									paddingVertical: 10,
									paddingHorizontal: 6,
									flex: 1,
									alignItems: "center",
									gap: 6,
									minWidth: "18%",
									shadowColor: "#000",
									shadowOpacity: sel ? 0 : 0.03,
									shadowRadius: 4,
									elevation: sel ? 0 : 1,
								}}
								activeOpacity={0.8}>
								<ReactionFace reaction={r.value} size={32} />
								<Text
									style={{
										fontWeight: "700",
										fontSize: 10,
										color: sel ? r.color : C.mutedText,
										textAlign: "center",
									}}>
									{r.value}
								</Text>
							</TouchableOpacity>
						);
					})}
				</View>
			</View>

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

			<TouchableOpacity
				onPress={() => set("favourite", !form.favourite)}
				style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
				activeOpacity={0.8}>
				<View
					style={{
						width: 24,
						height: 24,
						borderRadius: 8,
						borderWidth: 2,
						borderColor: C.primaryPurple,
						backgroundColor: form.favourite ? C.primaryPurple : C.white,
						alignItems: "center",
						justifyContent: "center",
					}}>
					{form.favourite && <Icon name="check" size={14} color={C.white} />}
				</View>
				<Icon name="starFill" size={16} color="#d4a017" />
				<Text
					style={{ fontWeight: "700", fontSize: 13, color: C.textCharcoal }}>
					Mark as Favourite
				</Text>
			</TouchableOpacity>

			<PrimaryBtn label={buttonLabel} onPress={handleSubmit} />
		</View>
	);
}

// ─── LOADING ──────────────────────────────────────────────────────────────────
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
	const neutral = keys.filter((k) =>
		groups[k].attempts.some((a) => a.reaction === "Neutral"),
	).length;
	const allergic = foodLog.filter((f) => f.reaction === "Allergic").length;
	const liquids = keys.filter((k) => groups[k].category === "Liquids").length;
	const favourites = keys.filter((k) =>
		groups[k].attempts.some((a) => a.favourite),
	).length;
	const weeks = child ? calcAgeWeeks(child.dob) : null;
	const months = child ? calcAgeMonths(child.dob) : null;
	const recent = [...foodLog]
		.sort((a, b) => new Date(b.date) - new Date(a.date))
		.slice(0, 5);

	return (
		<ScrollView
			style={{ flex: 1 }}
			contentContainerStyle={{ gap: 18, paddingBottom: 24 }}
			showsVerticalScrollIndicator={false}>
			{/* Child banner */}
			{child ? (
				<View
					style={{
						backgroundColor: C.primaryPurple,
						borderRadius: 24,
						padding: 22,
						flexDirection: "row",
						justifyContent: "space-between",
						alignItems: "center",
					}}>
					<View style={{ flex: 1 }}>
						<Text
							style={{
								fontSize: 12,
								color: "rgba(255,255,255,0.75)",
								fontWeight: "600",
								marginBottom: 4,
							}}>
							Tracking for
						</Text>
						<Text style={{ fontSize: 30, fontWeight: "800", color: C.white }}>
							{child.name}
						</Text>
						{weeks !== null && (
							<View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
								<View
									style={{
										backgroundColor: "rgba(255,255,255,0.2)",
										borderRadius: 999,
										paddingHorizontal: 12,
										paddingVertical: 5,
									}}>
									<Text
										style={{ fontSize: 12, color: C.white, fontWeight: "700" }}>
										{weeks} weeks
									</Text>
								</View>
								<View
									style={{
										backgroundColor: "rgba(255,255,255,0.2)",
										borderRadius: 999,
										paddingHorizontal: 12,
										paddingVertical: 5,
									}}>
									<Text
										style={{ fontSize: 12, color: C.white, fontWeight: "700" }}>
										{months} months
									</Text>
								</View>
							</View>
						)}
						{child.weaningStart && (
							<Text
								style={{
									fontSize: 11,
									color: "rgba(255,255,255,0.65)",
									marginTop: 6,
								}}>
								Weaning since {formatDate(child.weaningStart)}
							</Text>
						)}
					</View>
					{/* Illustrated baby face in SVG */}
					<Svg width={64} height={64} viewBox="0 0 64 64">
						<Circle cx="32" cy="32" r="30" fill="rgba(255,255,255,0.15)" />
						<Circle cx="32" cy="28" r="16" fill="rgba(255,255,255,0.25)" />
						<Circle cx="24" cy="26" r="3" fill="rgba(255,255,255,0.8)" />
						<Circle cx="40" cy="26" r="3" fill="rgba(255,255,255,0.8)" />
						<Path
							d="M26 34 Q32 39 38 34"
							stroke="rgba(255,255,255,0.8)"
							strokeWidth="2.5"
							strokeLinecap="round"
							fill="none"
						/>
						<Path
							d="M14 44 Q32 56 50 44"
							stroke="rgba(255,255,255,0.25)"
							strokeWidth="3"
							strokeLinecap="round"
							fill="none"
						/>
					</Svg>
				</View>
			) : (
				<View style={[s.card, { alignItems: "center", paddingVertical: 28 }]}>
					<Icon name="baby" size={44} color={C.secondaryPurple} />
					<Text
						style={{
							color: C.mutedText,
							fontWeight: "600",
							fontSize: 15,
							marginTop: 10,
							marginBottom: 12,
						}}>
						No child added yet
					</Text>
					<TouchableOpacity
						onPress={() => onNavigate("children")}
						style={[s.btnPrimary, { paddingHorizontal: 28, width: "auto" }]}>
						<Text style={s.btnPrimaryText}>Add your baby</Text>
					</TouchableOpacity>
				</View>
			)}

			{/* Stat cards — Row 1: 4 cards */}
			<View style={{ flexDirection: "row", gap: 10 }}>
				<View style={[s.statCard, { backgroundColor: C.bgPurple, flex: 1 }]}>
					<Icon name="grid" size={20} color={C.primaryPurple} />
					<Text style={[s.statValue, { color: C.primaryPurple }]}>
						{unique}
					</Text>
					<Text style={[s.statLabel, { color: C.primaryPurple }]}>Tried</Text>
				</View>
				<View style={[s.statCard, { backgroundColor: C.statGreenBg, flex: 1 }]}>
					<ReactionFace reaction="Loved" size={24} />
					<Text style={[s.statValue, { color: C.statGreenText }]}>{liked}</Text>
					<Text style={[s.statLabel, { color: C.statGreenText }]}>Likes</Text>
				</View>
				<View style={[s.statCard, { backgroundColor: C.statRedBg, flex: 1 }]}>
					<ReactionFace reaction="Rejected" size={24} />
					<Text style={[s.statValue, { color: C.statRedText }]}>
						{disliked}
					</Text>
					<Text style={[s.statLabel, { color: C.statRedText }]}>Dislikes</Text>
				</View>
				<View
					style={[s.statCard, { backgroundColor: C.statNeutralBg, flex: 1 }]}>
					<ReactionFace reaction="Neutral" size={24} />
					<Text style={[s.statValue, { color: C.statNeutralText }]}>
						{neutral}
					</Text>
					<Text style={[s.statLabel, { color: C.statNeutralText }]}>
						Neutral
					</Text>
				</View>
			</View>

			{/* Stat cards — Row 2: 3 cards */}
			<View style={{ flexDirection: "row", gap: 10 }}>
				<View style={[s.statCard, { backgroundColor: "#fde8e8", flex: 1 }]}>
					<ReactionFace reaction="Allergic" size={24} />
					<Text style={[s.statValue, { color: "#c0392b" }]}>{allergic}</Text>
					<Text style={[s.statLabel, { color: "#c0392b" }]}>Allergic</Text>
				</View>
				<View style={[s.statCard, { backgroundColor: C.statBlueBg, flex: 1 }]}>
					<CategoryIcon category="Liquids" size={30} />
					<Text style={[s.statValue, { color: C.statBlueText }]}>
						{liquids}
					</Text>
					<Text style={[s.statLabel, { color: C.statBlueText }]}>Liquids</Text>
				</View>
				<View style={[s.statCard, { backgroundColor: "#fef6d4", flex: 1 }]}>
					<Icon name="starFill" size={20} color="#c49a10" />
					<Text style={[s.statValue, { color: "#c49a10" }]}>{favourites}</Text>
					<Text style={[s.statLabel, { color: "#c49a10" }]}>Faves</Text>
				</View>
			</View>

			{/* Allergy alert banner — only shown if there are any */}
			{allergic > 0 && (
				<View
					style={{
						backgroundColor: "#fde8e8",
						borderRadius: 16,
						padding: 16,
						flexDirection: "row",
						alignItems: "center",
						gap: 14,
						shadowColor: "#c0392b",
						shadowOpacity: 0.1,
						shadowRadius: 8,
						elevation: 2,
					}}>
					<View
						style={{
							width: 44,
							height: 44,
							borderRadius: 14,
							backgroundColor: "#fad4d4",
							alignItems: "center",
							justifyContent: "center",
						}}>
						<Icon name="alert" size={22} color="#c0392b" />
					</View>
					<View style={{ flex: 1 }}>
						<Text style={{ fontWeight: "700", fontSize: 14, color: "#c0392b" }}>
							Allergic Reactions Logged
						</Text>
						<Text style={{ fontSize: 12, color: "#c0392b", marginTop: 2 }}>
							{allergic} reaction{allergic !== 1 ? "s" : ""} recorded — check
							food log
						</Text>
					</View>
				</View>
			)}

			{/* Recent foods */}
			{recent.length > 0 && (
				<View style={s.card}>
					<View
						style={{
							flexDirection: "row",
							justifyContent: "space-between",
							alignItems: "center",
							marginBottom: 16,
						}}>
						<Text style={s.sectionTitle}>Recent Foods</Text>
						<TouchableOpacity onPress={() => onNavigate("log")}>
							<Text
								style={{
									fontSize: 13,
									color: C.primaryPurple,
									fontWeight: "700",
								}}>
								View all
							</Text>
						</TouchableOpacity>
					</View>
					{recent.map((e, i) => {
						const cat =
							CATEGORIES.find((c) => c.value === e.category) || CATEGORIES[7];
						return (
							<View
								key={e.id}
								style={{
									flexDirection: "row",
									alignItems: "center",
									gap: 14,
									paddingVertical: 12,
									borderBottomWidth: i < recent.length - 1 ? 1 : 0,
									borderBottomColor: C.borderLight,
								}}>
								<CategoryIcon category={e.category} size={44} />
								<View style={{ flex: 1 }}>
									<Text
										style={{
											fontWeight: "700",
											fontSize: 15,
											color: C.primaryPinkDark,
										}}>
										{e.name}
										{e.favourite ? " ★" : ""}
									</Text>
									<Text
										style={{ fontSize: 12, color: C.mutedText, marginTop: 2 }}>
										{formatDate(e.date)}
										{e.form ? ` · ${e.form}` : ""}
									</Text>
								</View>
								<ReactionFace reaction={e.reaction} size={34} />
							</View>
						);
					})}
				</View>
			)}

			{foodLog.length === 0 && (
				<View style={[s.card, { alignItems: "center", paddingVertical: 40 }]}>
					<Icon name="utensils" size={48} color={C.secondaryPurple} />
					<Text style={[s.sectionTitle, { marginTop: 16, marginBottom: 8 }]}>
						No foods logged yet
					</Text>
					<Text
						style={{
							color: C.mutedText,
							fontSize: 14,
							textAlign: "center",
							marginBottom: 20,
							lineHeight: 22,
						}}>
						Start tracking your little one's weaning journey
					</Text>
					<TouchableOpacity
						onPress={() => onNavigate("add")}
						style={[s.btnPrimary, { paddingHorizontal: 32, width: "auto" }]}>
						<Text style={s.btnPrimaryText}>Log First Food</Text>
					</TouchableOpacity>
				</View>
			)}
		</ScrollView>
	);
}

// ─── PDF EXPORT ───────────────────────────────────────────────────────────────
async function exportFoodLogAsPDF(foodLog, childName) {
	if (!foodLog.length) {
		Alert.alert("Nothing to export", "Add some food entries first.");
		return;
	}
	const groups = groupByFood(foodLog);
	const keys = Object.keys(groups);
	const rows = keys
		.map((key) => {
			const g = groups[key];
			const likedCnt = g.attempts.filter(
				(a) => a.reaction === "Loved" || a.reaction === "Good",
			).length;
			const pct = Math.round((likedCnt / g.attempts.length) * 100);
			const hasAllergy = g.attempts.some((a) => a.reaction === "Allergic");
			const attemptsHTML = g.attempts
				.map(
					(a, i) =>
						`<tr style="background:${i % 2 === 0 ? "#f9f7fe" : "#ffffff"}"><td style="padding:8px 12px;color:#8a7aaa;font-size:12px;">Attempt ${i + 1}</td><td style="padding:8px 12px;font-size:12px;">${formatDate(a.date)}</td><td style="padding:8px 12px;font-size:12px;">${a.form || "—"}</td><td style="padding:8px 12px;font-size:12px;color:${reactionCfg(a.reaction).color};font-weight:700;">${a.reaction || "—"}</td><td style="padding:8px 12px;font-size:12px;color:#8a7aaa;font-style:italic;">${a.notes || ""}</td></tr>`,
				)
				.join("");
			return `<div style="margin-bottom:20px;border-radius:12px;overflow:hidden;border:2px solid ${hasAllergy ? "#e07070" : "#ece8f9"};"><div style="background:${hasAllergy ? "#fde8e8" : "#ede8f7"};padding:12px 16px;display:flex;justify-content:space-between;"><span style="font-weight:700;font-size:15px;color:#5a2d7a;">${g.name}${hasAllergy ? '<span style="margin-left:10px;background:#fee2e2;color:#c0392b;border-radius:999px;padding:2px 10px;font-size:11px;font-weight:700;">⚠ ALLERGY</span>' : ""}</span><span style="font-size:12px;color:#3db87a;font-weight:700;">${pct}% liked</span></div><table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#f3f0fa;"><th style="padding:8px 12px;text-align:left;font-size:11px;color:#8a7aaa;">#</th><th style="padding:8px 12px;text-align:left;font-size:11px;color:#8a7aaa;">Date</th><th style="padding:8px 12px;text-align:left;font-size:11px;color:#8a7aaa;">Form</th><th style="padding:8px 12px;text-align:left;font-size:11px;color:#8a7aaa;">Reaction</th><th style="padding:8px 12px;text-align:left;font-size:11px;color:#8a7aaa;">Notes</th></tr></thead><tbody>${attemptsHTML}</tbody></table></div>`;
		})
		.join("");
	const totalFoods = keys.length,
		totalAttempts = foodLog.length;
	const liked = keys.filter((k) =>
		groups[k].attempts.some(
			(a) => a.reaction === "Loved" || a.reaction === "Good",
		),
	).length;
	const allergic = foodLog.filter((f) => f.reaction === "Allergic").length;
	const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><style>body{font-family:-apple-system,Helvetica,Arial,sans-serif;margin:0;padding:32px;background:#fff;color:#3d3d3d;}h1{color:#5a2d7a;font-size:26px;margin:0 0 4px;}.subtitle{color:#8a7aaa;font-size:14px;margin-bottom:24px;}.stats{display:flex;gap:16px;margin-bottom:28px;flex-wrap:wrap;}.stat{background:#ede8f7;border-radius:10px;padding:12px 18px;text-align:center;}.stat-val{font-size:24px;font-weight:700;color:#9b7fe8;}.stat-lbl{font-size:11px;color:#8a7aaa;text-transform:uppercase;}.footer{margin-top:40px;padding-top:16px;border-top:2px solid #ece8f9;font-size:11px;color:#8a7aaa;text-align:center;}</style></head><body><h1>🌱 Munch Sprouts</h1><p class="subtitle">Food Log${childName ? ` — ${childName}` : ""} · Generated ${formatDate(new Date().toISOString().split("T")[0])}</p><div class="stats"><div class="stat"><div class="stat-val">${totalFoods}</div><div class="stat-lbl">Foods tried</div></div><div class="stat"><div class="stat-val">${totalAttempts}</div><div class="stat-lbl">Attempts</div></div><div class="stat"><div class="stat-val">${liked}</div><div class="stat-lbl">Liked</div></div>${allergic > 0 ? `<div class="stat" style="background:#fde8e8;"><div class="stat-val" style="color:#c0392b;">${allergic}</div><div class="stat-lbl" style="color:#c0392b;">Allergic</div></div>` : ""}</div><div style="font-size:13px;font-weight:700;color:#5a2d7a;text-transform:uppercase;letter-spacing:1px;margin:24px 0 12px;">Food Log (${totalFoods} foods)</div>${rows}<div class="footer">Generated by Munch Sprouts · For informational purposes only.<br/>Always consult your GP or Health Visitor before starting weaning.</div></body></html>`;
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
			{/* Search bar */}
			<View
				style={[
					s.input,
					{
						flexDirection: "row",
						alignItems: "center",
						gap: 8,
						marginBottom: 12,
						backgroundColor: C.white,
					},
				]}>
				<Icon name="search" size={16} color={C.mutedText} />
				<TextInput
					value={search}
					onChangeText={setSearch}
					placeholder="Search foods…"
					style={{
						flex: 1,
						color: C.textCharcoal,
						fontWeight: "600",
						fontSize: 15,
					}}
					placeholderTextColor={C.mutedText}
				/>
			</View>
			{/* Sort pills */}
			<View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
				{["date-desc", "alpha", "attempts"].map((opt) => (
					<TouchableOpacity
						key={opt}
						onPress={() => setSortBy(opt)}
						style={{
							backgroundColor: sortBy === opt ? C.primaryPurple : C.white,
							borderRadius: 999,
							paddingHorizontal: 14,
							paddingVertical: 7,
							shadowColor: "#000",
							shadowOpacity: 0.05,
							shadowRadius: 4,
							elevation: 1,
						}}>
						<Text
							style={{
								fontSize: 12,
								fontWeight: "700",
								color: sortBy === opt ? C.white : C.mutedText,
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
			<Text style={[s.smallLabel, { marginBottom: 10 }]}>
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
									borderWidth: hasAllergy ? 2 : 0,
									borderColor: hasAllergy ? "#e07070" : "transparent",
									backgroundColor: hasAllergy ? "#fde8e8" : C.white,
								},
							]}>
							<TouchableOpacity
								onPress={() => toggle(key)}
								style={{
									flexDirection: "row",
									alignItems: "center",
									padding: 16,
									gap: 14,
								}}
								activeOpacity={0.8}>
								<CategoryIcon category={g.category} size={48} />
								<View style={{ flex: 1 }}>
									<View
										style={{
											flexDirection: "row",
											alignItems: "center",
											gap: 7,
											flexWrap: "wrap",
										}}>
										<Text
											style={{
												fontWeight: "700",
												fontSize: 15,
												color: C.primaryPinkDark,
											}}>
											{g.name}
										</Text>
										{hasFav && (
											<Icon name="starFill" size={13} color="#d4a017" />
										)}
										{hasAllergy && (
											<View
												style={{
													backgroundColor: "#fde8e8",
													borderRadius: 999,
													paddingHorizontal: 8,
													paddingVertical: 2,
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
												borderRadius: 999,
												paddingHorizontal: 8,
												paddingVertical: 2,
											}}>
											<Text
												style={{
													fontSize: 10,
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
											marginTop: 6,
										}}>
										<ReactionBadge reaction={latest.reaction} />
										<Text style={{ fontSize: 11, color: C.mutedText }}>
											{formatDate(latest.date)}
										</Text>
									</View>
									{/* Like bar */}
									<View
										style={{
											flexDirection: "row",
											alignItems: "center",
											gap: 8,
											marginTop: 6,
										}}>
										<View
											style={{
												flex: 1,
												backgroundColor: C.borderLight,
												borderRadius: 999,
												height: 6,
												overflow: "hidden",
												maxWidth: 100,
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
												fontSize: 11,
												color: C.mutedText,
												fontWeight: "600",
											}}>
											{pct}% liked
										</Text>
									</View>
								</View>
								<Icon
									name={isOpen ? "chevUp" : "chevDown"}
									size={16}
									color={C.mutedText}
								/>
							</TouchableOpacity>
							{isOpen &&
								g.attempts.map((a, i) => (
									<View
										key={a.id}
										style={{
											padding: 14,
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
												<Text style={[s.smallLabel, { marginBottom: 6 }]}>
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
																backgroundColor: C.white,
																borderRadius: 999,
																paddingHorizontal: 10,
																paddingVertical: 4,
																shadowColor: "#000",
																shadowOpacity: 0.05,
																shadowRadius: 4,
																elevation: 1,
															}}>
															<Text
																style={{
																	fontSize: 11,
																	fontWeight: "600",
																	color: C.mutedText,
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
															fontSize: 12,
															color: C.mutedText,
															marginTop: 6,
															fontStyle: "italic",
														}}>
														"{a.notes}"
													</Text>
												) : null}
											</View>
											<View style={{ flexDirection: "row", gap: 6 }}>
												<SecondaryBtn
													onPress={() => onToggleFavourite(a.id)}
													style={{ padding: 8 }}>
													<Icon
														name={a.favourite ? "starFill" : "star"}
														size={14}
														color="#d4a017"
													/>
												</SecondaryBtn>
												<SecondaryBtn
													onPress={() => onEdit(a)}
													style={{ padding: 8 }}>
													<Icon name="edit" size={14} color={C.primaryPurple} />
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
													style={{ padding: 8 }}>
													<Icon name="trash" size={14} color="#c0392b" />
												</DangerBtn>
											</View>
										</View>
									</View>
								))}
						</View>
					);
				})}
				{/* Export PDF */}
				<TouchableOpacity
					onPress={() => exportFoodLogAsPDF(foodLog, childName)}
					style={{
						flexDirection: "row",
						alignItems: "center",
						justifyContent: "center",
						gap: 10,
						backgroundColor: C.white,
						borderRadius: 16,
						paddingVertical: 14,
						marginTop: 4,
						shadowColor: "#000",
						shadowOpacity: 0.05,
						shadowRadius: 8,
						elevation: 2,
					}}
					activeOpacity={0.8}>
					<Icon name="pdf" size={18} color={C.primaryPurple} />
					<Text
						style={{ fontWeight: "700", fontSize: 14, color: C.primaryPurple }}>
						Export as PDF
					</Text>
				</TouchableOpacity>
			</ScrollView>
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
		editTarget ? onEdit({ ...editTarget, ...form }) : onAdd({ ...form });
		setModalVisible(false);
	};
	return (
		<View style={{ flex: 1 }}>
			<View
				style={{
					flexDirection: "row",
					justifyContent: "space-between",
					alignItems: "center",
					marginBottom: 20,
				}}>
				<Text style={s.pageTitle}>Children</Text>
				<TouchableOpacity
					onPress={openAdd}
					style={[
						s.btnPrimary,
						{ paddingHorizontal: 18, width: "auto", paddingVertical: 10 },
					]}>
					<View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
						<Icon name="plus" size={14} color={C.white} />
						<Text style={s.btnPrimaryText}>Add Child</Text>
					</View>
				</TouchableOpacity>
			</View>
			<ScrollView
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{ gap: 14 }}>
				{children.length === 0 && (
					<View style={[s.card, { alignItems: "center", paddingVertical: 40 }]}>
						<Icon name="users" size={44} color={C.secondaryPurple} />
						<Text
							style={{
								color: C.mutedText,
								fontWeight: "600",
								marginTop: 14,
								fontSize: 15,
							}}>
							No children added yet
						</Text>
					</View>
				)}
				{children.map((child) => {
					const weeks = calcAgeWeeks(child.dob),
						months = calcAgeMonths(child.dob),
						isActive = child.id === activeChildId;
					return (
						<View
							key={child.id}
							style={[
								s.card,
								{
									borderWidth: 2,
									borderColor: isActive ? C.primaryPurple : "transparent",
									backgroundColor: isActive ? C.bgPurple : C.white,
								},
							]}>
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
											gap: 10,
											marginBottom: 6,
										}}>
										{/* SVG baby avatar */}
										<View
											style={{
												width: 44,
												height: 44,
												borderRadius: 22,
												backgroundColor: C.primaryPurple + "22",
												alignItems: "center",
												justifyContent: "center",
											}}>
											<Svg width={32} height={32} viewBox="0 0 32 32">
												<Circle
													cx="16"
													cy="13"
													r="8"
													fill={C.primaryPurple}
													opacity="0.7"
												/>
												<Circle cx="12" cy="12" r="1.5" fill={C.white} />
												<Circle cx="20" cy="12" r="1.5" fill={C.white} />
												<Path
													d="M12 17 Q16 20 20 17"
													stroke={C.white}
													strokeWidth="1.5"
													strokeLinecap="round"
													fill="none"
												/>
												<Path
													d="M6 26 Q16 32 26 26"
													stroke={C.primaryPurple}
													strokeWidth="2"
													strokeLinecap="round"
													fill="none"
													opacity="0.5"
												/>
											</Svg>
										</View>
										<View>
											<Text
												style={{
													fontWeight: "700",
													fontSize: 17,
													color: C.primaryPinkDark,
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
														alignSelf: "flex-start",
														marginTop: 2,
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
									</View>
									<Text style={{ fontSize: 13, color: C.mutedText }}>
										Born {formatDate(child.dob)}
									</Text>
									{weeks !== null && (
										<Text
											style={{
												fontSize: 12,
												color: C.mutedText,
												marginTop: 2,
											}}>
											{weeks} weeks old · {months} months
										</Text>
									)}
									{child.weaningStart && (
										<Text
											style={{
												fontSize: 11,
												color: C.mutedText,
												marginTop: 2,
											}}>
											Weaning from {formatDate(child.weaningStart)}
										</Text>
									)}
								</View>
								<View style={{ gap: 8 }}>
									{!isActive && (
										<TouchableOpacity
											onPress={() => onSetActive(child.id)}
											style={[
												s.btnPrimary,
												{
													width: "auto",
													paddingHorizontal: 14,
													paddingVertical: 8,
												},
											]}>
											<Text style={[s.btnPrimaryText, { fontSize: 12 }]}>
												Select
											</Text>
										</TouchableOpacity>
									)}
									<View style={{ flexDirection: "row", gap: 8 }}>
										<SecondaryBtn
											onPress={() => openEdit(child)}
											style={{ padding: 8 }}>
											<Icon name="edit" size={14} color={C.primaryPurple} />
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
											<Icon name="trash" size={14} color="#c0392b" />
										</DangerBtn>
									</View>
								</View>
							</View>
						</View>
					);
				})}
			</ScrollView>
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
								marginBottom: 22,
							}}>
							<Text style={s.modalTitle}>
								{editTarget ? "Edit Child" : "Add Child"}
							</Text>
							<TouchableOpacity
								onPress={() => setModalVisible(false)}
								style={{
									backgroundColor: C.bgPurple,
									borderRadius: 10,
									padding: 8,
								}}>
								<Icon name="close" size={16} color={C.mutedText} />
							</TouchableOpacity>
						</View>
						<ScrollView showsVerticalScrollIndicator={false}>
							<View style={{ gap: 16, paddingBottom: 20 }}>
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
								<DateField
									label="Date of Birth"
									value={form.dob}
									onChange={(v) => set("dob", v)}
									minYear={2018}
									maxYear={new Date().getFullYear()}
								/>
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
function RecipesScreen({
	isPro,
	recipes,
	favouriteRecipeIds,
	onUpgradePro,
	onToggleFav,
	onLogRecipe,
}) {
	const [expandedId, setExpandedId] = useState(null);
	const [filterAge, setFilterAge] = useState("all");
	const [upgradeLoading, setUpgradeLoading] = useState(false);
	const ageGroups = ["all", "4-6m+", "6m+", "7-9m+", "10m+"];
	let filtered =
		filterAge === "all"
			? recipes
			: filterAge === "saved"
				? recipes.filter((r) => favouriteRecipeIds.includes(r.id))
				: recipes.filter((r) => r.ageGroup === filterAge);
	const toggle = (id, locked) => {
		if (locked && !isPro) return;
		setExpandedId((prev) => (prev === id ? null : id));
	};
	return (
		<ScrollView
			showsVerticalScrollIndicator={false}
			contentContainerStyle={{ gap: 16, paddingBottom: 24 }}>
			{!isPro && (
				<View
					style={{
						backgroundColor: "#2d1f5e",
						borderRadius: 20,
						padding: 22,
						overflow: "hidden",
					}}>
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
								borderRadius: 12,
								width: 38,
								height: 38,
								alignItems: "center",
								justifyContent: "center",
							}}>
							<Icon name="crown" size={20} color={C.white} />
						</View>
						<Text style={{ fontWeight: "800", fontSize: 18, color: C.white }}>
							Munch Sprouts Pro
						</Text>
					</View>
					<View
						style={{
							flexDirection: "row",
							alignItems: "baseline",
							gap: 4,
							marginBottom: 14,
						}}>
						<Text style={{ fontSize: 34, fontWeight: "800", color: C.white }}>
							£4.99
						</Text>
						<Text style={{ fontSize: 14, color: "rgba(255,255,255,0.7)" }}>
							one-off
						</Text>
					</View>
					{[
						"Access to all BLW recipes",
						"Recipes for every age group",
						"Nutritionist-approved meal ideas",
						"New recipes added regularly",
						"More premium features coming soon",
					].map((f, i) => (
						<View
							key={i}
							style={{
								flexDirection: "row",
								alignItems: "center",
								gap: 8,
								marginBottom: 7,
							}}>
							<View
								style={{
									width: 20,
									height: 20,
									borderRadius: 10,
									backgroundColor: C.primaryGreen,
									alignItems: "center",
									justifyContent: "center",
									flexShrink: 0,
								}}>
								<Icon name="check" size={12} color={C.white} />
							</View>
							<Text
								style={{
									fontSize: 13,
									color: "rgba(255,255,255,0.9)",
									flex: 1,
								}}>
								{f}
							</Text>
						</View>
					))}
					<TouchableOpacity
						onPress={() => {
							setUpgradeLoading(true);
							onUpgradePro &&
								onUpgradePro().finally(() => setUpgradeLoading(false));
						}}
						disabled={upgradeLoading}
						style={{
							backgroundColor: C.warningStroke,
							borderRadius: 14,
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
									style={{ color: C.white, fontWeight: "700", fontSize: 15 }}>
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
						One-off · No subscription · Billed through{" "}
						{Platform.OS === "ios" ? "Apple" : "Google"} Play
					</Text>
				</View>
			)}
			{isPro && (
				<View
					style={{
						backgroundColor: C.bgGreen,
						borderRadius: 16,
						padding: 16,
						flexDirection: "row",
						alignItems: "center",
						gap: 12,
					}}>
					<Icon name="unlock" size={22} color={C.primaryGreen} />
					<Text style={{ fontWeight: "700", fontSize: 14, color: "#2e7d52" }}>
						Pro — All recipes unlocked
					</Text>
				</View>
			)}

			{/* Age filter */}
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}>
				{ageGroups.map((ag) => (
					<TouchableOpacity
						key={ag}
						onPress={() => setFilterAge(ag)}
						style={{
							backgroundColor: filterAge === ag ? C.primaryPurple : C.white,
							borderRadius: 999,
							paddingHorizontal: 16,
							paddingVertical: 8,
							shadowColor: "#000",
							shadowOpacity: 0.05,
							shadowRadius: 4,
							elevation: 1,
						}}>
						<Text
							style={{
								fontSize: 13,
								fontWeight: "700",
								color: filterAge === ag ? C.white : C.mutedText,
							}}>
							{ag === "all" ? "All Ages" : ag}
						</Text>
					</TouchableOpacity>
				))}

				{/* Saved pill */}
				<TouchableOpacity
					onPress={() => setFilterAge("saved")}
					style={{
						backgroundColor: filterAge === "saved" ? "#c49a10" : C.white,
						borderRadius: 999,
						paddingHorizontal: 14,
						paddingVertical: 8,
						flexDirection: "row",
						alignItems: "center",
						gap: 6,
						shadowColor: "#000",
						shadowOpacity: 0.05,
						shadowRadius: 4,
						elevation: 1,
					}}>
					<Icon
						name="starFill"
						size={12}
						color={filterAge === "saved" ? C.white : "#c49a10"}
					/>
					<Text
						style={{
							fontSize: 13,
							fontWeight: "700",
							color: filterAge === "saved" ? C.white : "#c49a10",
						}}>
						Saved
					</Text>
				</TouchableOpacity>
			</ScrollView>

			{filtered.map((r) => {
				const effectiveLocked = r.locked && !isPro;
				const isOpen = expandedId === r.id && !effectiveLocked;
				const catCfg =
					CATEGORIES.find((c) => c.value === r.category) || CATEGORIES[7];
				return (
					<View
						key={r.id}
						style={[
							s.card,
							{
								padding: 0,
								overflow: "hidden",
								borderWidth: isOpen ? 2 : 0,
								borderColor: C.primaryPurple,
								opacity: effectiveLocked ? 0.75 : 1,
							},
						]}>
						<TouchableOpacity
							onPress={() => toggle(r.id, r.locked)}
							style={{
								flexDirection: "row",
								gap: 16,
								alignItems: "center",
								padding: 18,
							}}
							activeOpacity={effectiveLocked ? 1 : 0.8}>
							<CategoryIcon category={r.category} size={52} />
							<View style={{ flex: 1 }}>
								<View
									style={{
										flexDirection: "row",
										alignItems: "center",
										gap: 8,
										marginBottom: 8,
									}}>
									<Text
										style={{
											fontWeight: "700",
											fontSize: 14,
											color: C.primaryPinkDark,
											flex: 1,
										}}>
										{r.title}
									</Text>
									{effectiveLocked ? (
										<View
											style={{
												backgroundColor: C.warningStroke,
												borderRadius: 999,
												paddingHorizontal: 8,
												paddingVertical: 3,
											}}>
											<Text
												style={{
													fontSize: 10,
													fontWeight: "700",
													color: C.white,
												}}>
												PRO
											</Text>
										</View>
									) : (
										<Icon
											name={isOpen ? "chevUp" : "chevDown"}
											size={16}
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
									borderTopWidth: 1,
									borderTopColor: C.borderLight,
									padding: 18,
								}}>
								{r.description ? (
									<Text
										style={{
											fontSize: 13,
											color: C.textCharcoal,
											marginBottom: 18,
											lineHeight: 20,
											fontStyle: "italic",
										}}>
										{r.description}
									</Text>
								) : null}
								<Text style={[s.sectionTitle, { marginBottom: 12 }]}>
									Ingredients
								</Text>
								{r.ingredients.map((ing, i) => (
									<View
										key={i}
										style={{
											flexDirection: "row",
											alignItems: "flex-start",
											gap: 12,
											backgroundColor: C.bgPurple,
											borderRadius: 12,
											padding: 12,
											marginBottom: 8,
										}}>
										<View
											style={{
												width: 8,
												height: 8,
												borderRadius: 4,
												backgroundColor: C.primaryPurple,
												marginTop: 5,
												flexShrink: 0,
											}}
										/>
										<Text
											style={{
												fontSize: 14,
												color: C.textCharcoal,
												fontWeight: "600",
												flex: 1,
											}}>
											{ing}
										</Text>
									</View>
								))}
								<Text
									style={[s.sectionTitle, { marginTop: 18, marginBottom: 12 }]}>
									Method
								</Text>
								{r.steps.map((step, i) => (
									<View
										key={i}
										style={{
											flexDirection: "row",
											alignItems: "flex-start",
											gap: 14,
											backgroundColor: i % 2 === 0 ? C.white : C.bgPurple,
											borderRadius: 12,
											padding: 12,
											marginBottom: 8,
										}}>
										<View
											style={{
												backgroundColor: C.primaryPurple,
												borderRadius: 12,
												width: 26,
												height: 26,
												alignItems: "center",
												justifyContent: "center",
												flexShrink: 0,
											}}>
											<Text
												style={{
													fontSize: 12,
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
												paddingTop: 3,
											}}>
											{step}
										</Text>
									</View>
								))}
								{/* Action buttons */}
								<View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
									<TouchableOpacity
										onPress={() => onToggleFav(r.id)}
										style={{
											flex: 1,
											flexDirection: "row",
											alignItems: "center",
											justifyContent: "center",
											gap: 8,
											backgroundColor: favouriteRecipeIds.includes(r.id)
												? "#fef6d4"
												: C.bgPurple,
											borderRadius: 12,
											paddingVertical: 12,
										}}
										activeOpacity={0.8}>
										<Icon
											name={
												favouriteRecipeIds.includes(r.id) ? "starFill" : "star"
											}
											size={16}
											color={
												favouriteRecipeIds.includes(r.id)
													? "#c49a10"
													: C.mutedText
											}
										/>
										<Text
											style={{
												fontWeight: "700",
												fontSize: 13,
												color: favouriteRecipeIds.includes(r.id)
													? "#c49a10"
													: C.mutedText,
											}}>
											{favouriteRecipeIds.includes(r.id) ? "Saved" : "Save"}
										</Text>
									</TouchableOpacity>

									<TouchableOpacity
										onPress={() => onLogRecipe(r)}
										style={{
											flex: 1,
											flexDirection: "row",
											alignItems: "center",
											justifyContent: "center",
											gap: 8,
											backgroundColor: C.primaryPurple,
											borderRadius: 12,
											paddingVertical: 12,
											shadowColor: C.primaryPurple,
											shadowOpacity: 0.3,
											shadowRadius: 6,
											elevation: 3,
										}}
										activeOpacity={0.8}>
										<Icon name="plus" size={16} color={C.white} />
										<Text
											style={{
												fontWeight: "700",
												fontSize: 13,
												color: C.white,
											}}>
											Log This
										</Text>
									</TouchableOpacity>
								</View>
							</View>
						)}
						{effectiveLocked && (
							<View
								style={{
									borderTopWidth: 1,
									borderTopColor: C.borderLight,
									padding: 12,
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

// ─── MORE SCREEN ──────────────────────────────────────────────────────────────
function MoreScreen({
	user,
	isPro,
	ownedChildren,
	defaultChildId,
	onLogout,
	onDeleteAccount,
	onUpgradePro,
	onRestorePurchases,
	onManageSharing,
}) {
	const [showChangePassword, setShowChangePassword] = useState(false);
	const [currentPw, setCurrentPw] = useState("");
	const [newPw, setNewPw] = useState("");
	const [confirmPw, setConfirmPw] = useState("");
	const [pwLoading, setPwLoading] = useState(false);
	const [upgradeLoading, setUpgradeLoading] = useState(false);
	const [showSharing, setShowSharing] = useState(false);
	const [shareEmail, setShareEmail] = useState("");
	const [shareLoading, setShareLoading] = useState(false);
	const [selectedChildId, setSelectedChildId] = useState(null);

	const handleChangePassword = async () => {
		if (!currentPw || !newPw || !confirmPw) {
			Alert.alert("Missing Fields", "Please fill in all fields.");
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
				"auth/invalid-credential": "Current password is incorrect.",
				"auth/too-many-requests": "Too many attempts. Try again later.",
			};
			Alert.alert("Error", msgs[e.code] || e.message);
		}
		setPwLoading(false);
	};

	const MoreRow = ({
		icon,
		iconBg,
		label,
		sublabel,
		onPress,
		color,
		right,
	}) => (
		<TouchableOpacity
			onPress={onPress}
			style={{
				flexDirection: "row",
				alignItems: "center",
				gap: 14,
				padding: 16,
				backgroundColor: C.white,
				borderRadius: 16,
				marginBottom: 10,
				shadowColor: "#000",
				shadowOpacity: 0.04,
				shadowRadius: 6,
				elevation: 1,
			}}
			activeOpacity={0.8}>
			<View
				style={{
					width: 42,
					height: 42,
					borderRadius: 13,
					backgroundColor: iconBg || C.bgPurple,
					alignItems: "center",
					justifyContent: "center",
				}}>
				<Icon name={icon} size={20} color={color || C.primaryPurple} />
			</View>
			<View style={{ flex: 1 }}>
				<Text
					style={{
						fontWeight: "700",
						fontSize: 15,
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
			{right !== undefined ? (
				right
			) : (
				<Icon name="chevRight" size={16} color={C.mutedText} />
			)}
		</TouchableOpacity>
	);

	return (
		<ScrollView
			showsVerticalScrollIndicator={false}
			contentContainerStyle={{ paddingBottom: 30 }}>
			{/* Account card */}
			<View
				style={[
					s.card,
					{
						marginBottom: 20,
						flexDirection: "row",
						alignItems: "center",
						gap: 14,
					},
				]}>
				<View
					style={{
						width: 52,
						height: 52,
						borderRadius: 26,
						backgroundColor: C.primaryPurple,
						alignItems: "center",
						justifyContent: "center",
					}}>
					<Icon name="user" size={24} color={C.white} />
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
					<View style={{ marginTop: 4 }}>
						{isPro ? (
							<View
								style={{
									backgroundColor: C.statGreenBg,
									borderRadius: 999,
									paddingHorizontal: 10,
									paddingVertical: 3,
									alignSelf: "flex-start",
								}}>
								<Text
									style={{
										fontSize: 11,
										fontWeight: "700",
										color: C.statGreenText,
									}}>
									PRO ACCOUNT
								</Text>
							</View>
						) : (
							<View
								style={{
									backgroundColor: C.bgPurple,
									borderRadius: 999,
									paddingHorizontal: 10,
									paddingVertical: 3,
									alignSelf: "flex-start",
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

			{/* Upgrade card — free only */}
			{!isPro && (
				<View
					style={{
						backgroundColor: "#2d1f5e",
						borderRadius: 20,
						padding: 20,
						marginBottom: 20,
						overflow: "hidden",
					}}>
					<View
						style={{
							position: "absolute",
							top: -20,
							right: -20,
							width: 100,
							height: 100,
							borderRadius: 50,
							backgroundColor: "rgba(155,127,232,0.2)",
						}}
					/>
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: 10,
							marginBottom: 10,
						}}>
						<View
							style={{
								backgroundColor: C.warningStroke,
								borderRadius: 10,
								width: 34,
								height: 34,
								alignItems: "center",
								justifyContent: "center",
							}}>
							<Icon name="crown" size={17} color={C.white} />
						</View>
						<Text style={{ fontWeight: "800", fontSize: 16, color: C.white }}>
							Upgrade to Pro · £4.99
						</Text>
					</View>
					<Text
						style={{
							fontSize: 13,
							color: "rgba(255,255,255,0.8)",
							marginBottom: 14,
							lineHeight: 20,
						}}>
						Unlock all BLW recipes, age-group filters, nutritionist-approved
						meal ideas, and more features coming soon.
					</Text>
					<TouchableOpacity
						onPress={() => {
							setUpgradeLoading(true);
							onUpgradePro &&
								onUpgradePro().finally(() => setUpgradeLoading(false));
						}}
						disabled={upgradeLoading}
						style={{
							backgroundColor: C.warningStroke,
							borderRadius: 12,
							paddingVertical: 12,
							alignItems: "center",
							justifyContent: "center",
							flexDirection: "row",
							gap: 8,
							opacity: upgradeLoading ? 0.7 : 1,
						}}
						activeOpacity={0.85}>
						{upgradeLoading ? (
							<ActivityIndicator color={C.white} />
						) : (
							<>
								<Icon name="crown" size={15} color={C.white} />
								<Text
									style={{ color: C.white, fontWeight: "700", fontSize: 14 }}>
									Upgrade for £4.99
								</Text>
							</>
						)}
					</TouchableOpacity>
					{!isPro && (
						<TouchableOpacity
							onPress={onRestorePurchases}
							style={{ alignItems: "center", paddingTop: 10 }}>
							<Text
								style={{
									fontSize: 12,
									color: "rgba(255,255,255,0.6)",
									fontWeight: "600",
								}}>
								Restore previous purchase
							</Text>
						</TouchableOpacity>
					)}
				</View>
			)}

			<Text style={[s.smallLabel, { paddingLeft: 4, marginBottom: 10 }]}>
				Account
			</Text>
			<MoreRow
				icon="key"
				iconBg="#e8f0ff"
				label="Change Password"
				sublabel="Update your account password"
				onPress={() => setShowChangePassword(true)}
			/>
			<MoreRow
				icon="logout"
				iconBg="#fff0f0"
				label="Sign Out"
				sublabel="Sign out of your account"
				color="#c0392b"
				onPress={onLogout}
				right={<View />}
			/>

			{/* ── Family Sharing ── */}
			<Text
				style={[
					s.smallLabel,
					{ paddingLeft: 4, marginBottom: 10, marginTop: 10 },
				]}>
				Family Sharing
			</Text>
			{isPro ? (
				<TouchableOpacity
					onPress={() => setShowSharing(true)}
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: 14,
						padding: 16,
						backgroundColor: C.white,
						borderRadius: 16,
						marginBottom: 10,
						shadowColor: "#000",
						shadowOpacity: 0.04,
						shadowRadius: 6,
						elevation: 1,
					}}
					activeOpacity={0.8}>
					<View
						style={{
							width: 42,
							height: 42,
							borderRadius: 13,
							backgroundColor: "#e8f5ff",
							alignItems: "center",
							justifyContent: "center",
						}}>
						<Icon name="users" size={20} color="#2a5f8f" />
					</View>
					<View style={{ flex: 1 }}>
						<Text
							style={{
								fontWeight: "700",
								fontSize: 15,
								color: C.textCharcoal,
							}}>
							Share with Family
						</Text>
						<Text style={{ fontSize: 12, color: C.mutedText, marginTop: 2 }}>
							Invite a partner or caregiver by email
						</Text>
					</View>
					<Icon name="chevRight" size={16} color={C.mutedText} />
				</TouchableOpacity>
			) : (
				<TouchableOpacity
					onPress={onUpgradePro}
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: 14,
						padding: 16,
						backgroundColor: C.white,
						borderRadius: 16,
						marginBottom: 10,
						opacity: 0.7,
						shadowColor: "#000",
						shadowOpacity: 0.04,
						shadowRadius: 6,
						elevation: 1,
					}}
					activeOpacity={0.8}>
					<View
						style={{
							width: 42,
							height: 42,
							borderRadius: 13,
							backgroundColor: C.bgPurple,
							alignItems: "center",
							justifyContent: "center",
						}}>
						<Icon name="lock" size={20} color={C.mutedText} />
					</View>
					<View style={{ flex: 1 }}>
						<Text
							style={{ fontWeight: "700", fontSize: 15, color: C.mutedText }}>
							Share with Family
						</Text>
						<Text style={{ fontSize: 12, color: C.mutedText, marginTop: 2 }}>
							Pro feature — upgrade to unlock
						</Text>
					</View>
					<View
						style={{
							backgroundColor: C.warningStroke,
							borderRadius: 999,
							paddingHorizontal: 8,
							paddingVertical: 3,
						}}>
						<Text style={{ fontSize: 10, fontWeight: "700", color: C.white }}>
							PRO
						</Text>
					</View>
				</TouchableOpacity>
			)}

			{/* ── Family Sharing Modal ── */}
			<Modal
				visible={showSharing}
				transparent
				animationType="slide"
				onRequestClose={() => setShowSharing(false)}>
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
							<Text style={s.modalTitle}>Share with Family</Text>
							<TouchableOpacity
								onPress={() => {
									setShowSharing(false);
									setShareEmail("");
									setSelectedChildId(null);
								}}
								style={{
									backgroundColor: C.bgPurple,
									borderRadius: 10,
									padding: 8,
								}}>
								<Icon name="close" size={16} color={C.mutedText} />
							</TouchableOpacity>
						</View>

						{/* Step 1 — Pick a child if more than one */}
						{ownedChildren.filter(
							(c) => c.isOwner !== false && c.isOwner !== undefined,
						).length > 1 && (
							<View style={{ marginBottom: 16 }}>
								<Text style={s.label}>Select Child to Share</Text>
								{ownedChildren
									.filter((c) => c.isOwner !== false && c.isOwner !== undefined)
									.map((c) => (
										<TouchableOpacity
											key={c.id}
											onPress={() => setSelectedChildId(c.id)}
											style={{
												flexDirection: "row",
												alignItems: "center",
												gap: 10,
												padding: 12,
												backgroundColor:
													selectedChildId === c.id ? C.bgPurple : C.white,
												borderRadius: 12,
												borderWidth: 2,
												borderColor:
													selectedChildId === c.id
														? C.primaryPurple
														: C.borderLight,
												marginBottom: 8,
											}}>
											<Icon
												name="baby"
												size={16}
												color={
													selectedChildId === c.id
														? C.primaryPurple
														: C.mutedText
												}
											/>
											<Text
												style={{
													fontWeight: "700",
													fontSize: 14,
													color:
														selectedChildId === c.id
															? C.primaryPurple
															: C.textCharcoal,
												}}>
												{c.name}
											</Text>
											{selectedChildId === c.id && (
												<Icon name="check" size={14} color={C.primaryPurple} />
											)}
										</TouchableOpacity>
									))}
							</View>
						)}

						{/* Info box */}
						<View
							style={{
								backgroundColor: C.bgPurple,
								borderRadius: 12,
								padding: 14,
								marginBottom: 16,
							}}>
							<Text
								style={{
									fontSize: 13,
									color: C.primaryPinkDark,
									lineHeight: 20,
								}}>
								Enter the email address of the person you want to share with.
								They must already have a Munch Sprouts account. They will be
								able to view and add food log entries for the selected child.
							</Text>
						</View>

						{/* Email input */}
						<View style={{ marginBottom: 16 }}>
							<Text style={s.label}>Their Email Address</Text>
							<TextInput
								value={shareEmail}
								onChangeText={setShareEmail}
								placeholder="partner@example.com"
								keyboardType="email-address"
								autoCapitalize="none"
								autoCorrect={false}
								style={[s.input, { backgroundColor: C.white }]}
								placeholderTextColor={C.mutedText}
							/>
						</View>

						{/* Share button */}
						<TouchableOpacity
							onPress={() =>
								onManageSharing(
									shareEmail.trim(),
									selectedChildId || defaultChildId,
									() => {
										setShowSharing(false);
										setShareEmail("");
										setSelectedChildId(null);
									},
								)
							}
							disabled={shareLoading || !shareEmail.trim()}
							style={[
								s.btnPrimary,
								(shareLoading || !shareEmail.trim()) && { opacity: 0.5 },
							]}
							activeOpacity={0.8}>
							{shareLoading ? (
								<ActivityIndicator color={C.white} />
							) : (
								<Text style={s.btnPrimaryText}>Send Invite</Text>
							)}
						</TouchableOpacity>

						{/* Family Group */}
						{(() => {
							const targetChild = ownedChildren.find(
								(c) => c.id === (selectedChildId || defaultChildId),
							);
							if (!targetChild) return null;
							const isOwner = targetChild.isOwner !== false;
							const sharedWith = targetChild?.sharedWith || [];
							const sharedWithEmails = (
								targetChild?.sharedWithEmails || []
							).slice(0, sharedWith.length);

							// Owner sees: people shared with, with Remove button
							// Shared user sees: owner + other shared users (read only)
							const familyRows = isOwner
								? sharedWith.map((uid, i) => ({
										uid,
										email: sharedWithEmails[i] || uid,
										role: "Shared with",
										canRemove: true,
									}))
								: [
										{
											uid: targetChild.userId,
											email: targetChild.ownerEmail || "Account owner",
											role: "Owner",
											canRemove: false,
										},
										...sharedWith
											.filter((uid) => uid !== user.uid)
											.map((uid, i) => ({
												uid,
												email: sharedWithEmails[sharedWith.indexOf(uid)] || uid,
												role: "Also shared with",
												canRemove: false,
											})),
									];

							if (familyRows.length === 0) return null;

							return (
								<View style={{ marginTop: 20 }}>
									<Text style={[s.smallLabel, { marginBottom: 10 }]}>
										Family Group
									</Text>
									{familyRows.map((row) => (
										<View
											key={row.uid}
											style={{
												flexDirection: "row",
												alignItems: "center",
												justifyContent: "space-between",
												padding: 12,
												backgroundColor:
													row.role === "Owner" ? C.bgPurple : C.bgGreen,
												borderRadius: 12,
												marginBottom: 6,
											}}>
											<View
												style={{
													flexDirection: "row",
													alignItems: "center",
													gap: 10,
													flex: 1,
												}}>
												<Icon
													name={row.role === "Owner" ? "crown" : "user"}
													size={16}
													color={
														row.role === "Owner"
															? C.primaryPurple
															: C.primaryGreen
													}
												/>
												<View style={{ flex: 1 }}>
													<Text
														style={{
															fontSize: 10,
															fontWeight: "700",
															color: C.mutedText,
															textTransform: "uppercase",
															letterSpacing: 0.5,
														}}>
														{row.role}
													</Text>
													<Text
														style={{
															fontSize: 13,
															fontWeight: "700",
															color:
																row.role === "Owner"
																	? C.primaryPurple
																	: C.statGreenText,
														}}
														numberOfLines={1}>
														{row.email}
													</Text>
												</View>
											</View>
											{row.canRemove && (
												<TouchableOpacity
													onPress={() =>
														onManageSharing(
															row.uid,
															selectedChildId || defaultChildId,
															null,
															true,
														)
													}>
													<Text
														style={{
															fontSize: 12,
															color: "#c0392b",
															fontWeight: "700",
														}}>
														Remove
													</Text>
												</TouchableOpacity>
											)}
										</View>
									))}
								</View>
							);
						})()}
					</View>
				</KeyboardAvoidingView>
			</Modal>

			<Text
				style={[
					s.smallLabel,
					{ paddingLeft: 4, marginBottom: 10, marginTop: 10 },
				]}>
				Danger Zone
			</Text>
			<MoreRow
				icon="trash"
				iconBg="#fff0f0"
				label="Delete Account"
				sublabel="Permanently delete account and all data"
				color="#c0392b"
				onPress={() => {
					Alert.alert(
						"Delete Account",
						"This will permanently delete your account, all children, and all food log data. This cannot be undone.",
						[
							{ text: "Cancel", style: "cancel" },
							{
								text: "Yes, Delete Everything",
								style: "destructive",
								onPress: () =>
									Alert.alert(
										"Final Confirmation",
										"Last chance — this cannot be reversed.",
										[
											{ text: "Cancel", style: "cancel" },
											{
												text: "Delete My Account",
												style: "destructive",
												onPress: onDeleteAccount,
											},
										],
									),
							},
						],
					);
				}}
				right={<View />}
			/>

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
								marginBottom: 22,
							}}>
							<Text style={s.modalTitle}>Change Password</Text>
							<TouchableOpacity
								onPress={() => setShowChangePassword(false)}
								style={{
									backgroundColor: C.bgPurple,
									borderRadius: 10,
									padding: 8,
								}}>
								<Icon name="close" size={16} color={C.mutedText} />
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

// ─── LOG RECIPE MODAL ─────────────────────────────────────────────────────────
function LogRecipeModal({ visible, recipe, childName, onConfirm, onClose }) {
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
					{/* Header */}
					<View
						style={{
							flexDirection: "row",
							justifyContent: "space-between",
							alignItems: "center",
							marginBottom: 20,
						}}>
						<View style={{ flex: 1, marginRight: 12 }}>
							<Text style={s.modalTitle}>Log Recipe</Text>
							<Text
								style={{ fontSize: 13, color: C.mutedText, marginTop: 3 }}
								numberOfLines={1}>
								{recipe.title}
								{childName ? ` for ${childName}` : ""}
							</Text>
						</View>
						<TouchableOpacity
							onPress={() => {
								reset();
								onClose();
							}}
							style={{
								backgroundColor: C.bgPurple,
								borderRadius: 10,
								padding: 8,
							}}>
							<Icon name="close" size={16} color={C.mutedText} />
						</TouchableOpacity>
					</View>

					{/* Recipe info chip */}
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: 10,
							backgroundColor: C.bgPurple,
							borderRadius: 14,
							padding: 14,
							marginBottom: 20,
						}}>
						<CategoryIcon category={recipe.category} size={44} />
						<View style={{ flex: 1 }}>
							<Text
								style={{
									fontWeight: "700",
									fontSize: 14,
									color: C.primaryPinkDark,
								}}>
								{recipe.title}
							</Text>
							<View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
								<View style={s.tagPurple}>
									<Text style={s.tagPurpleText}>{recipe.category}</Text>
								</View>
								<View style={s.tagGreen}>
									<Text style={s.tagGreenText}>{recipe.ageGroup}</Text>
								</View>
							</View>
						</View>
					</View>

					{/* Reaction picker */}
					<Text style={[s.label, { marginBottom: 10 }]}>
						How did they react?
					</Text>
					<View
						style={{
							flexDirection: "row",
							flexWrap: "wrap",
							gap: 8,
							marginBottom: 18,
						}}>
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
									<Text
										style={{
											fontWeight: "700",
											fontSize: 10,
											color: sel ? r.color : C.mutedText,
											textAlign: "center",
										}}>
										{r.value}
									</Text>
								</TouchableOpacity>
							);
						})}
					</View>

					{/* Notes */}
					<Text style={[s.label, { marginBottom: 6 }]}>Notes (optional)</Text>
					<TextInput
						value={notes}
						onChangeText={setNotes}
						placeholder="How did it go? Any observations..."
						multiline
						numberOfLines={3}
						style={[
							s.input,
							{
								height: 80,
								textAlignVertical: "top",
								backgroundColor: C.white,
								marginBottom: 18,
							},
						]}
						placeholderTextColor={C.mutedText}
						autoComplete="off"
					/>

					{/* Add button */}
					<TouchableOpacity
						onPress={() => {
							onConfirm(selectedReaction, notes);
							reset();
						}}
						style={s.btnPrimary}
						activeOpacity={0.8}>
						<View
							style={{
								flexDirection: "row",
								alignItems: "center",
								gap: 8,
								justifyContent: "center",
							}}>
							<Icon name="plus" size={16} color={C.white} />
							<Text style={s.btnPrimaryText}>Add to Food Log</Text>
						</View>
					</TouchableOpacity>
				</View>
			</KeyboardAvoidingView>
		</Modal>
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
							marginBottom: 22,
						}}>
						<Text style={s.modalTitle}>Edit Entry</Text>
						<TouchableOpacity
							onPress={onClose}
							style={{
								backgroundColor: C.bgPurple,
								borderRadius: 10,
								padding: 8,
							}}>
							<Icon name="close" size={16} color={C.mutedText} />
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
	const [showChildPicker, setShowChildPicker] = useState(false);
	const [showLogRecipeModal, setShowLogRecipeModal] = useState(false);
	const [logRecipeTarget, setLogRecipeTarget] = useState(null);
	const insets = useSafeAreaInsets();
	const [recipes, setRecipes] = useState([]);
	const [favouriteRecipeIds, setFavouriteRecipeIds] = useState([]);

	useEffect(() => {
		if (!user) return;
		Promise.all([
			fetchFoodLog(user.uid),
			fetchChildren(user.uid),
			fetchRecipes(),
			fetchFavouriteRecipes(user.uid),
		])
			.then(([log, kids, recs, favIds]) => {
				setFoodLog(log);
				setChildren(kids);
				setRecipes(recs);
				setFavouriteRecipeIds(favIds);
				if (kids.length > 0) setActiveChildId(kids[0].id);
				setDataLoaded(true);
			})
			.catch((err) => {
				console.error("Error loading data:", err);
				setDataLoaded(true);
			});
	}, [user]);

	const handleToggleRecipeFav = async (recipeId) => {
		const isFav = favouriteRecipeIds.includes(recipeId);
		// Optimistically update UI immediately
		setFavouriteRecipeIds((prev) =>
			isFav ? prev.filter((id) => id !== recipeId) : [...prev, recipeId],
		);
		try {
			await toggleRecipeFavourite(user.uid, recipeId, isFav);
		} catch (e) {
			// Revert on failure
			setFavouriteRecipeIds((prev) =>
				isFav ? [...prev, recipeId] : prev.filter((id) => id !== recipeId),
			);
			console.error("toggleRecipeFavourite error:", e.code, e.message);
			Alert.alert("Error", e.message || "Could not update favourite.");
		}
	};

	const handleLogRecipe = (recipe) => {
		if (!activeChild) {
			Alert.alert("No child selected", "Please select a child first.");
			return;
		}
		setLogRecipeTarget(recipe);
		setShowLogRecipeModal(true);
	};

	const handleLogRecipeConfirm = async (reaction, notes) => {
		if (!logRecipeTarget || !activeChild) return;
		// Map recipe category to food log category
		const categoryMap = {
			Breakfast: "Grains",
			"Finger Foods": "Other",
			Mains: "Proteins",
			Snacks: "Fruits",
			Lunch: "Vegetables",
			Dinner: "Proteins",
			Desserts: "Fruits",
		};
		const existing = childLog.filter(
			(f) => normalize(f.name) === normalize(logRecipeTarget.title),
		);
		const today = new Date().toISOString().split("T")[0];
		const entry = {
			childId: activeChild.id,
			date: today,
			name: logRecipeTarget.title,
			category:
				categoryMap[logRecipeTarget.category] ||
				logRecipeTarget.category ||
				"Other",
			form: "Mixed Texture",
			reaction: reaction || "",
			notes: notes || "",
			favourite: false,
			attemptNum: existing.length + 1,
		};
		try {
			const newId = await addFoodEntry(user.uid, entry);
			setFoodLog((p) => [...p, { id: newId, ...entry }]);
			setShowLogRecipeModal(false);
			setLogRecipeTarget(null);
			toast(`"${logRecipeTarget.title}" added to food log`);
			setPage("log");
		} catch (e) {
			Alert.alert("Error", "Could not add to food log.");
		}
	};

	// RevenueCat init
	useEffect(() => {
		if (!user) return;
		Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
		const apiKey =
			Platform.OS === "ios"
				? "appl_xNGjmEgufsXuWySnKebRetuKCGj"
				: "goog_rcHUTFIPkKdXdEAQHcexulBdpOj";
		Purchases.configure({ apiKey, appUserID: user.uid });
	}, [user]);

	// Derived state — must be defined before any handlers or JSX that reference them
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
		const existing = childLog.filter(
			(f) => normalize(f.name) === normalize(form.name),
		);
		const entry = {
			childId: activeChild?.id || null,
			attemptNum: existing.length + 1,
			...form,
		};
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
			Alert.alert("Error", "Could not save entry.");
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
		} catch (e) {
			console.warn("deleteChild error:", e.message);
		} finally {
			setChildren((p) => p.filter((c) => c.id !== id));
			setFoodLog((p) => p.filter((f) => f.childId !== id));
			if (activeChildId === id) {
				const remaining = children.filter((c) => c.id !== id);
				setActiveChildId(remaining.length > 0 ? remaining[0].id : null);
			}
			toast("Child removed");
		}
	};
	// ── Family Sharing ──
	const handleManageSharing = async (
		emailOrUid,
		childId,
		onSuccess,
		isRemove = false,
	) => {
		if (!childId) {
			Alert.alert("No child selected", "Please select a child to share.");
			return;
		}

		try {
			const {
				doc,
				updateDoc,
				arrayUnion,
				arrayRemove,
				collection,
				query,
				where,
				getDocs: fsGetDocs,
			} = await import("firebase/firestore");
			const { db: firedb } = await import("./firebase");

			if (isRemove) {
				// Remove user from sharedWith
				// emailOrUid is the UID when removing
				await updateDoc(doc(firedb, "children", childId), {
					sharedWith: arrayRemove(emailOrUid),
				});

				// Also find and remove the matching email
				const child = children.find((c) => c.id === childId);
				const uidIndex = (child?.sharedWith || []).indexOf(emailOrUid);
				const matchingEmail =
					uidIndex !== -1 ? (child?.sharedWithEmails || [])[uidIndex] : null;

				if (matchingEmail) {
					await updateDoc(doc(firedb, "children", childId), {
						sharedWithEmails: arrayRemove(matchingEmail),
					});
				}

				setChildren((prev) =>
					prev.map((c) =>
						c.id === childId
							? {
									...c,
									sharedWith: (c.sharedWith || []).filter(
										(u) => u !== emailOrUid,
									),
									sharedWithEmails: matchingEmail
										? (c.sharedWithEmails || []).filter(
												(e) => e !== matchingEmail,
											)
										: c.sharedWithEmails || [],
								}
							: c,
					),
				);
				Alert.alert("Removed", "Access has been removed.");
				return;
			}

			// Look up user by email in Firestore users collection
			const usersQuery = query(
				collection(firedb, "users"),
				where("email", "==", emailOrUid.toLowerCase().trim()),
			);
			const snap = await fsGetDocs(usersQuery);

			if (snap.empty) {
				Alert.alert(
					"Account not found",
					`No Munch Sprouts account found for ${emailOrUid}. They need to create an account first.`,
				);
				return;
			}

			const theirUid = snap.docs[0].id;

			if (theirUid === user.uid) {
				Alert.alert("That's you", "You can't share a child with yourself.");
				return;
			}

			// Check not already shared
			const child = children.find((c) => c.id === childId);
			if (child?.sharedWith?.includes(theirUid)) {
				Alert.alert(
					"Already shared",
					`${emailOrUid} already has access to ${child.name}.`,
				);
				return;
			}

			// Add their UID to sharedWith array
			const theirEmail = emailOrUid.toLowerCase().trim();

			await updateDoc(doc(firedb, "children", childId), {
				sharedWith: arrayUnion(theirUid),
				sharedWithEmails: arrayUnion(theirEmail),
			});

			// Update local children state
			setChildren((prev) =>
				prev.map((c) =>
					c.id === childId
						? {
								...c,
								sharedWith: [...(c.sharedWith || []), theirUid],
								sharedWithEmails: [...(c.sharedWithEmails || []), theirEmail],
							}
						: c,
				),
			);

			const childName = child?.name || "your child";
			Alert.alert(
				"Shared! ✓",
				`${emailOrUid} now has access to ${childName}. They will see the data next time they open the app.`,
			);
			if (onSuccess) onSuccess();
		} catch (e) {
			console.error("Sharing error:", e);
			Alert.alert(
				"Error",
				e.message || "Could not update sharing. Please try again.",
			);
		}
	};

	const handleLogout = () =>
		Alert.alert("Sign Out", "Are you sure?", [
			{ text: "Cancel" },
			{ text: "Sign Out", style: "destructive", onPress: () => logOut() },
		]);
	const handleDeleteAccount = async () => {
		try {
			await deleteAccount(user.uid);
		} catch (e) {
			if (e.code === "auth/requires-recent-login") {
				Alert.alert(
					"Please sign in again",
					"Sign out and back in before deleting your account.",
				);
			} else {
				Alert.alert("Error", e.message || "Could not delete account.");
			}
		}
	};
	const handleUpgradePro = async () => {
		try {
			const offerings = await Purchases.getOfferings();
			if (
				!offerings.current ||
				offerings.current.availablePackages.length === 0
			) {
				Alert.alert(
					"Not available",
					"Purchase not available right now. Make sure you have set up a product in App Store Connect and linked it in RevenueCat.",
				);
				return;
			}
			const proPackage = offerings.current.availablePackages[0];
			const { customerInfo } = await Purchases.purchasePackage(proPackage);
			if (customerInfo.entitlements.active["pro"]) {
				const { doc, updateDoc } = await import("firebase/firestore");
				const { db: firedb } = await import("./firebase");
				await updateDoc(doc(firedb, "users", user.uid), { plan: "pro" });
				Alert.alert(
					"Welcome to Pro! 🎉",
					"You now have access to all recipes and premium features.",
				);
			}
		} catch (e) {
			if (e.userCancelled) return;
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
				const { db: firedb } = await import("./firebase");
				await updateDoc(doc(firedb, "users", user.uid), { plan: "pro" });
				Alert.alert("Restored ✓", "Your Pro purchase has been restored.");
			} else {
				Alert.alert(
					"Nothing to restore",
					"No previous Pro purchase found on this Apple/Google account.",
				);
			}
		} catch (e) {
			Alert.alert("Error", e.message || "Could not restore purchases.");
		}
	};

	if (!dataLoaded) return <LoadingScreen />;

	// ── New nav: no Children, no Settings — those live in header + More ──
	const nav = [
		{ id: "dashboard", icon: "home", label: "Home" },
		{ id: "log", icon: "list", label: "Foods" },
		{ id: "add", icon: "plus", label: "Add" },
		{ id: "recipes", icon: "chef", label: "Recipes" },
		{ id: "more", icon: "more", label: "More" },
	];
	const titles = {
		dashboard: "Dashboard",
		log: "Food Log",
		add: "Log Food",
		recipes: "Recipes",
		more: "More",
		children: "Children",
	};

	return (
		<SafeAreaView
			style={{ flex: 1, backgroundColor: "#f4f0fc" }}
			edges={["top"]}>
			<StatusBar barStyle="dark-content" backgroundColor={C.white} />

			{/* ── Header ── */}
			<View style={s.header}>
				<View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
					<Image
						source={require("./assets/logo.png")}
						style={{ width: 36, height: 36, borderRadius: 10 }}
						resizeMode="contain"
					/>
					<View>
						<Text style={s.appName}>Munch Sprouts</Text>
						<Text style={s.pageSubtitle}>{titles[page] || "Dashboard"}</Text>
					</View>
				</View>

				{/* Right side: child switcher chip + add child */}
				<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
					{/* Child selector — tapping shows picker */}
					<TouchableOpacity
						onPress={() => setShowChildPicker(true)}
						style={{
							backgroundColor: C.bgPurple,
							borderRadius: 999,
							paddingHorizontal: 14,
							paddingVertical: 7,
							flexDirection: "row",
							alignItems: "center",
							gap: 6,
						}}>
						<Svg width={16} height={16} viewBox="0 0 32 32">
							<Circle
								cx="16"
								cy="13"
								r="7"
								fill={C.primaryPurple}
								opacity="0.8"
							/>
							<Circle cx="11" cy="12" r="1.5" fill={C.white} />
							<Circle cx="21" cy="12" r="1.5" fill={C.white} />
							<Path
								d="M11 16.5 Q16 19.5 21 16.5"
								stroke={C.white}
								strokeWidth="1.5"
								strokeLinecap="round"
								fill="none"
							/>
						</Svg>
						<Text
							style={{
								fontSize: 13,
								fontWeight: "700",
								color: C.primaryPurple,
							}}
							numberOfLines={1}>
							{activeChild ? activeChild.name : "Add Baby"}
						</Text>
						<Icon name="chevDown" size={12} color={C.primaryPurple} />
					</TouchableOpacity>
				</View>
			</View>

			{/* ── Child picker modal ── */}
			<Modal
				visible={showChildPicker}
				transparent
				animationType="slide"
				onRequestClose={() => setShowChildPicker(false)}>
				<TouchableOpacity
					style={s.pickerOverlay}
					onPress={() => setShowChildPicker(false)}
					activeOpacity={1}>
					<View
						style={[s.pickerSheet, { maxHeight: "70%" }]}
						onStartShouldSetResponder={() => true}>
						<Text style={s.pickerTitle}>Select Child</Text>
						<ScrollView>
							{children.map((c) => (
								<TouchableOpacity
									key={c.id}
									onPress={() => {
										setActiveChildId(c.id);
										setShowChildPicker(false);
									}}
									style={[
										s.pickerItem,
										c.id === activeChildId && { backgroundColor: C.bgPurple },
									]}>
									<View
										style={{
											flexDirection: "row",
											alignItems: "center",
											gap: 12,
										}}>
										<View
											style={{
												width: 36,
												height: 36,
												borderRadius: 18,
												backgroundColor: C.primaryPurple + "22",
												alignItems: "center",
												justifyContent: "center",
											}}>
											<Icon name="baby" size={18} color={C.primaryPurple} />
										</View>
										<View>
											<Text
												style={[
													s.pickerItemText,
													c.id === activeChildId && {
														color: C.primaryPurple,
														fontWeight: "700",
													},
												]}>
												{c.name}
											</Text>
											<Text style={{ fontSize: 11, color: C.mutedText }}>
												{calcAgeWeeks(c.dob)} weeks · {calcAgeMonths(c.dob)}{" "}
												months
											</Text>
										</View>
									</View>
									{c.id === activeChildId && (
										<Icon name="check" size={16} color={C.primaryPurple} />
									)}
								</TouchableOpacity>
							))}
						</ScrollView>
						<TouchableOpacity
							onPress={() => {
								setShowChildPicker(false);
								setPage("children");
							}}
							style={[s.btnPrimary, { marginTop: 12 }]}>
							<View
								style={{
									flexDirection: "row",
									alignItems: "center",
									gap: 8,
									justifyContent: "center",
								}}>
								<Icon name="plus" size={14} color={C.white} />
								<Text style={s.btnPrimaryText}>Manage Children</Text>
							</View>
						</TouchableOpacity>
					</View>
				</TouchableOpacity>
			</Modal>

			{/* ── Page content ── */}
			<View
				style={{
					flex: 1,
					paddingHorizontal: 16,
					paddingTop: 16,
					backgroundColor: "#f6f3fe",
				}}>
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
							<Text style={[s.pageTitle, { marginBottom: 20 }]}>
								Log Food or Drink
							</Text>
							<View style={s.card}>
								<FoodForm onSubmit={addFood} />
							</View>
						</ScrollView>
					</KeyboardAvoidingView>
				)}
				{page === "recipes" && (
					<RecipesScreen
						isPro={isPro}
						recipes={recipes}
						favouriteRecipeIds={favouriteRecipeIds}
						onUpgradePro={handleUpgradePro}
						onToggleFav={handleToggleRecipeFav}
						onLogRecipe={handleLogRecipe}
					/>
				)}
				{page === "more" && (
					<MoreScreen
						user={user}
						isPro={isPro}
						ownedChildren={children}
						defaultChildId={activeChild?.id || null}
						onLogout={handleLogout}
						onDeleteAccount={handleDeleteAccount}
						onUpgradePro={handleUpgradePro}
						onRestorePurchases={handleRestorePurchases}
						onManageSharing={handleManageSharing}
					/>
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
			</View>

			{/* ── Bottom Nav ── */}
			<View
				style={[
					s.bottomNav,
					{ paddingBottom: insets.bottom > 0 ? insets.bottom : 10 },
				]}>
				{nav.map((n) => {
					const active =
						page === n.id ||
						(n.id === "more" && page === "settings") ||
						(n.id === "more" && page === "children");
					const isAdd = n.id === "add";
					return (
						<TouchableOpacity
							key={n.id}
							onPress={() => setPage(n.id)}
							style={s.navItem}
							activeOpacity={0.8}>
							{isAdd ? (
								<View style={s.navAddBtn}>
									<Icon name="plus" size={26} color={C.white} />
								</View>
							) : (
								<>
									<View
										style={{
											width: 28,
											height: 28,
											borderRadius: 10,
											backgroundColor: active
												? C.primaryPurple + "18"
												: "transparent",
											alignItems: "center",
											justifyContent: "center",
										}}>
										<Icon
											name={n.icon}
											size={20}
											color={active ? C.primaryPurple : C.mutedText}
										/>
									</View>
									<Text
										style={[
											s.navLabel,
											active && { color: C.primaryPurple, fontWeight: "700" },
										]}>
										{n.label}
									</Text>
								</>
							)}
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

			{/* Log Recipe Modal */}
			<LogRecipeModal
				visible={showLogRecipeModal}
				recipe={logRecipeTarget}
				childName={activeChild?.name}
				onConfirm={handleLogRecipeConfirm}
				onClose={() => {
					setShowLogRecipeModal(false);
					setLogRecipeTarget(null);
				}}
			/>

			{/* Toasts */}
			<View style={s.toastContainer} pointerEvents="none">
				{toasts.map((t) => (
					<View
						key={t.id}
						style={[
							s.toast,
							{
								backgroundColor:
									t.type === "warning" ? C.bgWarning : C.statGreenBg,
								borderWidth: 1.5,
								borderColor:
									t.type === "warning" ? C.warningStroke : C.primaryGreenLight,
							},
						]}>
						<Text
							style={{
								color: t.type === "warning" ? C.warningStroke : C.statGreenText,
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
		backgroundColor: C.white,
		borderRadius: 20,
		padding: 18,
		shadowColor: "#9b7fe8",
		shadowOpacity: 0.15,
		shadowRadius: 18,
		shadowOffset: { width: 0, height: 6 },
		elevation: 6,
	},
	header: {
		backgroundColor: C.white,
		paddingHorizontal: 20,
		paddingVertical: 14,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		shadowColor: "#9b7fe8",
		shadowOpacity: 0.14,
		shadowRadius: 14,
		shadowOffset: { width: 0, height: 4 },
		elevation: 5,
	},
	appName: {
		fontWeight: "800",
		fontSize: 19,
		color: C.primaryPinkDark,
		letterSpacing: 0.2,
	},
	pageSubtitle: { fontSize: 12, color: C.mutedText, marginTop: 1 },
	pageTitle: { fontWeight: "800", fontSize: 22, color: C.primaryPinkDark },
	sectionTitle: { fontWeight: "700", fontSize: 16, color: C.primaryPinkDark },
	smallLabel: {
		fontSize: 11,
		fontWeight: "700",
		color: C.mutedText,
		textTransform: "uppercase",
		letterSpacing: 0.6,
	},
	label: {
		fontSize: 12,
		fontWeight: "700",
		color: C.mutedText,
		textTransform: "uppercase",
		letterSpacing: 0.5,
		marginBottom: 6,
	},
	input: {
		borderWidth: 1.5,
		borderColor: C.borderLight,
		borderRadius: 14,
		paddingHorizontal: 16,
		paddingVertical: 12,
		backgroundColor: C.white,
		color: C.textCharcoal,
		fontWeight: "600",
		fontSize: 15,
		shadowColor: "#9b7fe8",
		shadowOpacity: 0.08,
		shadowRadius: 6,
		shadowOffset: { width: 0, height: 2 },
		elevation: 2,
	},
	btnPrimary: {
		backgroundColor: C.primaryPurple,
		borderRadius: 16,
		paddingVertical: 15,
		paddingHorizontal: 20,
		alignItems: "center",
		justifyContent: "center",
		width: "100%",
		shadowColor: C.primaryPurple,
		shadowOpacity: 0.4,
		shadowRadius: 12,
		shadowOffset: { width: 0, height: 6 },
		elevation: 6,
	},
	btnPrimaryText: {
		color: C.white,
		fontWeight: "700",
		fontSize: 15,
		letterSpacing: 0.3,
	},
	btnOutline: {
		backgroundColor: "transparent",
		borderWidth: 2,
		borderColor: C.primaryPurple,
		borderRadius: 14,
		paddingVertical: 11,
		paddingHorizontal: 18,
		alignItems: "center",
		justifyContent: "center",
	},
	btnOutlineText: { color: C.primaryPurple, fontWeight: "700", fontSize: 13 },
	btnSecondary: {
		backgroundColor: C.bgPurple,
		borderRadius: 12,
		padding: 9,
		shadowColor: "#9b7fe8",
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 1,
	},
	btnDanger: { backgroundColor: "#fff0f0", borderRadius: 12, padding: 9 },
	statCard: {
		borderRadius: 16,
		padding: 12,
		gap: 4,
		shadowColor: "#9b7fe8",
		shadowOpacity: 0.1,
		shadowRadius: 10,
		shadowOffset: { width: 0, height: 4 },
		elevation: 3,
	},
	statValue: { fontSize: 22, fontWeight: "800", lineHeight: 24 },
	statLabel: { fontSize: 10, fontWeight: "700", lineHeight: 12 },
	bottomNav: {
		backgroundColor: C.white,
		flexDirection: "row",
		paddingTop: 8,
		shadowColor: "#9b7fe8",
		shadowOpacity: 0.15,
		shadowRadius: 20,
		shadowOffset: { width: 0, height: -6 },
		elevation: 14,
	},
	navItem: {
		flex: 1,
		alignItems: "center",
		gap: 3,
		paddingBottom: 4,
		paddingTop: 2,
	},
	navLabel: { fontSize: 10, fontWeight: "600", color: C.mutedText },
	navDot: {
		width: 4,
		height: 4,
		backgroundColor: C.primaryPurple,
		borderRadius: 2,
		marginTop: 1,
	},
	navAddBtn: {
		backgroundColor: C.primaryPurple,
		borderRadius: 18,
		width: 52,
		height: 52,
		alignItems: "center",
		justifyContent: "center",
		marginTop: -18,
		shadowColor: C.primaryPurple,
		shadowOpacity: 0.55,
		shadowRadius: 12,
		shadowOffset: { width: 0, height: 5 },
		elevation: 10,
	},
	modalOverlay: {
		flex: 1,
		backgroundColor: "rgba(90,45,122,0.35)",
		justifyContent: "flex-end",
	},
	modalSheet: {
		backgroundColor: C.white,
		borderTopLeftRadius: 28,
		borderTopRightRadius: 28,
		padding: 28,
		maxHeight: "92%",
		shadowColor: "#9b7fe8",
		shadowOpacity: 0.2,
		shadowRadius: 24,
		elevation: 20,
	},
	modalTitle: { fontWeight: "800", fontSize: 20, color: C.primaryPinkDark },
	pickerOverlay: {
		flex: 1,
		backgroundColor: "rgba(90,45,122,0.35)",
		justifyContent: "flex-end",
	},
	pickerSheet: {
		backgroundColor: C.white,
		borderTopLeftRadius: 28,
		borderTopRightRadius: 28,
		padding: 24,
		maxHeight: "65%",
		shadowColor: "#9b7fe8",
		shadowOpacity: 0.2,
		shadowRadius: 24,
		elevation: 20,
	},
	pickerTitle: {
		fontWeight: "700",
		fontSize: 16,
		color: C.primaryPinkDark,
		marginBottom: 16,
	},
	pickerItem: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingVertical: 14,
		paddingHorizontal: 12,
		borderRadius: 14,
		marginBottom: 4,
	},
	pickerItemText: { fontSize: 15, color: C.textCharcoal, fontWeight: "600" },
	tagPurple: {
		backgroundColor: C.bgPurple,
		borderRadius: 999,
		paddingHorizontal: 10,
		paddingVertical: 4,
	},
	tagPurpleText: { fontSize: 11, fontWeight: "700", color: C.primaryPurple },
	tagGreen: {
		backgroundColor: C.bgGreen,
		borderRadius: 999,
		paddingHorizontal: 10,
		paddingVertical: 4,
	},
	tagGreenText: { fontSize: 11, fontWeight: "700", color: C.primaryGreen },
	tagWarning: {
		backgroundColor: "#fff3e0",
		borderRadius: 999,
		paddingHorizontal: 10,
		paddingVertical: 4,
	},
	tagWarningText: { fontSize: 11, fontWeight: "700", color: C.warningStroke },
	toastContainer: {
		position: "absolute",
		bottom: 100,
		right: 16,
		gap: 8,
		zIndex: 9999,
	},
	toast: {
		borderRadius: 14,
		paddingHorizontal: 16,
		paddingVertical: 12,
		maxWidth: 280,
		shadowColor: "#9b7fe8",
		shadowOpacity: 0.18,
		shadowRadius: 12,
		elevation: 8,
	},
});
