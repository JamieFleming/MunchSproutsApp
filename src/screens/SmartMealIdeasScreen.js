/**
 * SmartMealIdeasScreen
 *
 * Generates personalised, safe, age-appropriate meal ideas using OpenAI.
 * - All meal data is derived from the child's food log (liked/disliked/tried)
 * - Rate limited server-side: Free = 3/day, Pro = 10/day
 * - Generated meals are auto-saved to users/{uid}/smartRecipes in Firestore
 * - Each card lets the user rate the idea (1-5 stars) and add ingredients to shopping list
 */

import React, { useState, useMemo, useEffect } from "react";
import {
	View, Text, TouchableOpacity, ScrollView,
	ActivityIndicator, Alert, Modal,
} from "react-native";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getApp } from "firebase/app";
import { collection, addDoc, updateDoc, doc, getDoc, getDocs, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useTheme, useStyles } from "../ThemeContext";
import { Icon } from "../components/Icon";
import { calcAgeMonths } from "../helpers";
import Svg, { Circle, Path } from "react-native-svg";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers — derive meal context from the food log
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns an NHS-accurate texture description sent to the AI.
 *
 * NHS / BLW guidance:
 *  < 6m  — not recommended; smooth runny single-ingredient purées only if starting early
 *  6m    — Stage 1: smooth mash OR soft finger foods (BLW). NOT exclusively purées.
 *  7–8m  — Stage 2: mashed/minced with soft lumps + wider soft finger foods
 *  9–11m — Stage 3: soft chopped pieces + finger foods progressing to family meals
 *  12m+  — Family foods, chopped/broken as needed
 */
function deriveTextureLevel(ageMonths) {
	if (ageMonths < 6)  return "stage 1 (early start, under 6 months): smooth, runny single-ingredient purées only — no lumps, no finger foods (e.g. smooth sweet potato purée, smooth pea purée)";
	if (ageMonths < 7)  return "stage 1 (around 6 months, first weaning): smooth mashed foods AND soft finger foods are both appropriate per NHS/BLW guidelines — do NOT default to purées alone. Examples: mashed banana, steamed broccoli florets, soft avocado wedges, baby porridge, soft cooked carrot sticks";
	if (ageMonths < 9)  return "stage 2 (7–8 months): mashed or minced foods with soft lumps, plus soft finger foods — e.g. mashed lentil dhal, well-cooked pasta shapes, scrambled egg, soft toast strips, minced meat in sauce";
	if (ageMonths < 12) return "stage 3 (9–11 months): soft chopped pieces and varied finger foods progressing toward family meals — e.g. diced soft cooked chicken, rice dishes, soft pasta salads, pitta strips, mild family curry (no added salt)";
	return "12 months+: family foods, chopped or broken into manageable pieces — same as the rest of the family, no added salt or sugar, avoid whole grapes and whole nuts";
}

/** Short label for the context summary card shown to the user */
function textureLevelLabel(ageMonths) {
	if (ageMonths < 6)  return "Smooth purées (under 6m)";
	if (ageMonths < 7)  return "Soft mash & finger foods (6m, Stage 1)";
	if (ageMonths < 9)  return "Mashed & soft lumps (7–8m, Stage 2)";
	if (ageMonths < 12) return "Soft chopped pieces (9–11m, Stage 3)";
	return "Family foods, chopped (12m+)";
}

function deriveFoodContext(foodLog) {
	const likedFoods     = [];
	const dislikedFoods  = [];
	const allergensSafe  = new Set();
	const allergensAvoid = new Set();
	const foodsTried     = new Set();

	foodLog.forEach((entry) => {
		const name = (entry.name || "").trim().toLowerCase();
		if (!name) return;
		foodsTried.add(name);
		if (entry.reaction === "Loved" || entry.reaction === "Good") {
			if (!likedFoods.includes(name)) likedFoods.push(name);
		}
		if (entry.reaction === "Rejected") {
			if (!dislikedFoods.includes(name)) dislikedFoods.push(name);
		}
		if (entry.reaction === "Allergic") {
			(entry.allergens || []).forEach((a) => allergensAvoid.add(a.toLowerCase()));
		} else {
			(entry.allergens || []).forEach((a) => allergensSafe.add(a.toLowerCase()));
		}
	});

	allergensAvoid.forEach((a) => allergensSafe.delete(a));

	const ALL_ALLERGENS     = ["gluten", "dairy", "eggs", "peanuts", "tree nuts", "fish", "shellfish", "soy", "sesame"];
	const allergensTried    = new Set([...allergensSafe, ...allergensAvoid]);
	const allergensNotTried = ALL_ALLERGENS.filter((a) => !allergensTried.has(a));

	return {
		likedFoods:       [...new Set(likedFoods)],
		dislikedFoods:    [...new Set(dislikedFoods)],
		allergensSafe:    [...allergensSafe],
		allergensAvoid:   [...allergensAvoid],
		allergensNotTried,
		foodsTried:       [...foodsTried],
	};
}

// ─────────────────────────────────────────────────────────────────────────────
// Meal type selector
// ─────────────────────────────────────────────────────────────────────────────

const MEAL_OPTS = [
	{ label: "Any",       value: "any",      icon: "sparkle",  color: "#7c3aed", bg: "#ede8f7" },
	{ label: "Breakfast", value: "breakfast", icon: "sun",      color: "#d4860a", bg: "#fff7ed" },
	{ label: "Lunch",     value: "lunch",     icon: "utensils", color: "#16a34a", bg: "#f0fdf4" },
	{ label: "Dinner",    value: "dinner",    icon: "moon",     color: "#2a5f8f", bg: "#dbeafe" },
	{ label: "Snack",     value: "snack",     icon: "chef",     color: "#c2410c", bg: "#fff7ed" },
];

function MealTypeSelector({ selected, onSelect }) {
	const { C } = useTheme();
	return (
		<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 1 }}>
			{MEAL_OPTS.map((opt) => {
				const active = selected === opt.value;
				return (
					<TouchableOpacity
						key={opt.value}
						onPress={() => onSelect(opt.value)}
						activeOpacity={0.8}
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: 6,
							paddingHorizontal: 14,
							paddingVertical: 9,
							borderRadius: 999,
							backgroundColor: active ? opt.color : C.bgPurple,
							borderWidth: 1.5,
							borderColor: active ? opt.color : "transparent",
						}}>
						<Icon name={opt.icon} size={13} color={active ? "#fff" : opt.color} />
						<Text style={{ fontSize: 13, fontFamily: "NunitoSans_700Bold", color: active ? "#fff" : C.textCharcoal }}>
							{opt.label}
						</Text>
					</TouchableOpacity>
				);
			})}
		</ScrollView>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Usage indicator
// ─────────────────────────────────────────────────────────────────────────────

function UsageBar({ used, limit, isPro }) {
	const { C } = useTheme();
	const pct   = Math.min(used / limit, 1);
	const color = pct >= 1 ? "#c0392b" : pct >= 0.7 ? "#d4860a" : "#16a34a";
	return (
		<View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
			<View style={{ flex: 1, height: 5, backgroundColor: C.bgPurple, borderRadius: 3 }}>
				<View style={{ height: 5, width: `${pct * 100}%`, backgroundColor: color, borderRadius: 3 }} />
			</View>
			<Text style={{ fontSize: 11, fontFamily: "NunitoSans_700Bold", color: C.mutedText }}>
				{used}/{limit} today{isPro ? " · Pro" : ""}
			</Text>
		</View>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Star rating
// ─────────────────────────────────────────────────────────────────────────────

const RATING_LABELS = ["", "Not for us", "It was ok", "Pretty good", "Really liked it", "Absolutely loved it!"];

function StarRating({ rating, onRate, size = 24 }) {
	const { C } = useTheme();
	return (
		<View style={{ flexDirection: "row", gap: 8 }}>
			{[1, 2, 3, 4, 5].map((star) => (
				<TouchableOpacity key={star} onPress={() => onRate(star)} hitSlop={6} activeOpacity={0.7}>
					<Icon
						name={star <= (rating || 0) ? "starFill" : "star"}
						size={size}
						color={star <= (rating || 0) ? "#c49a10" : C.borderLight}
					/>
				</TouchableOpacity>
			))}
		</View>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Meal idea card
// ─────────────────────────────────────────────────────────────────────────────

const MEAL_COLORS = [
	{ color: "#7c3aed", bg: "#ede8f7" },
	{ color: "#16a34a", bg: "#f0fdf4" },
	{ color: "#c2410c", bg: "#fff7ed" },
];

function MealCard({ meal, index, firestoreId, savedRating, onRate, onAddToList, onLogRecipe }) {
	const { C }        = useTheme();
	const s            = useStyles();
	const [open, setOpen]           = useState(false);
	const [localRating, setLocalRating] = useState(savedRating || null);
	const { color, bg } = MEAL_COLORS[index % MEAL_COLORS.length];

	const handleRate = (r) => {
		setLocalRating(r);
		onRate?.(r);
	};

	return (
		<View style={[s.card, { padding: 16, overflow: "hidden", shadowColor: color }]}>
			{/* Colour strip */}
			<View style={{ height: 4, backgroundColor: color, marginHorizontal: -16, marginTop: -16, marginBottom: 12 }} />

			<TouchableOpacity onPress={() => setOpen((o) => !o)} activeOpacity={0.85} style={{ gap: 10 }}>
				{/* Header row */}
				<View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
					<View style={{
						width: 42, height: 42, borderRadius: 13,
						backgroundColor: bg, alignItems: "center", justifyContent: "center", flexShrink: 0,
					}}>
						<Icon name="chef" size={20} color={color} />
					</View>
					<View style={{ flex: 1 }}>
						<Text style={{ fontSize: 17, fontFamily: "PlusJakartaSans_600SemiBold", color: C.primaryPinkDark, marginBottom: 4 }}>
							{meal.title}
						</Text>
						<View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
							{meal.mealType && (
								<View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
									<Text style={{ fontSize: 10, fontFamily: "NunitoSans_700Bold", color }}>{meal.mealType}</Text>
								</View>
							)}
							{meal.ageGroup && (
								<View style={{ backgroundColor: C.bgPurple, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
									<Text style={{ fontSize: 10, fontFamily: "NunitoSans_700Bold", color: C.primaryPurple }}>{meal.ageGroup}</Text>
								</View>
							)}
							{/* Saved badge */}
							{firestoreId && (
								<View style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#f0fdf4", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
									<Icon name="check" size={9} color="#16a34a" />
									<Text style={{ fontSize: 9, fontFamily: "NunitoSans_800ExtraBold", color: "#16a34a" }}>SAVED</Text>
								</View>
							)}
							{/* Star preview if rated */}
							{localRating && (
								<View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
									<Icon name="starFill" size={11} color="#c49a10" />
									<Text style={{ fontSize: 10, fontFamily: "NunitoSans_700Bold", color: "#c49a10" }}>{localRating}/5</Text>
								</View>
							)}
						</View>
					</View>
					<View style={{ transform: [{ rotate: open ? "90deg" : "0deg" }] }}>
						<Icon name="chevRight" size={16} color={C.mutedText} />
					</View>
				</View>

				{/* Description */}
				<Text style={{ fontSize: 13, fontFamily: "NunitoSans_400Regular", color: C.mutedText, lineHeight: 20 }}>{meal.description}</Text>

				{/* Why suggested chip */}
				{meal.whySuggested ? (
					<View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: C.bgPurple, borderRadius: 10, padding: 10 }}>
						<Icon name="sparkle" size={12} color={C.primaryPurple} />
						<Text style={{ fontSize: 12, color: C.primaryPurpleDark, flex: 1, lineHeight: 17 }}>{meal.whySuggested}</Text>
					</View>
				) : null}

				{/* New food badge */}
				{meal.newFood ? (
					<View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
						<View style={{ backgroundColor: "#fef9c3", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, flexDirection: "row", alignItems: "center", gap: 5 }}>
							<Icon name="sparkle" size={10} color="#ca8a04" />
							<Text style={{ fontSize: 11, fontFamily: "NunitoSans_700Bold", color: "#ca8a04" }}>New food: {meal.newFood}</Text>
						</View>
					</View>
				) : null}
			</TouchableOpacity>

			{/* Expanded details */}
			{open && (
				<View style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 16, gap: 14, borderTopWidth: 1, borderTopColor: C.borderLight }}>

					{/* Nutrition */}
					{meal.nutrition && (
						<View style={{ gap: 8 }}>
							<Text style={{ fontSize: 11, fontFamily: "NunitoSans_800ExtraBold", color: C.mutedText, textTransform: "uppercase", letterSpacing: 0.5 }}>Approx. nutrition per serving</Text>
							<View style={{ flexDirection: "row", gap: 8 }}>
								{[
									{ label: "Calories", value: meal.nutrition.calories, unit: "kcal", bg: "#fde8cc", color: "#a85a1a" },
									{ label: "Protein",  value: meal.nutrition.protein,  unit: "g",    bg: "#d4f0e0", color: "#2d7a55" },
									{ label: "Carbs",    value: meal.nutrition.carbs,    unit: "g",    bg: "#d4e8f5", color: "#2a5f8f" },
								].map((item) => (
									<View key={item.label} style={{ flex: 1, backgroundColor: item.bg, borderRadius: 12, padding: 10, alignItems: "center" }}>
										<Text style={{ fontSize: 17, fontFamily: "NunitoSans_800ExtraBold", color: item.color }}>{item.value}</Text>
										<Text style={{ fontSize: 9, fontFamily: "NunitoSans_700Bold", color: item.color, textTransform: "uppercase", marginTop: 1 }}>{item.unit}</Text>
										<Text style={{ fontSize: 10, color: item.color, opacity: 0.7, marginTop: 2 }}>{item.label}</Text>
									</View>
								))}
							</View>
							<Text style={{ fontSize: 10, color: C.mutedText, fontStyle: "italic" }}>Values are estimates only — not medical or dietetic advice</Text>
						</View>
					)}

					{/* Allergens */}
					{meal.allergens?.length > 0 && (
						<View style={{ marginTop: 12 }}>
							<Text style={{ fontSize: 11, fontFamily: "NunitoSans_800ExtraBold", color: C.mutedText, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Contains</Text>
							<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
								{meal.allergens.map((a, i) => (
									<View key={i} style={{ backgroundColor: "#fef9c3", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
										<Text style={{ fontSize: 11, fontFamily: "NunitoSans_700Bold", color: "#92400e" }}>{a}</Text>
									</View>
								))}
							</View>
						</View>
					)}

					{/* Ingredients */}
					{meal.ingredients?.length > 0 && (
						<View>
							<Text style={{ fontSize: 11, fontFamily: "NunitoSans_800ExtraBold", color: C.mutedText, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Ingredients</Text>
							<View style={{ gap: 5 }}>
								{meal.ingredients.map((ing, i) => (
									<View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
										<View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, marginTop: 7, flexShrink: 0 }} />
										<Text style={{ fontSize: 13, color: C.textCharcoal, flex: 1, lineHeight: 20 }}>{ing}</Text>
									</View>
								))}
							</View>
						</View>
					)}

					{/* Steps */}
					{meal.steps?.length > 0 && (
						<View>
							<Text style={{ fontSize: 11, fontFamily: "NunitoSans_800ExtraBold", color: C.mutedText, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>How to prepare</Text>
							<View style={{ gap: 8 }}>
								{meal.steps.map((step, i) => (
									<View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
										<View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: bg, alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
											<Text style={{ fontSize: 11, fontFamily: "NunitoSans_800ExtraBold", color }}>{i + 1}</Text>
										</View>
										<Text style={{ fontSize: 13, color: C.textCharcoal, flex: 1, lineHeight: 20 }}>{step}</Text>
									</View>
								))}
							</View>
						</View>
					)}

					{/* Serving suggestions */}
					{meal.servingSuggestions?.length > 0 && (
						<View style={{ gap: 8 }}>
							<View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
								<Text style={{ fontSize: 11, fontFamily: "NunitoSans_800ExtraBold", color: C.mutedText, textTransform: "uppercase", letterSpacing: 0.5 }}>Serve with</Text>
							</View>
							<View style={{ gap: 6 }}>
								{meal.servingSuggestions.map((suggestion, i) => (
									<View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: C.bgPurple, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}>
										<View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, marginTop: 6, flexShrink: 0 }} />
										<Text style={{ fontSize: 13, color: C.textCharcoal, fontFamily: "NunitoSans_400Regular", flex: 1, lineHeight: 20 }}>{suggestion}</Text>
									</View>
								))}
							</View>
						</View>
					)}

					{/* Divider */}
					<View style={{ height: 1, backgroundColor: C.borderLight }} />

					{/* Action buttons */}
					<View style={{ gap: 10 }}>
						{onLogRecipe && (
							<TouchableOpacity
								onPress={onLogRecipe}
								activeOpacity={0.8}
								style={{
									flexDirection: "row", alignItems: "center", justifyContent: "center",
									gap: 8, backgroundColor: "#7c3aed", borderRadius: 12, paddingVertical: 12,
								}}>
								<Icon name="plus" size={16} color="#fff" />
								<Text style={{ fontFamily: "NunitoSans_700Bold", fontSize: 13, color: "#fff" }}>Log This</Text>
							</TouchableOpacity>
						)}
						{onAddToList && (
							<TouchableOpacity
								onPress={onAddToList}
								activeOpacity={0.8}
								style={[s.btnOutline, { flexDirection: "row", gap: 8 }]}>
								<Icon name="cart" size={16} color={C.primaryPurple} />
								<Text style={{ fontFamily: "NunitoSans_700Bold", fontSize: 13, color: C.primaryPurple }}>Add to Shopping List</Text>
							</TouchableOpacity>
						)}
					</View>

					{/* Star rating */}
					{firestoreId && (
						<View style={{ gap: 10, backgroundColor: C.bgPurple, borderRadius: 14, padding: 14 }}>
							<Text style={{ fontSize: 12, fontFamily: "NunitoSans_700Bold", color: C.textCharcoal }}>Rate this idea</Text>
							<StarRating rating={localRating} onRate={handleRate} />
							{localRating ? (
								<Text style={{ fontSize: 12, color: "#c49a10", fontFamily: "NunitoSans_600SemiBold" }}>
									{RATING_LABELS[localRating]}
								</Text>
							) : (
								<Text style={{ fontSize: 11, color: C.mutedText }}>Tap a star to rate · saved to Smart Recipes</Text>
							)}
						</View>
					)}
				</View>
			)}
		</View>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────

export function SmartMealIdeasScreen({ child, foodLog = [], user, isPro, onUpgradePro, onAddToShoppingList, onLogRecipe }) {
	const { C } = useTheme();
	const s = useStyles();

	const DAILY_LIMIT = 3;

	const [mealType,     setMealType]     = useState("any");
	const [loading,      setLoading]      = useState(false);
	const [meals,        setMeals]        = useState([]);
	const [disclaimer,   setDisclaimer]   = useState("");
	const [used,         setUsed]         = useState(0);
	const [usageLoaded,  setUsageLoaded]  = useState(false);
	const [limitReached, setLimitReached] = useState(false);

	// Firestore state — set after auto-saving generated meals
	const [firestoreIds,  setFirestoreIds]  = useState({}); // index → Firestore doc ID
	const [mealRatings,   setMealRatings]   = useState({}); // docId → 1-5

	// Shopping list ingredient picker
	const [shopPickerMeal,    setShopPickerMeal]    = useState(null);
	const [shopPickerChecked, setShopPickerChecked] = useState({});
	const [shopPickerLoading, setShopPickerLoading] = useState(false);
	const [shopAdded,         setShopAdded]         = useState(false);

	const ageMonths    = calcAgeMonths(child?.dob);
	const textureLevel = deriveTextureLevel(ageMonths || 6);
	const foodContext  = useMemo(() => deriveFoodContext(foodLog), [foodLog]);
	const hasEnoughData = foodLog.length > 0;

	// ── Fetch today's usage on mount so user can see remaining uses upfront ──

	useEffect(() => {
		if (!user?.uid) return;
		const today = new Date().toISOString().split("T")[0];
		getDoc(doc(db, "users", user.uid, "mealIdeasUsage", today))
			.then((snap) => {
				const count = snap.exists() ? (snap.data().count || 0) : 0;
				setUsed(count);
				if (count >= DAILY_LIMIT) setLimitReached(true);
			})
			.catch(() => {}) // non-fatal — just won't pre-fill the counter
			.finally(() => setUsageLoaded(true));
	}, [user?.uid]);

	// ── Auto-save meals to Firestore ─────────────────────────────────────────

	const saveMealsToFirestore = async (generatedMeals) => {
		if (!user?.uid || !generatedMeals.length) return {};
		const ids = {};
		let anyError = null;
		for (let i = 0; i < generatedMeals.length; i++) {
			try {
				const docRef = await addDoc(
					collection(db, "users", user.uid, "smartRecipes"),
					{
						...generatedMeals[i],
						childId:     child?.id   || null,
						childName:   child?.name || "Baby",
						rating:      null,
						savedAt:     serverTimestamp(),
						aiGenerated: true,
					},
				);
				ids[i] = docRef.id;
			} catch (err) {
				console.error("[SmartMealIdeas] save error:", err.message, err.code);
				anyError = err;
			}
		}
		if (anyError) {
			// Surface save errors to the user — don't silently fail
			Alert.alert(
				"Couldn't save recipes",
				"The meal ideas were generated but couldn't be saved to Smart Recipes. Check your connection and try again.",
			);
		}
		return ids;
	};

	// ── Rate a saved recipe ──────────────────────────────────────────────────

	const handleRate = async (firestoreId, rating) => {
		if (!user?.uid || !firestoreId) return;
		setMealRatings((prev) => ({ ...prev, [firestoreId]: rating }));
		try {
			await updateDoc(doc(db, "users", user.uid, "smartRecipes", firestoreId), { rating });
		} catch (err) {
			console.warn("[SmartMealIdeas] rate error:", err.message);
		}
	};

	// ── Shopping list picker ─────────────────────────────────────────────────

	const openShopPicker = (meal) => {
		const init = {};
		(meal.ingredients || []).forEach((_, i) => { init[i] = true; });
		setShopPickerChecked(init);
		setShopPickerMeal(meal);
		setShopAdded(false);
	};

	const handleShopPickerAdd = async () => {
		if (!shopPickerMeal || !onAddToShoppingList) return;
		const selected = (shopPickerMeal.ingredients || []).filter((_, i) => shopPickerChecked[i]);
		if (!selected.length) return;
		setShopPickerLoading(true);
		try {
			await onAddToShoppingList(null, shopPickerMeal.title, selected);
			setShopAdded(true);
			setTimeout(() => setShopPickerMeal(null), 1200);
		} catch (e) {
			Alert.alert("Couldn't add items", e?.message || "Please check your connection and try again.");
		} finally {
			setShopPickerLoading(false);
		}
	};

	// ── Generate ─────────────────────────────────────────────────────────────

	const generate = async () => {
		if (!user?.uid) return;
		setLoading(true);
		setMeals([]);
		setFirestoreIds({});
		setMealRatings({});
		setLimitReached(false);

		try {
			// Fetch all previously suggested titles + ratings so AI avoids repeats and learns preferences
			let previousTitles = [];
			let ratedRecipes   = [];
			try {
				const snap = await getDocs(collection(db, "users", user.uid, "smartRecipes"));
				snap.forEach((d) => {
					const data = d.data();
					if (data.title) {
						previousTitles.push(data.title);
						if (data.rating) ratedRecipes.push({ title: data.title, rating: data.rating });
					}
				});
			} catch { /* non-fatal */ }

			const app       = getApp();
			const functions = getFunctions(app, "europe-west2");
			const fn        = httpsCallable(functions, "generateMealIdeas");

			const result = await fn({
				childName:    child?.name || "Baby",
				ageMonths:    ageMonths ?? 6,
				mealType,
				textureLevel,
				isPro,
				previousTitles,
				ratedRecipes,
				...foodContext,
			});

			const data = result.data;

			if (data.error === "daily_limit_reached") {
				setLimitReached(true);
				setUsed(DAILY_LIMIT);
				return;
			}

			const generatedMeals = data.meals || [];
			setMeals(generatedMeals);
			setDisclaimer(data.disclaimer || "");
			setUsed(data.used || 0);

			// Auto-save to Firestore (non-blocking after setting state)
			saveMealsToFirestore(generatedMeals).then((ids) => setFirestoreIds(ids));
		} catch (err) {
			console.warn("[SmartMealIdeas] error:", err?.message);
			Alert.alert(
				"Couldn't generate ideas",
				"Something went wrong. Please check your connection and try again.",
				[{ text: "OK" }],
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<>
		<ScrollView
			showsVerticalScrollIndicator={false}
			contentContainerStyle={{ gap: 18, paddingBottom: 40 }}>

			{/* ── Header ── */}
			<View style={{ gap: 4 }}>
				<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
					<Text style={{ fontSize: 24, fontFamily: "PlusJakartaSans_700Bold", color: C.primaryPinkDark }}>Smart Meal Ideas</Text>
					<View style={{ backgroundColor: "#7c3aed", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
						<Text style={{ fontSize: 9, fontFamily: "NunitoSans_800ExtraBold", color: "#fff", textTransform: "uppercase", letterSpacing: 0.5 }}>AI</Text>
					</View>
				</View>
				<Text style={{ fontSize: 13, fontFamily: "NunitoSans_400Regular", color: C.mutedText, lineHeight: 19 }}>
					Personalised{child?.name ? ` for ${child.name}` : ""} · age-appropriate · safety-first
				</Text>
			</View>

			{/* ── Usage counter — shown before and after generating ── */}
			<UsageBar used={used} limit={DAILY_LIMIT} isPro={isPro} />

			{/* ── Meal type selector ── */}
			<View style={{ gap: 10 }}>
				<Text style={{ fontSize: 13, fontFamily: "NunitoSans_800ExtraBold", color: C.textCharcoal }}>What meal?</Text>
				<MealTypeSelector selected={mealType} onSelect={setMealType} />
			</View>

			{/* ── Context summary ── */}
			<View style={[s.card, { backgroundColor: C.bgPurple, gap: 8 }]}>
				<View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
					<Text style={{ fontSize: 15, fontFamily: "PlusJakartaSans_600SemiBold", color: C.primaryPinkDark }}>
						Generating ideas based on:
					</Text>
					<View style={{ backgroundColor: C.primaryPurple + "20", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 }}>
						<Text style={{ fontSize: 12, fontFamily: "NunitoSans_700Bold", color: C.primaryPurple }}>
							{textureLevelLabel(ageMonths || 0)}
						</Text>
					</View>
				</View>
				<View style={{ gap: 5 }}>
					{[
						{ icon: "baby",   label: `Age: ${ageMonths != null ? `${ageMonths} months` : "unknown"}` },
						{ icon: "check",  label: foodContext.likedFoods.length > 0 ? `${foodContext.likedFoods.length} liked foods` : "No liked foods logged yet" },
						{ icon: "list",   label: `${foodContext.foodsTried.length} foods tried so far` },
						foodContext.allergensAvoid.length > 0
							? { icon: "alert",  label: `Avoiding (reaction): ${foodContext.allergensAvoid.join(", ")}` }
							: foodContext.allergensNotTried.length > 0
							? { icon: "shield", label: `Not yet tried: ${foodContext.allergensNotTried.join(", ")}` }
							: { icon: "shield", label: "All 9 allergens introduced ✓" },
					].map((row, i) => (
						<View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
							<Icon name={row.icon} size={12} color={C.primaryPurple} />
							<Text style={{ fontSize: 12, fontFamily: "NunitoSans_400Regular", color: C.mutedText, flex: 1 }}>{row.label}</Text>
						</View>
					))}
				</View>
				{!hasEnoughData && (
					<Text style={{ fontSize: 11, color: "#c2410c", fontFamily: "NunitoSans_600SemiBold", marginTop: 4 }}>
						💡 Log some meals first for more personalised ideas
					</Text>
				)}
			</View>

			{/* ── Limit reached ── */}
			{limitReached && (
				<View style={{ backgroundColor: "#fef2f2", borderRadius: 14, padding: 16, gap: 10, alignItems: "center" }}>
					<Icon name="clock" size={28} color="#c0392b" />
					<Text style={{ fontSize: 15, fontFamily: "NunitoSans_800ExtraBold", color: "#c0392b", textAlign: "center" }}>
						Daily limit reached
					</Text>
					<Text style={{ fontSize: 13, color: C.mutedText, textAlign: "center", lineHeight: 19 }}>
						{isPro
							? `You've used all ${DAILY_LIMIT} of today's Smart Meal Ideas. Come back tomorrow for more!`
							: `You've used all ${DAILY_LIMIT} free ideas today. Upgrade to Pro for up to 10 ideas per day.`}
					</Text>
					{!isPro && (
						<TouchableOpacity
							onPress={onUpgradePro}
							style={{ backgroundColor: "#2d1f5e", borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}>
							<Text style={{ color: "#f5c842", fontFamily: "NunitoSans_800ExtraBold", fontSize: 14 }}>Upgrade to Pro</Text>
						</TouchableOpacity>
					)}
				</View>
			)}

			{/* ── Generate button ── */}
			{!limitReached && (
				<TouchableOpacity
					onPress={generate}
					disabled={loading}
					activeOpacity={0.85}
					style={[s.btnPrimary, { flexDirection: "row", gap: 10, opacity: loading ? 0.7 : 1 }]}>
					{loading ? (
						<>
							<ActivityIndicator size="small" color={C.white} />
							<Text style={s.btnPrimaryText}>Generating ideas…</Text>
						</>
					) : (
						<>
							<Icon name="sparkle" size={18} color="#fff" />
							<Text style={s.btnPrimaryText}>
								{meals.length > 0 ? "Generate new ideas" : "Generate Meal Ideas"}
							</Text>
						</>
					)}
				</TouchableOpacity>
			)}

			{/* ── Uses remaining note ── */}
			{!limitReached && (
				<Text style={{ fontSize: 12, fontFamily: "NunitoSans_400Regular", color: C.mutedText, textAlign: "center" }}>
					{DAILY_LIMIT - used} generation{DAILY_LIMIT - used !== 1 ? "s" : ""} remaining today · 3 recipes per generation
				</Text>
			)}

			{/* ── Empty / intro state ── */}
			{meals.length === 0 && !loading && (
				<View style={{ alignItems: "center", paddingVertical: 24, gap: 12 }}>
					<Svg width={80} height={80} viewBox="0 0 80 80">
						<Circle cx="40" cy="40" r="38" fill={C.bgPurple} />
						<Path stroke={C.primaryPurple} strokeWidth="2.5" strokeLinecap="round" fill="none" d="M24 40 Q24 26 40 24 Q56 22 56 36 Q56 48 44 52 L44 56" />
						<Circle cx="44" cy="60" r="2" fill={C.primaryPurple} />
						<Path stroke="#f9a825" strokeWidth="1.5" strokeLinecap="round" fill="none" d="M20 22 L20 17 M17 19 L23 19" />
						<Path stroke="#7dcf9e" strokeWidth="1.5" strokeLinecap="round" fill="none" d="M62 28 L62 23 M59 25 L65 25" />
					</Svg>
					<Text style={{ fontSize: 13, fontFamily: "NunitoSans_400Regular", color: C.mutedText, textAlign: "center" }}>
						Tap "Generate Meal Ideas" to get personalised suggestions
					</Text>
				</View>
			)}

			{/* ── Meal cards ── */}
			{meals.length > 0 && (
				<View style={{ gap: 14 }}>
					<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
						<Text style={{ fontSize: 13, fontFamily: "NunitoSans_800ExtraBold", color: C.textCharcoal, flex: 1 }}>
							Here are some ideas 👇
						</Text>
						{Object.keys(firestoreIds).length > 0 && (
							<View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#f0fdf4", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
								<Icon name="check" size={11} color="#16a34a" />
								<Text style={{ fontSize: 11, fontFamily: "NunitoSans_700Bold", color: "#16a34a" }}>Saved to Smart Recipes</Text>
							</View>
						)}
					</View>
					{meals.map((meal, i) => (
						<MealCard
							key={i}
							meal={meal}
							index={i}
							firestoreId={firestoreIds[i] || null}
							savedRating={firestoreIds[i] ? (mealRatings[firestoreIds[i]] || null) : null}
							onRate={(rating) => handleRate(firestoreIds[i], rating)}
							onAddToList={onAddToShoppingList ? () => openShopPicker(meal) : null}
							onLogRecipe={onLogRecipe ? () => onLogRecipe(meal) : null}
						/>
					))}
				</View>
			)}

			{/* ── Disclaimer ── */}
			<View style={{ backgroundColor: "#fff8e1", borderRadius: 16, padding: 16, gap: 10, borderWidth: 1, borderColor: "#fde68a" }}>
				<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
					<Icon name="alert" size={16} color="#a85a1a" />
					<Text style={{ fontSize: 13, fontFamily: "NunitoSans_800ExtraBold", color: "#a85a1a" }}>Important — please read</Text>
				</View>
				<Text style={{ fontSize: 12, color: "#7a4a10", lineHeight: 19 }}>
					{disclaimer ||
						"Smart Meal Ideas are AI-generated suggestions for inspiration only and are not medical or nutritional advice. Nutritional values are approximate estimates only."}
				</Text>
				<Text style={{ fontSize: 12, color: "#7a4a10", lineHeight: 19 }}>
					Always follow safe weaning guidance (NHS Start4Life) and consult your health visitor, GP, or a registered dietitian regarding allergies, intolerances, or any feeding concerns. Never delay seeking medical advice based on information from this app.
				</Text>
			</View>

			{/* ── Powered by ── */}
			<Text style={{ fontSize: 10, color: C.mutedText, textAlign: "center" }}>
				✨ Powered by OpenAI · safety rules enforced on every request
			</Text>
		</ScrollView>

		{/* ── Shopping list ingredient picker modal ── */}
		<Modal
			visible={!!shopPickerMeal}
			transparent
			animationType="slide"
			onRequestClose={() => !shopPickerLoading && setShopPickerMeal(null)}>
			<View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}>
				<View style={{ backgroundColor: "#f8f6ff", borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "85%", paddingBottom: 34 }}>

					{/* Handle + header */}
					<View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
						<View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: "#e0d9f7", alignSelf: "center", marginBottom: 16 }} />
						<View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
							<View style={{ flex: 1 }}>
								<Text style={{ fontSize: 18, fontFamily: "NunitoSans_800ExtraBold", color: "#1e1040" }}>{shopPickerMeal?.title}</Text>
								<Text style={{ fontSize: 12, color: "#9c8ab8", marginTop: 2 }}>
									Choose ingredients to add to your shopping list
								</Text>
							</View>
							<TouchableOpacity
								onPress={() => { if (!shopPickerLoading) setShopPickerMeal(null); }}
								style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#ede8f7", alignItems: "center", justifyContent: "center" }}>
								<Icon name="close" size={15} color="#7c3aed" />
							</TouchableOpacity>
						</View>

						{/* Select all / none */}
						<View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
							{[
								{ label: "Select all", action: () => { const a = {}; (shopPickerMeal?.ingredients || []).forEach((_, i) => { a[i] = true; }); setShopPickerChecked(a); } },
								{ label: "Clear all",  action: () => setShopPickerChecked({}) },
							].map(({ label, action }) => (
								<TouchableOpacity key={label} onPress={action} activeOpacity={0.75}
									style={{ backgroundColor: "#ede8f7", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}>
									<Text style={{ fontSize: 12, fontFamily: "NunitoSans_700Bold", color: "#7c3aed" }}>{label}</Text>
								</TouchableOpacity>
							))}
						</View>
					</View>

					{/* Ingredient list */}
					<ScrollView style={{ paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
						{(shopPickerMeal?.ingredients || []).map((ing, i) => (
							<TouchableOpacity
								key={i}
								onPress={() => setShopPickerChecked((p) => ({ ...p, [i]: !p[i] }))}
								activeOpacity={0.8}
								style={{
									flexDirection: "row", alignItems: "center",
									backgroundColor: "#fff", borderRadius: 12,
									marginBottom: 8, paddingHorizontal: 14, paddingVertical: 13, gap: 12,
								}}>
								<View style={{
									width: 24, height: 24, borderRadius: 12,
									borderWidth: 2,
									borderColor: shopPickerChecked[i] ? "#7c3aed" : "#d1c9e8",
									backgroundColor: shopPickerChecked[i] ? "#7c3aed" : "transparent",
									alignItems: "center", justifyContent: "center",
								}}>
									{shopPickerChecked[i] && <Icon name="check" size={12} color="#fff" />}
								</View>
								<Text style={{ flex: 1, fontSize: 14, color: "#1e1040", fontFamily: "NunitoSans_400Regular" }}>{ing}</Text>
							</TouchableOpacity>
						))}
						<View style={{ height: 20 }} />
					</ScrollView>

					{/* Add / Success button */}
					<View style={{ paddingHorizontal: 20, paddingTop: 10 }}>
						{shopAdded ? (
							<View style={{
								backgroundColor: "#16a34a", borderRadius: 16, paddingVertical: 15,
								alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8,
							}}>
								<Icon name="check" size={18} color="#fff" />
								<Text style={{ color: "#fff", fontFamily: "NunitoSans_800ExtraBold", fontSize: 15 }}>Added to Shopping List!</Text>
							</View>
						) : (() => {
							const selectedCount = Object.values(shopPickerChecked).filter(Boolean).length;
							return (
								<TouchableOpacity
									onPress={handleShopPickerAdd}
									disabled={selectedCount === 0 || shopPickerLoading}
									activeOpacity={0.85}
									style={{
										backgroundColor: selectedCount === 0 ? "#d1c9e8" : "#1d4ed8",
										borderRadius: 16, paddingVertical: 15,
										alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8,
									}}>
									{shopPickerLoading ? (
										<ActivityIndicator color="#fff" />
									) : (
										<>
											<Icon name="cart" size={18} color="#fff" />
											<Text style={{ color: "#fff", fontFamily: "NunitoSans_800ExtraBold", fontSize: 15 }}>
												{selectedCount > 0
													? `Add ${selectedCount} item${selectedCount !== 1 ? "s" : ""} to Shopping List`
													: "Select at least one ingredient"}
											</Text>
										</>
									)}
								</TouchableOpacity>
							);
						})()}
					</View>
				</View>
			</View>
		</Modal>
		</>
	);
}
