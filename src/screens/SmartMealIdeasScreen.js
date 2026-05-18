/**
 * SmartMealIdeasScreen
 *
 * Generates personalised, safe, age-appropriate meal ideas using Gemini AI.
 * - All meal data is derived from the child's food log (liked/disliked/tried)
 * - Rate limited server-side: Free = 3/day, Pro = 10/day
 * - Includes safety disclaimer on every response
 */

import React, { useState, useEffect, useMemo } from "react";
import {
	View, Text, TouchableOpacity, ScrollView,
	ActivityIndicator, Alert,
} from "react-native";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getApp } from "firebase/app";
import { useTheme } from "../ThemeContext";
import { Icon } from "../components/Icon";
import { calcAgeMonths } from "../helpers";
import { MEAL_TIMES } from "../constants";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers — derive meal context from the food log
// ─────────────────────────────────────────────────────────────────────────────

function deriveTextureLevel(ageMonths) {
	if (ageMonths < 7)  return "smooth purée";
	if (ageMonths < 8)  return "smooth or thick purée";
	if (ageMonths < 9)  return "mashed or lumpy";
	if (ageMonths < 10) return "soft finger foods";
	if (ageMonths < 12) return "soft finger foods and chopped pieces";
	return "family foods, chopped or mashed as needed";
}

function deriveFoodContext(foodLog) {
	const likedFoods    = [];
	const dislikedFoods = [];
	const allergensSafe = new Set();
	const allergensAvoid = new Set();
	const foodsTried    = new Set();

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

	// Remove allergensSafe items that also appear in avoid
	allergensAvoid.forEach((a) => allergensSafe.delete(a));

	return {
		likedFoods:     [...new Set(likedFoods)],
		dislikedFoods:  [...new Set(dislikedFoods)],
		allergensSafe:  [...allergensSafe],
		allergensAvoid: [...allergensAvoid],
		foodsTried:     [...foodsTried],
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
						<Text style={{ fontSize: 13, fontWeight: "700", color: active ? "#fff" : C.textCharcoal }}>
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
			<Text style={{ fontSize: 11, fontWeight: "700", color: C.mutedText }}>
				{used}/{limit} today{isPro ? " · Pro" : ""}
			</Text>
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

function MealCard({ meal, index }) {
	const { C }        = useTheme();
	const [open, setOpen] = useState(false);
	const { color, bg } = MEAL_COLORS[index % MEAL_COLORS.length];

	return (
		<View style={{ backgroundColor: C.white, borderRadius: 18, overflow: "hidden", shadowColor: color, shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 }}>
			{/* Colour strip */}
			<View style={{ height: 4, backgroundColor: color }} />

			<TouchableOpacity onPress={() => setOpen((o) => !o)} activeOpacity={0.85} style={{ padding: 16, gap: 10 }}>
				{/* Header row */}
				<View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
					<View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: bg, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
						<Icon name="chef" size={20} color={color} />
					</View>
					<View style={{ flex: 1 }}>
						<Text style={{ fontSize: 15, fontWeight: "800", color: C.textCharcoal, marginBottom: 2 }}>{meal.title}</Text>
						<View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
							{meal.mealType && (
								<View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
									<Text style={{ fontSize: 10, fontWeight: "700", color }}>{meal.mealType}</Text>
								</View>
							)}
							{meal.ageGroup && (
								<View style={{ backgroundColor: C.bgPurple, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
									<Text style={{ fontSize: 10, fontWeight: "700", color: C.primaryPurple }}>{meal.ageGroup}</Text>
								</View>
							)}
						</View>
					</View>
					<View style={{ transform: [{ rotate: open ? "90deg" : "0deg" }] }}>
						<Icon name="chevRight" size={16} color={C.mutedText} />
					</View>
				</View>

				{/* Description */}
				<Text style={{ fontSize: 13, color: C.mutedText, lineHeight: 19 }}>{meal.description}</Text>

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
							<Text style={{ fontSize: 11, fontWeight: "700", color: "#ca8a04" }}>New food: {meal.newFood}</Text>
						</View>
					</View>
				) : null}
			</TouchableOpacity>

			{/* Expanded details */}
			{open && (
				<View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 14, borderTopWidth: 1, borderTopColor: C.borderLight }}>

					{/* Allergens */}
					{meal.allergens?.length > 0 && (
						<View style={{ marginTop: 12 }}>
							<Text style={{ fontSize: 11, fontWeight: "800", color: C.mutedText, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Contains</Text>
							<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
								{meal.allergens.map((a, i) => (
									<View key={i} style={{ backgroundColor: "#fef9c3", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
										<Text style={{ fontSize: 11, fontWeight: "700", color: "#92400e" }}>{a}</Text>
									</View>
								))}
							</View>
						</View>
					)}

					{/* Ingredients */}
					{meal.ingredients?.length > 0 && (
						<View>
							<Text style={{ fontSize: 11, fontWeight: "800", color: C.mutedText, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Ingredients</Text>
							<View style={{ gap: 5 }}>
								{meal.ingredients.map((ing, i) => (
									<View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
										<View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, marginTop: 6, flexShrink: 0 }} />
										<Text style={{ fontSize: 13, color: C.textCharcoal, flex: 1, lineHeight: 20 }}>{ing}</Text>
									</View>
								))}
							</View>
						</View>
					)}

					{/* Steps */}
					{meal.steps?.length > 0 && (
						<View>
							<Text style={{ fontSize: 11, fontWeight: "800", color: C.mutedText, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>How to prepare</Text>
							<View style={{ gap: 8 }}>
								{meal.steps.map((step, i) => (
									<View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
										<View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: bg, alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
											<Text style={{ fontSize: 11, fontWeight: "800", color }}>{i + 1}</Text>
										</View>
										<Text style={{ fontSize: 13, color: C.textCharcoal, flex: 1, lineHeight: 20 }}>{step}</Text>
									</View>
								))}
							</View>
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

export function SmartMealIdeasScreen({ child, foodLog = [], user, isPro, onUpgradePro }) {
	const { C } = useTheme();

	const [mealType,  setMealType]  = useState("any");
	const [loading,   setLoading]   = useState(false);
	const [meals,     setMeals]     = useState([]);
	const [disclaimer,setDisclaimer]= useState("");
	const [used,      setUsed]      = useState(0);
	const [limit,     setLimit]     = useState(isPro ? 10 : 3);
	const [limitReached, setLimitReached] = useState(false);

	const ageMonths   = calcAgeMonths(child?.dob);
	const textureLevel = deriveTextureLevel(ageMonths || 6);
	const foodContext  = useMemo(() => deriveFoodContext(foodLog), [foodLog]);

	const hasEnoughData = foodLog.length > 0;

	const generate = async () => {
		if (!user?.uid) return;
		setLoading(true);
		setMeals([]);
		setLimitReached(false);

		try {
			const app       = getApp();
			const functions = getFunctions(app, "europe-west2");
			const fn        = httpsCallable(functions, "generateMealIdeas");

			const result = await fn({
				childName:      child?.name || "Baby",
				ageMonths,
				mealType,
				textureLevel,
				isPro,
				...foodContext,
			});

			const data = result.data;

			if (data.error === "daily_limit_reached") {
				setLimitReached(true);
				setUsed(data.used || data.limit);
				setLimit(data.limit);
				return;
			}

			setMeals(data.meals || []);
			setDisclaimer(data.disclaimer || "");
			setUsed(data.used || 0);
			setLimit(data.limit || (isPro ? 10 : 3));
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
		<ScrollView
			showsVerticalScrollIndicator={false}
			contentContainerStyle={{ gap: 18, paddingBottom: 40 }}>

			{/* ── Header ── */}
			<View style={{ gap: 4 }}>
				<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
					<Text style={{ fontSize: 22, fontWeight: "900", color: C.primaryPinkDark }}>Smart Meal Ideas</Text>
					<View style={{ backgroundColor: "#7c3aed", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
						<Text style={{ fontSize: 9, fontWeight: "800", color: "#fff", textTransform: "uppercase", letterSpacing: 0.5 }}>AI</Text>
					</View>
				</View>
				<Text style={{ fontSize: 13, color: C.mutedText, lineHeight: 19 }}>
					Personalised{child?.name ? ` for ${child.name}` : ""} · age-appropriate · safety-first
				</Text>
			</View>

			{/* ── Usage bar ── */}
			{used > 0 && <UsageBar used={used} limit={limit} isPro={isPro} />}

			{/* ── Meal type selector ── */}
			<View style={{ gap: 10 }}>
				<Text style={{ fontSize: 13, fontWeight: "800", color: C.textCharcoal }}>What meal?</Text>
				<MealTypeSelector selected={mealType} onSelect={setMealType} />
			</View>

			{/* ── Context summary ── */}
			<View style={{ backgroundColor: C.bgPurple, borderRadius: 14, padding: 14, gap: 8 }}>
				<Text style={{ fontSize: 12, fontWeight: "800", color: C.primaryPurpleDark }}>
					Generating ideas based on:
				</Text>
				<View style={{ gap: 5 }}>
					{[
						{ icon: "baby",     label: `Age: ${ageMonths != null ? `${ageMonths} months` : "unknown"} · ${textureLevel}` },
						{ icon: "check",    label: foodContext.likedFoods.length > 0 ? `${foodContext.likedFoods.length} liked foods` : "No liked foods logged yet" },
						{ icon: "shield",   label: foodContext.allergensAvoid.length > 0 ? `Avoiding: ${foodContext.allergensAvoid.join(", ")}` : "No allergens to avoid" },
						{ icon: "list",     label: `${foodContext.foodsTried.length} foods tried so far` },
					].map((row, i) => (
						<View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
							<Icon name={row.icon} size={12} color={C.primaryPurple} />
							<Text style={{ fontSize: 12, color: C.mutedText, flex: 1 }}>{row.label}</Text>
						</View>
					))}
				</View>
				{!hasEnoughData && (
					<Text style={{ fontSize: 11, color: "#c2410c", fontWeight: "600", marginTop: 4 }}>
						💡 Log some meals first for more personalised ideas
					</Text>
				)}
			</View>

			{/* ── Limit reached ── */}
			{limitReached && (
				<View style={{ backgroundColor: "#fef2f2", borderRadius: 14, padding: 16, gap: 10, alignItems: "center" }}>
					<Icon name="clock" size={28} color="#c0392b" />
					<Text style={{ fontSize: 15, fontWeight: "800", color: "#c0392b", textAlign: "center" }}>
						Daily limit reached
					</Text>
					<Text style={{ fontSize: 13, color: C.mutedText, textAlign: "center", lineHeight: 19 }}>
						{isPro
							? `You've used all ${limit} of today's Smart Meal Ideas. Come back tomorrow for more!`
							: `You've used all ${limit} free ideas today. Upgrade to Pro for up to 10 ideas per day.`}
					</Text>
					{!isPro && (
						<TouchableOpacity
							onPress={onUpgradePro}
							style={{ backgroundColor: "#2d1f5e", borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}>
							<Text style={{ color: "#f5c842", fontWeight: "800", fontSize: 14 }}>Upgrade to Pro</Text>
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
					style={{
						backgroundColor: loading ? C.bgPurple : "#7c3aed",
						borderRadius: 16,
						paddingVertical: 16,
						alignItems: "center",
						flexDirection: "row",
						justifyContent: "center",
						gap: 10,
					}}>
					{loading ? (
						<>
							<ActivityIndicator size="small" color={C.primaryPurple} />
							<Text style={{ fontSize: 15, fontWeight: "800", color: C.primaryPurple }}>Generating ideas…</Text>
						</>
					) : (
						<>
							<Icon name="sparkle" size={18} color="#fff" />
							<Text style={{ fontSize: 15, fontWeight: "800", color: "#fff" }}>
								{meals.length > 0 ? "Generate new ideas" : "Generate Meal Ideas"}
							</Text>
						</>
					)}
				</TouchableOpacity>
			)}

			{/* ── Usage remaining hint ── */}
			{!limitReached && used > 0 && (
				<Text style={{ fontSize: 11, color: C.mutedText, textAlign: "center" }}>
					{limit - used} idea{limit - used !== 1 ? "s" : ""} remaining today
					{!isPro ? " · Upgrade to Pro for more" : ""}
				</Text>
			)}

			{/* ── Meal cards ── */}
			{meals.length > 0 && (
				<View style={{ gap: 14 }}>
					<Text style={{ fontSize: 13, fontWeight: "800", color: C.textCharcoal }}>
						Here are some ideas 👇 tap a card to see the full recipe
					</Text>
					{meals.map((meal, i) => (
						<MealCard key={i} meal={meal} index={i} />
					))}
				</View>
			)}

			{/* ── Disclaimer ── */}
			{disclaimer ? (
				<View style={{ backgroundColor: C.bgPurple, borderRadius: 12, padding: 14, flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
					<Icon name="info" size={14} color={C.mutedText} />
					<Text style={{ fontSize: 11, color: C.mutedText, flex: 1, lineHeight: 17 }}>{disclaimer}</Text>
				</View>
			) : (
				<View style={{ backgroundColor: C.bgPurple, borderRadius: 12, padding: 14, flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
					<Icon name="info" size={14} color={C.mutedText} />
					<Text style={{ fontSize: 11, color: C.mutedText, flex: 1, lineHeight: 17 }}>
						Smart Meal Ideas are for inspiration only and are not medical advice. Always follow safe weaning guidance and speak to a healthcare professional regarding allergies or feeding concerns.
					</Text>
				</View>
			)}

			{/* ── Powered by ── */}
			<Text style={{ fontSize: 10, color: C.mutedText, textAlign: "center" }}>
				✨ Powered by Google Gemini · safety rules enforced on every request
			</Text>
		</ScrollView>
	);
}
