import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
	View,
	Text,
	TouchableOpacity,
	ScrollView,
	TextInput,
	Modal,
	Alert,
	ActivityIndicator,
	KeyboardAvoidingView,
	Platform,
} from "react-native";
import { useTheme } from "../ThemeContext";
import { Icon } from "../components/Icon";
import { parseIngredient } from "../helpers";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DAY_KEYS  = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
const DAY_FULL  = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const DAY_SHORT = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

const MEAL_CFG = [
	{ key: "breakfast", label: "Breakfast", icon: "sun",      color: "#c2410c", bg: "#fff7ed" },
	{ key: "lunch",     label: "Lunch",     icon: "utensils", color: "#16a34a", bg: "#f0fdf4" },
	{ key: "dinner",    label: "Dinner",    icon: "moon",     color: "#7c3aed", bg: "#f5f3ff" },
	{ key: "snacks",    label: "Snacks",    icon: "leaf",     color: "#ca8a04", bg: "#fef9c3" },
];

const PANTRY_CATS = ["Vegetables","Fruits","Proteins","Grains","Dairy","Legumes","Spices","Other"];

const EXPOSURE_STAGES = [
	{ key: "touched",  label: "Touched",  emoji: "👋" },
	{ key: "tasted",   label: "Tasted",   emoji: "👅" },
	{ key: "ate",      label: "Ate some", emoji: "😋" },
	{ key: "finished", label: "Finished!", emoji: "🌟" },
];

const EXPOSURE_REACTIONS = [
	{ key: "loved",    label: "Loved",    emoji: "😍", color: "#16a34a" },
	{ key: "liked",    label: "Liked",    emoji: "😊", color: "#2563eb" },
	{ key: "neutral",  label: "Neutral",  emoji: "😐", color: "#6b7280" },
	{ key: "disliked", label: "Disliked", emoji: "😣", color: "#dc2626" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getMonday(offset = 0) {
	const d   = new Date();
	const day = d.getDay();
	d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day) + offset * 7);
	d.setHours(0, 0, 0, 0);
	return d;
}

function getWeekDays(monday) {
	const todayStr = new Date().toISOString().split("T")[0];
	return DAY_KEYS.map((key, i) => {
		const d = new Date(monday);
		d.setDate(d.getDate() + i);
		const dateStr = d.toISOString().split("T")[0];
		return {
			key,
			fullLabel:  DAY_FULL[i],
			shortLabel: DAY_SHORT[i],
			dateStr,
			day:  d.getDate(),
			month: d.toLocaleString("default", { month: "short" }),
			isToday: dateStr === todayStr,
		};
	});
}

function weekId(monday) {
	return monday.toISOString().split("T")[0];
}

function uid4() {
	return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function emptyDay() {
	return { breakfast: [], lunch: [], dinner: [], snacks: [] };
}

function emptyWeek() {
	const w = {};
	DAY_KEYS.forEach((k) => { w[k] = emptyDay(); });
	return w;
}

function computeDayScore(dayData, allRecipes) {
	const allMeals = MEAL_CFG.flatMap((m) => dayData[m.key] || []);
	if (allMeals.length === 0) return null;

	const filledSlots = MEAL_CFG.filter((m) => (dayData[m.key] || []).length > 0).length;
	const cats = new Set();
	allMeals.forEach((m) => {
		if (m.category) cats.add(m.category);
		const r = m.recipeId ? allRecipes?.find((r) => r.id === m.recipeId) : null;
		if (r?.category) cats.add(r.category);
	});

	const hasProtein = ["Proteins","Fish","Eggs","Legumes","Dairy"].some((c) => cats.has(c));
	const hasVeg     = cats.has("Vegetables");
	const hasFruit   = cats.has("Fruits");

	if (filledSlots >= 3 && hasProtein && hasVeg) {
		return { text: "🟢 Great variety today",         color: "#16a34a", bg: "#f0fdf4" };
	}
	if (filledSlots >= 2 && !hasVeg && !hasFruit) {
		return { text: "🟡 More vegetables recommended", color: "#ca8a04", bg: "#fef9c3" };
	}
	if (filledSlots >= 2 && !hasProtein) {
		return { text: "🔴 Iron-rich foods missing",      color: "#dc2626", bg: "#fef2f2" };
	}
	if (filledSlots >= 2) {
		return { text: "🟡 Good start — add more variety", color: "#ca8a04", bg: "#fef9c3" };
	}
	return { text: "⚪ Plan your meals for today",       color: "#9ca3af", bg: "#f9fafb" };
}

function formatWeekLabel(weekDays) {
	const start = weekDays[0];
	const end   = weekDays[6];
	if (start.month === end.month) {
		return `${start.day}–${end.day} ${start.month}`;
	}
	return `${start.day} ${start.month} – ${end.day} ${end.month}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// AddMealModal
// ─────────────────────────────────────────────────────────────────────────────

function AddMealModal({ visible, onClose, onAdd, recipes, smartRecipes, mealCfg }) {
	const { C } = useTheme();
	const [tab, setTab]               = useState("recipes");
	const [search, setSearch]         = useState("");
	const [customName, setCustomName] = useState("");
	const [customCats, setCustomCats] = useState(["Grains"]);

	const toggleCat = (cat) => {
		setCustomCats((prev) =>
			prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
		);
	};

	useEffect(() => {
		if (visible) { setTab("recipes"); setSearch(""); setCustomName(""); setCustomCats(["Grains"]); }
	}, [visible]);

	const filtered = useMemo(() => {
		const q   = search.trim().toLowerCase();
		const all = [
			...(recipes    || []).map((r) => ({ ...r, _source: "recipe" })),
			...(smartRecipes || []).map((r) => ({ ...r, _source: "smart" })),
		];
		if (!q) return all.slice(0, 60);
		return all.filter((r) => r.title?.toLowerCase().includes(q)).slice(0, 60);
	}, [recipes, smartRecipes, search]);

	const handleAddRecipe = (recipe) => {
		onAdd({
			id:          uid4(),
			type:        recipe._source,
			recipeId:    recipe.id,
			title:       recipe.title,
			category:    recipe.category || "",
			ingredients: recipe.ingredients || [],
		});
		onClose();
	};

	const handleAddCustom = () => {
		if (!customName.trim()) return;
		onAdd({
			id:          uid4(),
			type:        "custom",
			title:       customName.trim(),
			category:    customCats[0] || "Other",
			categories:  customCats,
			ingredients: [],
		});
		setCustomName("");
		onClose();
	};

	const mealLabel = mealCfg ? mealCfg.label : "Meal";

	return (
		<Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
			<View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
				<KeyboardAvoidingView
					behavior={Platform.OS === "ios" ? "padding" : "height"}
					style={{ flex: 1, justifyContent: "flex-end" }}>
					<View
						style={{
							backgroundColor: C.white,
							borderTopLeftRadius: 28,
							borderTopRightRadius: 28,
							height: "92%",
							overflow: "hidden",
						}}>

						{/* Handle bar */}
						<View style={{ width: 36, height: 4, backgroundColor: C.borderLight, borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 4 }} />

						{/* Header */}
						<View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 }}>
							<View>
								<Text style={{ fontSize: 20, fontWeight: "800", color: C.primaryPinkDark }}>
									Add {mealLabel}
								</Text>
								{mealCfg && (
									<View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 }}>
										<View style={{ width: 18, height: 18, borderRadius: 5, backgroundColor: mealCfg.bg, alignItems: "center", justifyContent: "center" }}>
											<Icon name={mealCfg.icon} size={10} color={mealCfg.color} />
										</View>
										<Text style={{ fontSize: 12, color: C.mutedText, fontWeight: "600" }}>{mealCfg.label}</Text>
									</View>
								)}
							</View>
							<TouchableOpacity
								onPress={onClose}
								style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.bgPurple, alignItems: "center", justifyContent: "center" }}>
								<Icon name="close" size={14} color={C.primaryPurple} />
							</TouchableOpacity>
						</View>

						{/* Tab switcher */}
						<View
							style={{
								flexDirection: "row",
								backgroundColor: C.bgPurple,
								borderRadius: 14,
								padding: 4,
								marginHorizontal: 20,
								marginTop: 14,
								marginBottom: 14,
							}}>
							{[
								{ key: "recipes", label: "From Recipes" },
								{ key: "custom",  label: "Custom Meal" },
							].map((t) => (
								<TouchableOpacity
									key={t.key}
									onPress={() => setTab(t.key)}
									style={{
										flex: 1,
										paddingVertical: 10,
										borderRadius: 11,
										backgroundColor: tab === t.key ? C.white : "transparent",
										alignItems: "center",
										shadowColor: "#000",
										shadowOpacity: tab === t.key ? 0.06 : 0,
										shadowRadius: 4,
										elevation: tab === t.key ? 2 : 0,
									}}>
									<Text
										style={{
											fontSize: 13,
											fontWeight: "700",
											color: tab === t.key ? C.primaryPurple : C.mutedText,
										}}>
										{t.label}
									</Text>
								</TouchableOpacity>
							))}
						</View>

						{/* Content area — fills remaining space */}
						<View style={{ flex: 1, paddingHorizontal: 20, overflow: "hidden" }}>

							{/* Recipes tab */}
							{tab === "recipes" && (
								<View style={{ flex: 1 }}>
									<View
										style={{
											flexDirection: "row",
											alignItems: "center",
											backgroundColor: C.bgPurple,
											borderRadius: 12,
											paddingHorizontal: 12,
											marginBottom: 12,
										}}>
										<Icon name="search" size={15} color={C.mutedText} />
										<TextInput
											value={search}
											onChangeText={setSearch}
											placeholder="Search recipes and smart recipes..."
											placeholderTextColor={C.mutedText}
											style={{ flex: 1, paddingVertical: 12, paddingLeft: 8, fontSize: 14, color: C.textCharcoal }}
										/>
										{search.length > 0 && (
											<TouchableOpacity onPress={() => setSearch("")}>
												<Icon name="close" size={13} color={C.mutedText} />
											</TouchableOpacity>
										)}
									</View>
									<ScrollView
										style={{ flex: 1 }}
										showsVerticalScrollIndicator={false}
										contentContainerStyle={{ paddingBottom: 32 }}>
										{filtered.length === 0 ? (
											<Text style={{ textAlign: "center", color: C.mutedText, paddingVertical: 24, fontSize: 13 }}>
												No recipes found
											</Text>
										) : (
											filtered.map((r) => (
												<TouchableOpacity
													key={`${r._source}-${r.id}`}
													onPress={() => handleAddRecipe(r)}
													activeOpacity={0.75}
													style={{
														flexDirection: "row",
														alignItems: "center",
														paddingVertical: 14,
														borderBottomWidth: 1,
														borderBottomColor: C.borderLight,
														gap: 10,
													}}>
													<View style={{ flex: 1 }}>
														<View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
															<Text
																style={{ fontSize: 14, fontWeight: "700", color: C.textCharcoal, flex: 1 }}
																numberOfLines={1}>
																{r.title}
															</Text>
															{r._source === "smart" && (
																<View style={{ backgroundColor: "#fdf4ff", borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 }}>
																	<Text style={{ fontSize: 9, fontWeight: "800", color: "#9333ea" }}>AI</Text>
																</View>
															)}
														</View>
														{r.category && (
															<Text style={{ fontSize: 11, color: C.mutedText }}>{r.category}</Text>
														)}
													</View>
													<View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: C.bgPurple, alignItems: "center", justifyContent: "center" }}>
														<Icon name="plus" size={15} color={C.primaryPurple} />
													</View>
												</TouchableOpacity>
											))
										)}
									</ScrollView>
								</View>
							)}

							{/* Custom tab */}
							{tab === "custom" && (
								<View style={{ flex: 1 }}>
									<ScrollView
										style={{ flex: 1 }}
										showsVerticalScrollIndicator={false}
										keyboardShouldPersistTaps="handled"
										contentContainerStyle={{ gap: 20, paddingBottom: 16 }}>
										<View>
											<Text style={{ fontSize: 11, fontWeight: "800", color: C.mutedText, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
												Meal Name *
											</Text>
											<TextInput
												value={customName}
												onChangeText={setCustomName}
												placeholder="e.g. Banana porridge with blueberries"
												placeholderTextColor={C.mutedText}
												style={{
													backgroundColor: C.bgPurple,
													borderRadius: 14,
													padding: 16,
													fontSize: 15,
													color: C.textCharcoal,
												}}
											/>
										</View>
										<View>
											<Text style={{ fontSize: 11, fontWeight: "800", color: C.mutedText, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
												Food Categories{" "}
												<Text style={{ fontWeight: "500", fontSize: 11, textTransform: "none" }}>(select all that apply)</Text>
											</Text>
											<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
												{["Grains","Proteins","Vegetables","Fruits","Dairy","Legumes","Fish","Eggs","Other"].map((cat) => {
													const selected = customCats.includes(cat);
													return (
														<TouchableOpacity
															key={cat}
															onPress={() => toggleCat(cat)}
															style={{
																paddingHorizontal: 14,
																paddingVertical: 10,
																borderRadius: 22,
																backgroundColor: selected ? C.primaryPurple : C.bgPurple,
																borderWidth: selected ? 0 : 1.5,
																borderColor: C.borderLight,
																flexDirection: "row",
																alignItems: "center",
																gap: 5,
															}}>
															{selected && <Icon name="check" size={11} color={C.white} />}
															<Text style={{ fontSize: 13, fontWeight: "700", color: selected ? C.white : C.mutedText }}>
																{cat}
															</Text>
														</TouchableOpacity>
													);
												})}
											</View>
										</View>
									</ScrollView>
									{/* Sticky "Add to Plan" button */}
									<TouchableOpacity
										onPress={handleAddCustom}
										disabled={!customName.trim()}
										style={{
											backgroundColor: customName.trim() ? C.primaryPurple : C.borderLight,
											borderRadius: 16,
											paddingVertical: 17,
											alignItems: "center",
											marginTop: 10,
											marginBottom: 36,
										}}>
										<Text style={{ color: C.white, fontWeight: "800", fontSize: 15 }}>
											Add to Plan
										</Text>
									</TouchableOpacity>
								</View>
							)}
						</View>
					</View>
				</KeyboardAvoidingView>
			</View>
		</Modal>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// GenerateOptionsModal — customise AI generation before triggering
// ─────────────────────────────────────────────────────────────────────────────

function GenerateOptionsModal({ visible, onClose, onGenerate, childName }) {
	const { C } = useTheme();
	const [selectedDays, setSelectedDays] = useState([...DAY_KEYS]);
	const [prefs, setPrefs]               = useState("");
	const [dislikes, setDislikes]         = useState("");

	useEffect(() => {
		if (visible) { setSelectedDays([...DAY_KEYS]); setPrefs(""); setDislikes(""); }
	}, [visible]);

	const toggleDay = (day) => {
		setSelectedDays((prev) =>
			prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
		);
	};

	const handleGenerate = () => {
		if (selectedDays.length === 0) {
			Alert.alert("Select days", "Please choose at least one day to generate meals for.");
			return;
		}
		onGenerate({
			daysToGenerate:        selectedDays,
			additionalPreferences: prefs.trim(),
			dislikedFoods:         dislikes
				.split(",")
				.map((s) => s.trim())
				.filter(Boolean)
				.slice(0, 20),
		});
		onClose();
	};

	const btnLabel =
		selectedDays.length === 7
			? "Generate Full Week Plan"
			: selectedDays.length === 0
			? "Select at least one day"
			: `Generate ${selectedDays.length} Day${selectedDays.length !== 1 ? "s" : ""}`;

	return (
		<Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
			<TouchableOpacity
				style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }}
				onPress={onClose}
				activeOpacity={1}>
				<View style={{ flex: 1, justifyContent: "flex-end" }}>
					<TouchableOpacity activeOpacity={1}>
						<KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
							<ScrollView
								keyboardShouldPersistTaps="handled"
								contentContainerStyle={{
									backgroundColor: C.white,
									borderTopLeftRadius: 28,
									borderTopRightRadius: 28,
									padding: 24,
									paddingBottom: 44,
								}}>
								{/* Handle bar */}
								<View style={{ width: 36, height: 4, backgroundColor: C.borderLight, borderRadius: 2, alignSelf: "center", marginBottom: 22 }} />

								{/* Header */}
								<View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
									<View style={{ flex: 1 }}>
										<Text style={{ fontSize: 20, fontWeight: "800", color: C.primaryPinkDark }}>
											Customise AI Plan ✨
										</Text>
										<Text style={{ fontSize: 13, color: C.mutedText, marginTop: 4 }}>
											Personalise the week for {childName || "your baby"}
										</Text>
									</View>
									<TouchableOpacity
										onPress={onClose}
										style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.bgPurple, alignItems: "center", justifyContent: "center", marginLeft: 12 }}>
										<Icon name="close" size={14} color={C.primaryPurple} />
									</TouchableOpacity>
								</View>

								{/* Days */}
								<Text style={{ fontSize: 11, fontWeight: "800", color: C.mutedText, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
									Days to generate
								</Text>
								<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 22 }}>
									{DAY_KEYS.map((day, i) => {
										const sel = selectedDays.includes(day);
										return (
											<TouchableOpacity
												key={day}
												onPress={() => toggleDay(day)}
												style={{
													paddingHorizontal: 13,
													paddingVertical: 9,
													borderRadius: 11,
													backgroundColor: sel ? C.primaryPurple : C.bgPurple,
													flexDirection: "row",
													alignItems: "center",
													gap: 4,
												}}>
												{sel && <Icon name="check" size={10} color={C.white} />}
												<Text style={{ fontSize: 12, fontWeight: "700", color: sel ? C.white : C.mutedText }}>
													{DAY_SHORT[i]}
												</Text>
											</TouchableOpacity>
										);
									})}
								</View>

								{/* Preferences */}
								<Text style={{ fontSize: 11, fontWeight: "800", color: C.mutedText, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
									Preferences (optional)
								</Text>
								<TextInput
									value={prefs}
									onChangeText={setPrefs}
									placeholder="e.g. More finger foods, pasta dishes, batch cooking ideas…"
									placeholderTextColor={C.mutedText}
									multiline
									style={{
										backgroundColor: C.bgPurple,
										borderRadius: 12,
										padding: 14,
										fontSize: 13,
										color: C.textCharcoal,
										marginBottom: 18,
										minHeight: 56,
										textAlignVertical: "top",
									}}
								/>

								{/* Dislikes */}
								<Text style={{ fontSize: 11, fontWeight: "800", color: C.mutedText, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
									Skip this week (optional)
								</Text>
								<TextInput
									value={dislikes}
									onChangeText={setDislikes}
									placeholder="e.g. No eggs, skip fish, less bread (comma separated)"
									placeholderTextColor={C.mutedText}
									style={{
										backgroundColor: C.bgPurple,
										borderRadius: 12,
										padding: 14,
										fontSize: 13,
										color: C.textCharcoal,
										marginBottom: 18,
									}}
								/>

								{/* Info note */}
								<View style={{ backgroundColor: "#f0fdf4", borderRadius: 12, padding: 12, marginBottom: 22, flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
									<Text style={{ fontSize: 18 }}>💡</Text>
									<Text style={{ flex: 1, fontSize: 12, color: "#166534", lineHeight: 17 }}>
										Pantry items, liked foods, age, and allergens from {childName || "baby"}'s profile are used automatically.
									</Text>
								</View>

								{/* Generate button */}
								<TouchableOpacity
									onPress={handleGenerate}
									disabled={selectedDays.length === 0}
									style={{
										backgroundColor: selectedDays.length === 0 ? C.borderLight : C.primaryPurple,
										borderRadius: 16,
										paddingVertical: 17,
										alignItems: "center",
										flexDirection: "row",
										justifyContent: "center",
										gap: 8,
									}}>
									<Icon name="sparkle" size={16} color="#fff" />
									<Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>
										{btnLabel}
									</Text>
								</TouchableOpacity>
							</ScrollView>
						</KeyboardAvoidingView>
					</TouchableOpacity>
				</View>
			</TouchableOpacity>
		</Modal>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// MealEatenModal — reaction picker for logging an eaten meal to the food diary
// ─────────────────────────────────────────────────────────────────────────────

function MealEatenModal({ visible, meal, child, onClose, onLog }) {
	const { C } = useTheme();
	if (!meal) return null;

	const REACTIONS = [
		{ key: "Loved", emoji: "😍", label: "Loved it!",     color: "#16a34a", bg: "#f0fdf4" },
		{ key: "Good",  emoji: "😊", label: "Liked it",      color: "#2563eb", bg: "#dbeafe" },
		{ key: "OK",    emoji: "😐", label: "Just OK",       color: "#6b7280", bg: "#f9fafb" },
		{ key: "Bad",   emoji: "😣", label: "Didn't like",   color: "#dc2626", bg: "#fef2f2" },
	];

	return (
		<Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
			<TouchableOpacity
				style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }}
				onPress={onClose}
				activeOpacity={1}>
				<View style={{ flex: 1, justifyContent: "flex-end" }}>
					<TouchableOpacity activeOpacity={1}>
						<View
							style={{
								backgroundColor: C.white,
								borderTopLeftRadius: 28,
								borderTopRightRadius: 28,
								padding: 24,
								paddingBottom: 44,
							}}>
							{/* Handle bar */}
							<View style={{ width: 36, height: 4, backgroundColor: C.borderLight, borderRadius: 2, alignSelf: "center", marginBottom: 22 }} />

							<Text style={{ fontSize: 20, fontWeight: "800", color: C.primaryPinkDark, marginBottom: 4 }}>
								How did it go? 🍽️
							</Text>
							<Text style={{ fontSize: 13, color: C.mutedText, marginBottom: 22 }} numberOfLines={2}>
								Log "{meal.title}" to {child?.name || "baby"}'s diary
							</Text>

							<View style={{ gap: 10, marginBottom: 18 }}>
								{REACTIONS.map((r) => (
									<TouchableOpacity
										key={r.key}
										onPress={() => onLog(r.key)}
										activeOpacity={0.82}
										style={{
											flexDirection: "row",
											alignItems: "center",
											backgroundColor: r.bg,
											borderRadius: 14,
											paddingHorizontal: 18,
											paddingVertical: 15,
											gap: 14,
										}}>
										<Text style={{ fontSize: 26 }}>{r.emoji}</Text>
										<Text style={{ flex: 1, fontSize: 15, fontWeight: "800", color: r.color }}>
											{r.label}
										</Text>
										<Icon name="chevRight" size={14} color={r.color} />
									</TouchableOpacity>
								))}
							</View>

							<TouchableOpacity onPress={() => onLog(null)} style={{ alignItems: "center", paddingVertical: 8 }}>
								<Text style={{ fontSize: 13, color: C.mutedText, fontWeight: "600" }}>
									Just mark as eaten (skip diary)
								</Text>
							</TouchableOpacity>
						</View>
					</TouchableOpacity>
				</View>
			</TouchableOpacity>
		</Modal>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// ExposureModal
// ─────────────────────────────────────────────────────────────────────────────

function ExposureModal({ visible, onClose, onSave }) {
	const { C } = useTheme();
	const [foodName, setFoodName] = useState("");
	const [stage, setStage]       = useState("tasted");
	const [reaction, setReaction] = useState("liked");
	const [saving, setSaving]     = useState(false);

	useEffect(() => {
		if (visible) { setFoodName(""); setStage("tasted"); setReaction("liked"); }
	}, [visible]);

	const handleSave = async () => {
		if (!foodName.trim()) return;
		setSaving(true);
		await onSave({ foodName: foodName.trim(), stage, reaction });
		setSaving(false);
	};

	return (
		<Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
			<View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
				<KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
					<View
						style={{
							backgroundColor: C.white,
							borderTopLeftRadius: 28,
							borderTopRightRadius: 28,
							padding: 24,
							paddingBottom: 44,
						}}>
						<View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
							<Text style={{ fontSize: 18, fontWeight: "800", color: C.primaryPinkDark }}>
								Log Food Exposure
							</Text>
							<TouchableOpacity
								onPress={onClose}
								style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.bgPurple, alignItems: "center", justifyContent: "center" }}>
								<Icon name="close" size={14} color={C.primaryPurple} />
							</TouchableOpacity>
						</View>

						<Text style={{ fontSize: 12, fontWeight: "700", color: C.mutedText, marginBottom: 6 }}>
							Food or Meal *
						</Text>
						<TextInput
							value={foodName}
							onChangeText={setFoodName}
							placeholder="e.g. Broccoli, Scrambled egg, Avocado..."
							placeholderTextColor={C.mutedText}
							style={{
								backgroundColor: C.bgPurple,
								borderRadius: 12,
								padding: 14,
								fontSize: 14,
								color: C.textCharcoal,
								marginBottom: 18,
							}}
						/>

						<Text style={{ fontSize: 12, fontWeight: "700", color: C.mutedText, marginBottom: 8 }}>
							What happened?
						</Text>
						<View style={{ flexDirection: "row", gap: 8, marginBottom: 18 }}>
							{EXPOSURE_STAGES.map((s) => (
								<TouchableOpacity
									key={s.key}
									onPress={() => setStage(s.key)}
									style={{
										flex: 1,
										alignItems: "center",
										paddingVertical: 12,
										borderRadius: 12,
										backgroundColor: stage === s.key ? C.primaryPurple : C.bgPurple,
										gap: 4,
									}}>
									<Text style={{ fontSize: 18 }}>{s.emoji}</Text>
									<Text
										style={{
											fontSize: 9,
											fontWeight: "700",
											color: stage === s.key ? C.white : C.mutedText,
											textAlign: "center",
										}}>
										{s.label}
									</Text>
								</TouchableOpacity>
							))}
						</View>

						<Text style={{ fontSize: 12, fontWeight: "700", color: C.mutedText, marginBottom: 8 }}>
							Reaction
						</Text>
						<View style={{ flexDirection: "row", gap: 8, marginBottom: 22 }}>
							{EXPOSURE_REACTIONS.map((r) => (
								<TouchableOpacity
									key={r.key}
									onPress={() => setReaction(r.key)}
									style={{
										flex: 1,
										alignItems: "center",
										paddingVertical: 12,
										borderRadius: 12,
										backgroundColor: reaction === r.key ? r.color + "18" : C.bgPurple,
										borderWidth: reaction === r.key ? 1.5 : 0,
										borderColor: reaction === r.key ? r.color : "transparent",
										gap: 4,
									}}>
									<Text style={{ fontSize: 18 }}>{r.emoji}</Text>
									<Text
										style={{
											fontSize: 9,
											fontWeight: "700",
											color: reaction === r.key ? r.color : C.mutedText,
											textAlign: "center",
										}}>
										{r.label}
									</Text>
								</TouchableOpacity>
							))}
						</View>

						<TouchableOpacity
							onPress={handleSave}
							disabled={!foodName.trim() || saving}
							style={{
								backgroundColor: foodName.trim() ? C.primaryPurple : C.borderLight,
								borderRadius: 16,
								paddingVertical: 16,
								alignItems: "center",
							}}>
							{saving ? (
								<ActivityIndicator color="#fff" />
							) : (
								<Text style={{ color: C.white, fontWeight: "800", fontSize: 15 }}>
									Log Exposure
								</Text>
							)}
						</TouchableOpacity>
					</View>
				</KeyboardAvoidingView>
			</View>
		</Modal>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// ShoppingPreviewModal
// ─────────────────────────────────────────────────────────────────────────────

function ShoppingPreviewModal({ visible, onClose, onConfirm, items, adding }) {
	const { C } = useTheme();

	const total = items.reduce((n, r) => n + r.ingredients.length, 0);

	return (
		<Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
			<View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
				<View
					style={{
						backgroundColor: C.white,
						borderTopLeftRadius: 28,
						borderTopRightRadius: 28,
						maxHeight: "80%",
						paddingHorizontal: 20,
						paddingTop: 20,
						paddingBottom: 36,
					}}>
					{/* Header */}
					<View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
						<View>
							<Text style={{ fontSize: 18, fontWeight: "800", color: C.primaryPinkDark }}>
								Add to Shopping List
							</Text>
							<Text style={{ fontSize: 12, color: C.mutedText, marginTop: 2 }}>
								{total} ingredient{total !== 1 ? "s" : ""} from {items.length} meal{items.length !== 1 ? "s" : ""}
							</Text>
						</View>
						<TouchableOpacity
							onPress={onClose}
							style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.bgPurple, alignItems: "center", justifyContent: "center" }}>
							<Icon name="close" size={14} color={C.primaryPurple} />
						</TouchableOpacity>
					</View>

					<ScrollView showsVerticalScrollIndicator={false} style={{ marginVertical: 14 }}>
						{items.map((recipe, ri) => (
							<View key={ri} style={{ marginBottom: 14 }}>
								<Text style={{ fontSize: 11, fontWeight: "800", color: C.mutedText, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
									{recipe.title}
								</Text>
								{recipe.ingredients.map((ing, ii) => {
									const parsed = parseIngredient(ing);
									return (
										<View
											key={ii}
											style={{
												flexDirection: "row",
												alignItems: "center",
												paddingVertical: 8,
												borderBottomWidth: 1,
												borderBottomColor: C.borderLight,
												gap: 10,
											}}>
											<View
												style={{
													width: 6,
													height: 6,
													borderRadius: 3,
													backgroundColor: C.primaryPurple,
												}}
											/>
											<Text style={{ flex: 1, fontSize: 13, fontWeight: "600", color: C.textCharcoal }}>
												{parsed.name}
											</Text>
											{parsed.quantity ? (
												<Text style={{ fontSize: 12, color: C.mutedText }}>{parsed.quantity}</Text>
											) : null}
										</View>
									);
								})}
							</View>
						))}
					</ScrollView>

					<TouchableOpacity
						onPress={onConfirm}
						disabled={adding}
						activeOpacity={0.85}
						style={{
							backgroundColor: C.primaryPurple,
							borderRadius: 16,
							paddingVertical: 16,
							alignItems: "center",
							flexDirection: "row",
							justifyContent: "center",
							gap: 8,
						}}>
						{adding ? (
							<ActivityIndicator color="#fff" />
						) : (
							<>
								<Icon name="cart" size={16} color="#fff" />
								<Text style={{ color: C.white, fontWeight: "800", fontSize: 15 }}>
									Add All &amp; Open Shopping List
								</Text>
							</>
						)}
					</TouchableOpacity>
				</View>
			</View>
		</Modal>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// MealSection — one meal type within a day card
// ─────────────────────────────────────────────────────────────────────────────

function MealSection({ config, meals, onAdd, onRemove, onMarkEaten }) {
	const { C } = useTheme();
	return (
		<View>
			<View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
				<View
					style={{
						width: 28,
						height: 28,
						borderRadius: 8,
						backgroundColor: config.bg,
						alignItems: "center",
						justifyContent: "center",
					}}>
					<Icon name={config.icon} size={13} color={config.color} />
				</View>
				<Text style={{ fontSize: 12, fontWeight: "800", color: C.textCharcoal, flex: 1 }}>
					{config.label}
				</Text>
				<TouchableOpacity
					onPress={onAdd}
					style={{
						width: 24,
						height: 24,
						borderRadius: 8,
						backgroundColor: C.bgPurple,
						alignItems: "center",
						justifyContent: "center",
					}}>
					<Icon name="plus" size={12} color={C.primaryPurple} />
				</TouchableOpacity>
			</View>

			{meals.length === 0 ? (
				<TouchableOpacity
					onPress={onAdd}
					activeOpacity={0.65}
					style={{
						borderWidth: 1.5,
						borderColor: C.borderLight,
						borderStyle: "dashed",
						borderRadius: 10,
						paddingVertical: 10,
						alignItems: "center",
					}}>
					<Text style={{ fontSize: 11, color: C.mutedText }}>
						+ Add {config.label.toLowerCase()}
					</Text>
				</TouchableOpacity>
			) : (
				<View style={{ gap: 6 }}>
					{meals.map((meal) => (
						<View
							key={meal.id}
							style={{
								flexDirection: "row",
								alignItems: "center",
								backgroundColor: meal.eaten ? "#f0fdf4" : config.bg,
								borderRadius: 10,
								paddingHorizontal: 10,
								paddingVertical: 9,
								gap: 8,
								borderWidth: meal.eaten ? 1 : 0,
								borderColor: meal.eaten ? "#bbf7d0" : "transparent",
							}}>
							{/* Eaten checkmark */}
							<TouchableOpacity
								onPress={() => onMarkEaten && onMarkEaten(meal)}
								hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
								style={{
									width: 20,
									height: 20,
									borderRadius: 10,
									borderWidth: 1.5,
									borderColor: meal.eaten ? "#16a34a" : "#d1d5db",
									backgroundColor: meal.eaten ? "#16a34a" : "transparent",
									alignItems: "center",
									justifyContent: "center",
									flexShrink: 0,
								}}>
								{meal.eaten && <Icon name="check" size={9} color="#fff" />}
							</TouchableOpacity>

							{meal.isLeftover && (
								<View style={{ backgroundColor: "#fef9c3", borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 }}>
									<Text style={{ fontSize: 7, fontWeight: "800", color: "#92400e", letterSpacing: 0.3 }}>LEFTOVER</Text>
								</View>
							)}
							{(meal.type === "ai" || meal.type === "smart") && !meal.isLeftover && (
								<View style={{ backgroundColor: "#fdf4ff", borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 }}>
									<Text style={{ fontSize: 7, fontWeight: "800", color: "#9333ea" }}>AI</Text>
								</View>
							)}
							<Text
								style={{
									flex: 1,
									fontSize: 12,
									fontWeight: "600",
									color: meal.eaten ? "#16a34a" : C.textCharcoal,
									textDecorationLine: meal.eaten ? "line-through" : "none",
								}}
								numberOfLines={2}>
								{meal.title}
							</Text>
							<TouchableOpacity
								onPress={() => onRemove(meal.id)}
								hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
								<Icon name="close" size={12} color={C.mutedText} />
							</TouchableOpacity>
						</View>
					))}
					<TouchableOpacity
						onPress={onAdd}
						activeOpacity={0.7}
						style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingLeft: 2, paddingTop: 2 }}>
						<Icon name="plus" size={11} color={C.primaryPurple} />
						<Text style={{ fontSize: 11, color: C.primaryPurple, fontWeight: "600" }}>
							Add another
						</Text>
					</TouchableOpacity>
				</View>
			)}
		</View>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// DayCard
// ─────────────────────────────────────────────────────────────────────────────

function DayCard({ day, dayData, onAddMeal, onRemoveMeal, onMarkEaten, recipes, defaultExpanded }) {
	const { C } = useTheme();
	const [expanded, setExpanded] = useState(defaultExpanded);
	const score = useMemo(() => computeDayScore(dayData, recipes), [dayData, recipes]);

	return (
		<View
			style={{
				backgroundColor: C.white,
				borderRadius: 20,
				overflow: "hidden",
				shadowColor: "#9b7fe8",
				shadowOpacity: 0.08,
				shadowRadius: 12,
				shadowOffset: { width: 0, height: 4 },
				elevation: 3,
			}}>
			{/* Collapsed header */}
			<TouchableOpacity
				onPress={() => setExpanded((e) => !e)}
				activeOpacity={0.8}
				style={{
					flexDirection: "row",
					alignItems: "center",
					padding: 14,
					gap: 12,
				}}>
				{/* Day bubble */}
				<View
					style={{
						width: 46,
						height: 46,
						borderRadius: 13,
						backgroundColor: day.isToday ? C.primaryPurple : C.bgPurple,
						alignItems: "center",
						justifyContent: "center",
					}}>
					<Text
						style={{
							fontSize: 9,
							fontWeight: "700",
							color: day.isToday ? "rgba(255,255,255,0.75)" : C.mutedText,
							marginBottom: 1,
						}}>
						{day.shortLabel}
					</Text>
					<Text
						style={{
							fontSize: 16,
							fontWeight: "900",
							color: day.isToday ? C.white : C.textCharcoal,
						}}>
						{day.day}
					</Text>
				</View>

				<View style={{ flex: 1 }}>
					<Text style={{ fontSize: 15, fontWeight: "800", color: C.textCharcoal }}>
						{day.fullLabel}
					</Text>
					{score ? (
						<View
							style={{
								backgroundColor: score.bg,
								borderRadius: 999,
								paddingHorizontal: 8,
								paddingVertical: 3,
								alignSelf: "flex-start",
								marginTop: 4,
							}}>
							<Text style={{ fontSize: 10, fontWeight: "700", color: score.color }}>
								{score.text}
							</Text>
						</View>
					) : (
						<Text style={{ fontSize: 11, color: C.mutedText, marginTop: 2 }}>
							No meals planned yet
						</Text>
					)}
				</View>

				{/* Meal count pill */}
				{(() => {
					const total = MEAL_CFG.reduce((n, m) => n + (dayData[m.key]?.length || 0), 0);
					if (total === 0) return null;
					return (
						<View
							style={{
								backgroundColor: C.primaryPurple + "18",
								borderRadius: 999,
								paddingHorizontal: 9,
								paddingVertical: 4,
								marginRight: 4,
							}}>
							<Text style={{ fontSize: 11, fontWeight: "700", color: C.primaryPurple }}>
								{total}
							</Text>
						</View>
					);
				})()}

				<View style={{ transform: [{ rotate: expanded ? "90deg" : "0deg" }] }}>
					<Icon name="chevRight" size={15} color={C.mutedText} />
				</View>
			</TouchableOpacity>

			{/* Expanded content */}
			{expanded && (
				<View
					style={{
						borderTopWidth: 1,
						borderTopColor: C.borderLight,
						paddingHorizontal: 14,
						paddingBottom: 16,
						paddingTop: 12,
						gap: 14,
					}}>
					{MEAL_CFG.map((cfg) => (
						<MealSection
							key={cfg.key}
							config={cfg}
							meals={dayData[cfg.key] || []}
							onAdd={() => onAddMeal(cfg.key)}
							onRemove={(mealId) => onRemoveMeal(cfg.key, mealId)}
							onMarkEaten={(meal) => onMarkEaten && onMarkEaten(cfg.key, meal)}
						/>
					))}
				</View>
			)}
		</View>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// PlanTab
// ─────────────────────────────────────────────────────────────────────────────

function PlanTab({
	weekDays,
	planDays,
	weekOffset,
	setWeekOffset,
	planLoading,
	generating,
	onGenerate,
	onAddMeal,
	onRemoveMeal,
	onMarkEaten,
	onReset,
	onAddToShoppingList,
	recipes,
	isPro,
}) {
	const { C } = useTheme();
	const weekLabel = formatWeekLabel(weekDays);
	const weekOffsetLabel =
		weekOffset === 0  ? "This Week"
		: weekOffset === -1 ? "Last Week"
		: weekOffset === 1  ? "Next Week"
		: weekOffset > 0    ? `${weekOffset} weeks ahead`
		:                     `${Math.abs(weekOffset)} weeks ago`;

	return (
		<View style={{ flex: 1 }}>
			{/* Week selector */}
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					marginBottom: 14,
				}}>
				<TouchableOpacity
					onPress={() => setWeekOffset((o) => o - 1)}
					style={{
						width: 38,
						height: 38,
						borderRadius: 12,
						backgroundColor: C.bgPurple,
						alignItems: "center",
						justifyContent: "center",
					}}>
					<View style={{ transform: [{ rotate: "180deg" }] }}>
						<Icon name="chevRight" size={16} color={C.primaryPurple} />
					</View>
				</TouchableOpacity>

				<View style={{ alignItems: "center" }}>
					<Text style={{ fontSize: 15, fontWeight: "800", color: C.textCharcoal }}>
						{weekLabel}
					</Text>
					<Text style={{ fontSize: 10, color: C.mutedText, fontWeight: "600", marginTop: 1 }}>
						{weekOffsetLabel}
					</Text>
					{onReset && (
						<TouchableOpacity onPress={onReset} style={{ marginTop: 4 }}>
							<Text style={{ fontSize: 10, color: "#dc2626", fontWeight: "600" }}>
								Reset week
							</Text>
						</TouchableOpacity>
					)}
				</View>

				<TouchableOpacity
					onPress={() => setWeekOffset((o) => o + 1)}
					style={{
						width: 38,
						height: 38,
						borderRadius: 12,
						backgroundColor: C.bgPurple,
						alignItems: "center",
						justifyContent: "center",
					}}>
					<Icon name="chevRight" size={16} color={C.primaryPurple} />
				</TouchableOpacity>
			</View>

			{/* AI Generate button */}
			<TouchableOpacity
				onPress={onGenerate}
				disabled={generating}
				activeOpacity={0.85}
				style={{
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "center",
					gap: 8,
					backgroundColor: isPro ? "#7c3aed" : "#f5f3ff",
					borderRadius: 16,
					paddingVertical: 14,
					marginBottom: 14,
					opacity: generating ? 0.75 : 1,
					borderWidth: isPro ? 0 : 1.5,
					borderColor: "#7c3aed",
				}}>
				{generating ? (
					<>
						<ActivityIndicator color={isPro ? "#fff" : "#7c3aed"} size="small" />
						<Text style={{ fontSize: 14, fontWeight: "800", color: isPro ? "#fff" : "#7c3aed" }}>
							Generating your plan…
						</Text>
					</>
				) : (
					<>
						<Icon name="sparkle" size={18} color={isPro ? "#fff" : "#7c3aed"} />
						<Text style={{ fontSize: 14, fontWeight: "800", color: isPro ? "#fff" : "#7c3aed" }}>
							{isPro ? "Customise & Generate AI Plan ✨" : "Generate AI Week Plan — Pro ✨"}
						</Text>
					</>
				)}
			</TouchableOpacity>

			{planLoading ? (
				<View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
					<ActivityIndicator color={C.primaryPurple} />
					<Text style={{ fontSize: 12, color: C.mutedText, marginTop: 10 }}>Loading your plan…</Text>
				</View>
			) : (
				<ScrollView
					showsVerticalScrollIndicator={false}
					contentContainerStyle={{ paddingBottom: 32, gap: 12 }}>
					{weekDays.map((day) => (
						<DayCard
							key={day.key}
							day={day}
							dayData={planDays[day.key] || emptyDay()}
							onAddMeal={(mealType) => onAddMeal(day.key, mealType)}
							onRemoveMeal={(mealType, mealId) => onRemoveMeal(day.key, mealType, mealId)}
							onMarkEaten={(mealType, meal) => onMarkEaten && onMarkEaten(day.key, mealType, meal)}
							recipes={recipes}
							defaultExpanded={day.isToday}
						/>
					))}

					{/* Add week to shopping list */}
					{onAddToShoppingList && (
						<TouchableOpacity
							onPress={onAddToShoppingList}
							activeOpacity={0.85}
							style={{
								flexDirection: "row",
								alignItems: "center",
								justifyContent: "center",
								gap: 8,
								backgroundColor: "#dbeafe",
								borderRadius: 16,
								paddingVertical: 14,
								marginTop: 4,
							}}>
							<Icon name="cart" size={16} color="#1d4ed8" />
							<Text style={{ fontSize: 13, fontWeight: "700", color: "#1d4ed8" }}>
								Add Week's Ingredients to Shopping List
							</Text>
						</TouchableOpacity>
					)}

					<Text
						style={{
							fontSize: 10,
							color: C.mutedText,
							textAlign: "center",
							fontStyle: "italic",
							marginTop: 4,
						}}>
						Nutrition indicators are estimates based on food categories. Not medical or dietetic advice.
					</Text>
				</ScrollView>
			)}
		</View>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// PantryTab
// ─────────────────────────────────────────────────────────────────────────────

function PantryTab({ items, input, setInput, category, setCategory, onAdd, onRemove }) {
	const { C } = useTheme();

	const grouped = useMemo(() => {
		const g = {};
		items.forEach((item) => {
			const cat = item.category || "Other";
			if (!g[cat]) g[cat] = [];
			g[cat].push(item);
		});
		return g;
	}, [items]);

	return (
		<View style={{ flex: 1 }}>
			{/* Info banner */}
			<View
				style={{
					backgroundColor: "#f0fdf4",
					borderRadius: 14,
					padding: 14,
					marginBottom: 14,
					flexDirection: "row",
					gap: 10,
					alignItems: "flex-start",
				}}>
				<Text style={{ fontSize: 18 }}>🥕</Text>
				<View style={{ flex: 1 }}>
					<Text style={{ fontSize: 12, fontWeight: "800", color: "#15803d", marginBottom: 2 }}>
						What's in your pantry?
					</Text>
					<Text style={{ fontSize: 11, color: "#166534", lineHeight: 16 }}>
						Add ingredients you have at home. The AI Meal Planner will use these first to help reduce waste and save money.
					</Text>
				</View>
			</View>

			{/* Add item form */}
			<View style={{ gap: 10, marginBottom: 16 }}>
				<View style={{ flexDirection: "row", gap: 8 }}>
					<TextInput
						value={input}
						onChangeText={setInput}
						placeholder="Add ingredient (e.g. Sweet potato)"
						placeholderTextColor={C.mutedText}
						onSubmitEditing={onAdd}
						returnKeyType="done"
						style={{
							flex: 1,
							backgroundColor: C.bgPurple,
							borderRadius: 12,
							paddingHorizontal: 14,
							paddingVertical: 12,
							fontSize: 14,
							color: C.textCharcoal,
						}}
					/>
					<TouchableOpacity
						onPress={onAdd}
						disabled={!input.trim()}
						style={{
							backgroundColor: input.trim() ? C.primaryPurple : C.borderLight,
							borderRadius: 12,
							paddingHorizontal: 16,
							alignItems: "center",
							justifyContent: "center",
						}}>
						<Icon name="plus" size={18} color="#fff" />
					</TouchableOpacity>
				</View>

				<ScrollView horizontal showsHorizontalScrollIndicator={false}>
					{PANTRY_CATS.map((cat) => (
						<TouchableOpacity
							key={cat}
							onPress={() => setCategory(cat)}
							style={{
								paddingHorizontal: 12,
								paddingVertical: 7,
								borderRadius: 20,
								marginRight: 8,
								backgroundColor: category === cat ? C.primaryPurple : C.bgPurple,
							}}>
							<Text
								style={{
									fontSize: 11,
									fontWeight: "700",
									color: category === cat ? C.white : C.mutedText,
								}}>
								{cat}
							</Text>
						</TouchableOpacity>
					))}
				</ScrollView>
			</View>

			{/* Item list */}
			{items.length === 0 ? (
				<View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingBottom: 40 }}>
					<Text style={{ fontSize: 48 }}>🧺</Text>
					<Text style={{ fontSize: 15, fontWeight: "800", color: C.textCharcoal }}>
						Empty pantry
					</Text>
					<Text style={{ fontSize: 12, color: C.mutedText, textAlign: "center", lineHeight: 18 }}>
						Add your ingredients above so the AI can plan meals around what you already have.
					</Text>
				</View>
			) : (
				<ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
					{Object.entries(grouped).map(([cat, catItems]) => (
						<View key={cat} style={{ marginBottom: 18 }}>
							<Text
								style={{
									fontSize: 10,
									fontWeight: "800",
									color: C.mutedText,
									textTransform: "uppercase",
									letterSpacing: 0.6,
									marginBottom: 8,
								}}>
								{cat}
							</Text>
							<View style={{ gap: 7 }}>
								{catItems.map((item) => (
									<View
										key={item.id}
										style={{
											flexDirection: "row",
											alignItems: "center",
											backgroundColor: C.white,
											borderRadius: 12,
											paddingHorizontal: 14,
											paddingVertical: 12,
											shadowColor: "#000",
											shadowOpacity: 0.04,
											shadowRadius: 4,
											elevation: 1,
											gap: 10,
										}}>
										<Icon name="leaf" size={14} color="#16a34a" />
										<Text
											style={{
												flex: 1,
												fontSize: 14,
												fontWeight: "600",
												color: C.textCharcoal,
											}}>
											{item.name}
										</Text>
										<TouchableOpacity
											onPress={() => onRemove(item.id)}
											hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
											<Icon name="close" size={14} color={C.mutedText} />
										</TouchableOpacity>
									</View>
								))}
							</View>
						</View>
					))}
				</ScrollView>
			)}
		</View>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// ExposureTab
// ─────────────────────────────────────────────────────────────────────────────

function ExposureTab({ exposures, onLogNew, activeChild }) {
	const { C } = useTheme();

	return (
		<View style={{ flex: 1 }}>
			{/* Log button */}
			<TouchableOpacity
				onPress={onLogNew}
				activeOpacity={0.85}
				style={{
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "center",
					gap: 8,
					backgroundColor: C.primaryPurple,
					borderRadius: 16,
					paddingVertical: 14,
					marginBottom: 14,
				}}>
				<Icon name="plus" size={16} color="#fff" />
				<Text style={{ fontSize: 14, fontWeight: "800", color: "#fff" }}>
					Log Food Exposure
				</Text>
			</TouchableOpacity>

			{/* Info */}
			<View
				style={{
					backgroundColor: C.bgPurple,
					borderRadius: 14,
					padding: 12,
					marginBottom: 14,
				}}>
				<Text style={{ fontSize: 11, color: C.mutedText, lineHeight: 16 }}>
					Track how{activeChild?.name ? ` ${activeChild.name}` : " your baby"} engages with foods — touching and tasting count too! Research shows repeated exposure builds acceptance. 🌱
				</Text>
			</View>

			{exposures.length === 0 ? (
				<View
					style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingBottom: 40 }}>
					<Text style={{ fontSize: 48 }}>🌱</Text>
					<Text style={{ fontSize: 15, fontWeight: "800", color: C.textCharcoal }}>
						No exposures tracked yet
					</Text>
					<Text style={{ fontSize: 12, color: C.mutedText, textAlign: "center", lineHeight: 18 }}>
						Tap "Log Food Exposure" above to record how{activeChild?.name ? ` ${activeChild.name}` : " your baby"} interacts with different foods.
					</Text>
				</View>
			) : (
				<ScrollView
					showsVerticalScrollIndicator={false}
					contentContainerStyle={{ paddingBottom: 40, gap: 8 }}>
					{exposures.map((item) => {
						const entries = item.exposures || [];
						const last    = entries[entries.length - 1];
						const reactionCfgItem = last ? EXPOSURE_REACTIONS.find((r) => r.key === last.reaction) : null;
						const stageCfgItem    = last ? EXPOSURE_STAGES.find((s) => s.key === last.stage) : null;

						// Colour bar based on best reaction seen
						const bestReaction = entries.reduce((best, e) => {
							const order = ["loved","liked","neutral","disliked"];
							const idx   = order.indexOf(e.reaction);
							const bestIdx = order.indexOf(best);
							return idx < bestIdx ? e.reaction : best;
						}, "neutral");
						const bestCfg = EXPOSURE_REACTIONS.find((r) => r.key === bestReaction);

						return (
							<View
								key={item.id}
								style={{
									backgroundColor: C.white,
									borderRadius: 16,
									paddingHorizontal: 14,
									paddingVertical: 13,
									flexDirection: "row",
									alignItems: "center",
									gap: 12,
									shadowColor: "#000",
									shadowOpacity: 0.05,
									shadowRadius: 6,
									elevation: 2,
									borderLeftWidth: 3,
									borderLeftColor: bestCfg?.color + "55" || C.borderLight,
								}}>
								{/* Stage emoji */}
								<View
									style={{
										width: 44,
										height: 44,
										borderRadius: 12,
										backgroundColor: C.bgPurple,
										alignItems: "center",
										justifyContent: "center",
									}}>
									<Text style={{ fontSize: 22 }}>{stageCfgItem?.emoji || "🍽"}</Text>
								</View>

								<View style={{ flex: 1 }}>
									<Text
										style={{ fontSize: 14, fontWeight: "800", color: C.textCharcoal, marginBottom: 4 }}>
										{item.foodName}
									</Text>
									<View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
										<View
											style={{
												backgroundColor: C.primaryPurple + "15",
												borderRadius: 8,
												paddingHorizontal: 7,
												paddingVertical: 3,
											}}>
											<Text style={{ fontSize: 10, fontWeight: "700", color: C.primaryPurple }}>
												{item.timesExposed}× tried
											</Text>
										</View>
										{reactionCfgItem && (
											<View
												style={{
													backgroundColor: reactionCfgItem.color + "15",
													borderRadius: 8,
													paddingHorizontal: 7,
													paddingVertical: 3,
												}}>
												<Text
													style={{
														fontSize: 10,
														fontWeight: "700",
														color: reactionCfgItem.color,
													}}>
													{reactionCfgItem.emoji} {reactionCfgItem.label}
												</Text>
											</View>
										)}
										{stageCfgItem && (
											<View
												style={{
													backgroundColor: "#f9fafb",
													borderRadius: 8,
													paddingHorizontal: 7,
													paddingVertical: 3,
												}}>
												<Text style={{ fontSize: 10, fontWeight: "600", color: C.mutedText }}>
													{stageCfgItem.emoji} {stageCfgItem.label}
												</Text>
											</View>
										)}
									</View>
								</View>

								<Text style={{ fontSize: 10, color: C.mutedText, flexShrink: 0 }}>
									{item.lastExposed ? item.lastExposed.slice(5).replace("-", " ") : ""}
								</Text>
							</View>
						);
					})}
				</ScrollView>
			)}
		</View>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// MealPlannerScreen — main export
// ─────────────────────────────────────────────────────────────────────────────

export function MealPlannerScreen({
	user,
	isPro,
	onUpgradePro,
	activeChild,
	recipes,
	smartRecipes,
	onAddToShoppingList,
	onNavigateToShopping,
	childFoodLog,
}) {
	const { C } = useTheme();

	// ── Tab state ─────────────────────────────────────────────────────────────
	const [tab, setTab] = useState("plan");

	// ── Week ──────────────────────────────────────────────────────────────────
	const [weekOffset, setWeekOffset] = useState(0);
	const monday  = useMemo(() => getMonday(weekOffset), [weekOffset]);
	const weekDays = useMemo(() => getWeekDays(monday), [monday]);
	const wId     = useMemo(() => weekId(monday), [monday]);

	// ── Plan data ─────────────────────────────────────────────────────────────
	const [planDays, setPlanDays]   = useState(() => emptyWeek());
	const [planLoading, setPlanLoading] = useState(false);
	const [generating, setGenerating]   = useState(false);

	// ── Pantry ────────────────────────────────────────────────────────────────
	const [pantryItems, setPantryItems]   = useState([]);
	const [pantryInput, setPantryInput]   = useState("");
	const [pantryCat,   setPantryCat]     = useState("Vegetables");

	// ── Food exposure ─────────────────────────────────────────────────────────
	const [exposures, setExposures]           = useState([]);
	const [showExposureModal, setShowExposureModal] = useState(false);

	// ── AI options modal ──────────────────────────────────────────────────────
	const [showGenerateOptions, setShowGenerateOptions] = useState(false);

	// ── Meal eaten / diary log ────────────────────────────────────────────────
	const [eatenTarget, setEatenTarget] = useState(null); // { meal, dayKey, mealType }

	// ── Add meal modal ────────────────────────────────────────────────────────
	const [addMealTarget, setAddMealTarget] = useState(null); // { day, mealType }

	// ── Shopping preview modal ────────────────────────────────────────────────
	const [shoppingPreview, setShoppingPreview] = useState(null); // [{ title, ingredients }]
	const [addingToCart, setAddingToCart]       = useState(false);

	// ── Load week plan ────────────────────────────────────────────────────────
	useEffect(() => {
		if (!user?.uid) return;
		let alive = true;
		setPlanLoading(true);
		(async () => {
			try {
				const { doc, getDoc } = await import("firebase/firestore");
				const { db }          = await import("../../firebase");
				const snap = await getDoc(doc(db, "users", user.uid, "mealPlan", wId));
				if (!alive) return;
				if (snap.exists()) {
					const data = snap.data();
					const days = emptyWeek();
					DAY_KEYS.forEach((k) => { if (data.days?.[k]) days[k] = data.days[k]; });
					setPlanDays(days);
				} else {
					setPlanDays(emptyWeek());
				}
			} catch (e) {
				console.warn("[mealPlan] load:", e.message);
				if (alive) setPlanDays(emptyWeek());
			}
			if (alive) setPlanLoading(false);
		})();
		return () => { alive = false; };
	}, [user?.uid, wId]);

	// ── Load pantry ───────────────────────────────────────────────────────────
	useEffect(() => {
		if (!user?.uid) return;
		let alive = true;
		(async () => {
			try {
				const { doc, getDoc } = await import("firebase/firestore");
				const { db }          = await import("../../firebase");
				const snap = await getDoc(doc(db, "users", user.uid, "pantry", "main"));
				if (alive && snap.exists()) setPantryItems(snap.data().items || []);
			} catch { /* silent */ }
		})();
		return () => { alive = false; };
	}, [user?.uid]);

	// ── Load food exposures ───────────────────────────────────────────────────
	useEffect(() => {
		if (!user?.uid) return;
		let alive = true;
		(async () => {
			try {
				const { collection, getDocs } = await import("firebase/firestore");
				const { db }                  = await import("../../firebase");
				const snap = await getDocs(collection(db, "users", user.uid, "foodExposure"));
				if (!alive) return;
				const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
				docs.sort((a, b) => (b.lastExposed || "").localeCompare(a.lastExposed || ""));
				setExposures(docs);
			} catch { /* silent */ }
		})();
		return () => { alive = false; };
	}, [user?.uid]);

	// ── Save plan ─────────────────────────────────────────────────────────────
	const savePlan = useCallback(async (days) => {
		if (!user?.uid) return;
		try {
			const { doc, setDoc } = await import("firebase/firestore");
			const { db }          = await import("../../firebase");
			await setDoc(doc(db, "users", user.uid, "mealPlan", wId), {
				weekId: wId,
				days,
				updatedAt: new Date().toISOString(),
			});
		} catch (e) {
			console.warn("[mealPlan] save:", e.message);
		}
	}, [user?.uid, wId]);

	// ── Add meal ──────────────────────────────────────────────────────────────
	const handleAddMeal = useCallback(async (meal) => {
		if (!addMealTarget) return;
		const { day, mealType } = addMealTarget;
		setPlanDays((prev) => {
			const next = {
				...prev,
				[day]: {
					...prev[day],
					[mealType]: [...(prev[day][mealType] || []), meal],
				},
			};
			savePlan(next);
			return next;
		});
		setAddMealTarget(null);
	}, [addMealTarget, savePlan]);

	// ── Remove meal ───────────────────────────────────────────────────────────
	const handleRemoveMeal = useCallback((day, mealType, mealId) => {
		setPlanDays((prev) => {
			const next = {
				...prev,
				[day]: {
					...prev[day],
					[mealType]: (prev[day][mealType] || []).filter((m) => m.id !== mealId),
				},
			};
			savePlan(next);
			return next;
		});
	}, [savePlan]);

	// ── Show shopping preview ─────────────────────────────────────────────────
	const handleShowShoppingPreview = useCallback(() => {
		const mealsByKey = new Map();
		DAY_KEYS.forEach((day) => {
			MEAL_CFG.forEach((m) => {
				(planDays[day]?.[m.key] || []).forEach((meal) => {
					if (meal.ingredients?.length > 0) {
						const key = meal.recipeId || meal.id;
						if (!mealsByKey.has(key)) {
							mealsByKey.set(key, { title: meal.title, ingredients: meal.ingredients });
						}
					}
				});
			});
		});

		if (mealsByKey.size === 0) {
			Alert.alert(
				"No ingredients to add",
				"Add meals from the recipe library to automatically include their ingredients.",
			);
			return;
		}

		setShoppingPreview(Array.from(mealsByKey.values()));
	}, [planDays]);

	// ── Confirm shopping — add all then navigate ───────────────────────────────
	const handleConfirmShopping = useCallback(async () => {
		if (!shoppingPreview) return;
		setAddingToCart(true);
		for (const { title, ingredients } of shoppingPreview) {
			try {
				await onAddToShoppingList(uid4(), title, ingredients);
			} catch { /* non-fatal */ }
		}
		setAddingToCart(false);
		setShoppingPreview(null);
		onNavigateToShopping?.();
	}, [shoppingPreview, onAddToShoppingList, onNavigateToShopping]);

	// ── Pantry helpers ────────────────────────────────────────────────────────
	const handleAddPantryItem = useCallback(async () => {
		if (!pantryInput.trim()) return;
		const item = {
			id:       uid4(),
			name:     pantryInput.trim(),
			category: pantryCat,
			addedAt:  new Date().toISOString(),
		};
		const newItems = [item, ...pantryItems];
		setPantryItems(newItems);
		setPantryInput("");
		try {
			const { doc, setDoc } = await import("firebase/firestore");
			const { db }          = await import("../../firebase");
			await setDoc(doc(db, "users", user.uid, "pantry", "main"), { items: newItems });
		} catch { /* silent */ }
	}, [pantryInput, pantryCat, pantryItems, user?.uid]);

	const handleRemovePantryItem = useCallback(async (id) => {
		const newItems = pantryItems.filter((i) => i.id !== id);
		setPantryItems(newItems);
		try {
			const { doc, setDoc } = await import("firebase/firestore");
			const { db }          = await import("../../firebase");
			await setDoc(doc(db, "users", user.uid, "pantry", "main"), { items: newItems });
		} catch { /* silent */ }
	}, [pantryItems, user?.uid]);

	// ── Food exposure ─────────────────────────────────────────────────────────
	const handleSaveExposure = useCallback(async ({ foodName, stage, reaction }) => {
		if (!foodName || !user?.uid) return;
		const childId = activeChild?.id || "default";
		const today   = new Date().toISOString().split("T")[0];
		const docId   = `${childId}_${foodName.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")}`;
		const entry   = { date: today, stage, reaction };
		try {
			const { doc, getDoc, setDoc } = await import("firebase/firestore");
			const { db }                  = await import("../../firebase");
			const ref  = doc(db, "users", user.uid, "foodExposure", docId);
			const snap = await getDoc(ref);
			let exposureDoc;
			if (snap.exists()) {
				const existing = snap.data();
				exposureDoc = {
					...existing,
					exposures:    [...(existing.exposures || []), entry],
					timesExposed: (existing.timesExposed || 0) + 1,
					lastExposed:  today,
				};
			} else {
				exposureDoc = {
					childId,
					foodName: foodName.trim(),
					exposures: [entry],
					timesExposed: 1,
					lastExposed: today,
				};
			}
			await setDoc(ref, exposureDoc);
			setExposures((prev) => {
				const filtered = prev.filter((e) => e.id !== docId);
				return [{ id: docId, ...exposureDoc }, ...filtered];
			});
			setShowExposureModal(false);
		} catch (e) {
			Alert.alert("Error", "Could not save food exposure. Please try again.");
		}
	}, [activeChild, user?.uid]);

	// ── AI generate week — opens options modal ────────────────────────────────
	const handleGenerateWeek = useCallback(() => {
		if (!isPro) { onUpgradePro(); return; }
		if (!activeChild) { Alert.alert("No child selected", "Please select a child first."); return; }
		setShowGenerateOptions(true);
	}, [isPro, activeChild, onUpgradePro]);

	// ── Actual generation after options confirmed ─────────────────────────────
	const handleActualGenerate = useCallback(async ({ daysToGenerate, additionalPreferences, dislikedFoods }) => {
		setGenerating(true);
		try {
			const { getFunctions, httpsCallable } = await import("firebase/functions");
			const { getApp }                      = await import("firebase/app");
			const functions = getFunctions(getApp(), "europe-west2");

			const likedFoods = (childFoodLog || [])
				.filter((f) => ["Loved", "Good"].includes(f.reaction))
				.map((f) => f.name)
				.filter((v, i, a) => a.indexOf(v) === i)
				.slice(0, 20);

			const fn     = httpsCallable(functions, "generateWeeklyMealPlan");
			const result = await fn({
				isPro:                 true,
				childName:             activeChild.name || "Baby",
				ageMonths:             activeChild.ageMonths || 6,
				allergensAvoid:        activeChild.allergensToAvoid || [],
				likedFoods,
				pantryItems:           pantryItems.map((i) => `${i.name} (${i.category})`),
				daysToGenerate,
				additionalPreferences,
				dislikedFoods,
			});

			if (result.data?.plan) {
				// Preserve existing meals for days NOT in daysToGenerate
				const newDays = { ...planDays };
				daysToGenerate.forEach((k) => {
					if (result.data.plan[k]) {
						newDays[k] = {};
						MEAL_CFG.forEach((m) => {
							const items = result.data.plan[k][m.key] || [];
							newDays[k][m.key] = items.map((meal) => ({
								id:          uid4(),
								type:        "ai",
								title:       meal.title || "",
								description: meal.description || "",
								category:    meal.category || "",
								ingredients: meal.ingredients || [],
								isLeftover:  meal.isLeftover || false,
							}));
						});
					}
				});
				setPlanDays(newDays);
				await savePlan(newDays);
				const summary = result.data.leftoverSummary;
				Alert.alert(
					"Plan Ready! ✨",
					summary
						? `Your personalised meal plan is ready!\n\n♻️ ${summary}`
						: "Your personalised meal plan is ready! Tap any day to explore the meals.",
				);
			}
		} catch (e) {
			const msg = e.message || "";
			if (msg.includes("daily_limit") || msg.includes("resource-exhausted")) {
				Alert.alert("Daily Limit Reached", "You can generate one AI meal plan per day. Come back tomorrow!");
			} else {
				Alert.alert("Couldn't generate", "Something went wrong. Please try again.");
				console.warn("[weeklyPlan]", e.message);
			}
		}
		setGenerating(false);
	}, [isPro, activeChild, childFoodLog, pantryItems, planDays, savePlan]);

	// ── Reset week ────────────────────────────────────────────────────────────
	const handleResetWeek = useCallback(() => {
		Alert.alert(
			"Reset This Week",
			"This will clear all planned meals for the current week. This cannot be undone.",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Reset",
					style: "destructive",
					onPress: async () => {
						const empty = emptyWeek();
						setPlanDays(empty);
						await savePlan(empty);
					},
				},
			],
		);
	}, [savePlan]);

	// ── Mark meal as eaten — opens diary modal or unmarks ─────────────────────
	const handleMealCheckTap = useCallback((dayKey, mealType, meal) => {
		if (meal.eaten) {
			Alert.alert(
				"Remove eaten mark?",
				`Remove the eaten mark from "${meal.title}"?`,
				[
					{ text: "Keep", style: "cancel" },
					{
						text: "Remove",
						onPress: () => {
							setPlanDays((prev) => {
								const next = {
									...prev,
									[dayKey]: {
										...prev[dayKey],
										[mealType]: (prev[dayKey][mealType] || []).map((m) =>
											m.id === meal.id ? { ...m, eaten: false } : m,
										),
									},
								};
								savePlan(next);
								return next;
							});
						},
					},
				],
			);
			return;
		}
		if (!activeChild) {
			// No child — just mark eaten without logging
			setPlanDays((prev) => {
				const next = {
					...prev,
					[dayKey]: {
						...prev[dayKey],
						[mealType]: (prev[dayKey][mealType] || []).map((m) =>
							m.id === meal.id ? { ...m, eaten: true } : m,
						),
					},
				};
				savePlan(next);
				return next;
			});
			return;
		}
		setEatenTarget({ meal, dayKey, mealType });
	}, [activeChild, savePlan]);

	// ── Log eaten meal to food diary after reaction chosen ────────────────────
	const handleLogEaten = useCallback(async (reaction) => {
		if (!eatenTarget) return;
		const { meal, dayKey, mealType } = eatenTarget;
		const dayInfo = weekDays.find((d) => d.key === dayKey);
		const dateStr = dayInfo?.dateStr || new Date().toISOString().split("T")[0];
		const time    = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

		// Mark as eaten in plan
		setPlanDays((prev) => {
			const next = {
				...prev,
				[dayKey]: {
					...prev[dayKey],
					[mealType]: (prev[dayKey][mealType] || []).map((m) =>
						m.id === meal.id ? { ...m, eaten: true } : m,
					),
				},
			};
			savePlan(next);
			return next;
		});
		setEatenTarget(null);

		// Log to food diary if reaction given
		if (reaction !== null && activeChild && user?.uid) {
			try {
				const { addFoodEntry } = await import("../../firebaseHooks");
				const existingCount = (childFoodLog || []).filter(
					(f) => f.name?.toLowerCase() === meal.title.toLowerCase() && f.childId === activeChild.id,
				).length;
				await addFoodEntry(user.uid, {
					childId:    activeChild.id,
					name:       meal.title,
					category:   meal.category || meal.categories?.[0] || "Other",
					categories: meal.categories || (meal.category ? [meal.category] : []),
					date:       dateStr,
					time,
					reaction,
					form:       "",
					photoUri:   "",
					attemptNum: existingCount + 1,
				});
				Alert.alert("Added to diary! 🌟", `"${meal.title}" has been added to ${activeChild.name}'s food diary.`);
			} catch (e) {
				console.warn("[mealPlanner] food log:", e.message);
			}
		}
	}, [eatenTarget, weekDays, activeChild, user?.uid, childFoodLog, savePlan]);

	// ── Active meal config for modal ──────────────────────────────────────────
	const activeMealCfg = addMealTarget
		? MEAL_CFG.find((m) => m.key === addMealTarget.mealType) || null
		: null;

	// ─────────────────────────────────────────────────────────────────────────
	// Render
	// ─────────────────────────────────────────────────────────────────────────

	const TABS = [
		{ key: "plan",     label: "Meal Plan",     icon: "calendar" },
		{ key: "pantry",   label: "Pantry",        icon: "leaf" },
		{ key: "exposure", label: "Food Tracker",  icon: "chart" },
	];

	return (
		<View style={{ flex: 1 }}>
			{/* Tab bar */}
			<View
				style={{
					flexDirection: "row",
					backgroundColor: C.bgPurple,
					borderRadius: 16,
					padding: 4,
					marginBottom: 16,
				}}>
				{TABS.map((t) => (
					<TouchableOpacity
						key={t.key}
						onPress={() => setTab(t.key)}
						activeOpacity={0.8}
						style={{
							flex: 1,
							flexDirection: "row",
							alignItems: "center",
							justifyContent: "center",
							gap: 5,
							paddingVertical: 10,
							borderRadius: 12,
							backgroundColor: tab === t.key ? C.white : "transparent",
							shadowColor: "#000",
							shadowOpacity: tab === t.key ? 0.06 : 0,
							shadowRadius: 6,
							elevation: tab === t.key ? 2 : 0,
						}}>
						<Icon
							name={t.icon}
							size={13}
							color={tab === t.key ? C.primaryPurple : C.mutedText}
						/>
						<Text
							style={{
								fontSize: 12,
								fontWeight: "700",
								color: tab === t.key ? C.primaryPurple : C.mutedText,
							}}>
							{t.label}
						</Text>
					</TouchableOpacity>
				))}
			</View>

			{/* Tab content */}
			{tab === "plan" && (
				<PlanTab
					weekDays={weekDays}
					planDays={planDays}
					weekOffset={weekOffset}
					setWeekOffset={setWeekOffset}
					planLoading={planLoading}
					generating={generating}
					onGenerate={handleGenerateWeek}
					onAddMeal={(day, mealType) => setAddMealTarget({ day, mealType })}
					onRemoveMeal={handleRemoveMeal}
					onMarkEaten={handleMealCheckTap}
					onReset={handleResetWeek}
					onAddToShoppingList={onAddToShoppingList ? handleShowShoppingPreview : null}
					recipes={recipes}
					isPro={isPro}
				/>
			)}

			{tab === "pantry" && (
				<PantryTab
					items={pantryItems}
					input={pantryInput}
					setInput={setPantryInput}
					category={pantryCat}
					setCategory={setPantryCat}
					onAdd={handleAddPantryItem}
					onRemove={handleRemovePantryItem}
				/>
			)}

			{tab === "exposure" && (
				<ExposureTab
					exposures={exposures}
					onLogNew={() => setShowExposureModal(true)}
					activeChild={activeChild}
				/>
			)}

			{/* Add Meal Modal */}
			<AddMealModal
				visible={!!addMealTarget}
				onClose={() => setAddMealTarget(null)}
				onAdd={handleAddMeal}
				recipes={recipes}
				smartRecipes={smartRecipes}
				mealCfg={activeMealCfg}
			/>

			{/* Generate Options Modal */}
			<GenerateOptionsModal
				visible={showGenerateOptions}
				onClose={() => setShowGenerateOptions(false)}
				onGenerate={handleActualGenerate}
				childName={activeChild?.name}
			/>

			{/* Meal Eaten / Diary Log Modal */}
			<MealEatenModal
				visible={!!eatenTarget}
				meal={eatenTarget?.meal || null}
				child={activeChild}
				onClose={() => setEatenTarget(null)}
				onLog={handleLogEaten}
			/>

			{/* Exposure Modal */}
			<ExposureModal
				visible={showExposureModal}
				onClose={() => setShowExposureModal(false)}
				onSave={handleSaveExposure}
			/>

			{/* Shopping Preview Modal */}
			<ShoppingPreviewModal
				visible={!!shoppingPreview}
				onClose={() => setShoppingPreview(null)}
				onConfirm={handleConfirmShopping}
				items={shoppingPreview || []}
				adding={addingToCart}
			/>
		</View>
	);
}
