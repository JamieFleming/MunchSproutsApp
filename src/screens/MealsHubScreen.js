import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, Modal, ActivityIndicator } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useTheme } from "../ThemeContext";
import { Icon } from "../components/Icon";
import { parseIngredient } from "../helpers";
import { RecipesScreen } from "./RecipesScreen";
import { ShoppingListScreen, loadAllLists } from "./ShoppingListScreen";
import { SmartMealIdeasScreen } from "./SmartMealIdeasScreen";
import { MealPlannerScreen } from "./MealPlannerScreen";

// ── Firestore helper — writes items to a specific list ────────────────────────

const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

async function appendToShoppingList(userId, list, recipeId, recipeTitle, ingredients, addedByName) {
	const { doc, getDoc, setDoc } = await import("firebase/firestore");
	const { db } = await import("../firebase");
	const ref = list.isShared && list.childId
		? doc(db, "children", list.childId, "lists", list.id)
		: doc(db, "users", userId, "lists", list.id);
	const snap = await getDoc(ref);
	const existing = snap.exists() ? snap.data().items || [] : [];
	const newItems = ingredients.map((ing) => {
		const { name, quantity } = parseIngredient(ing);
		return { id: genId(), name, quantity, checked: false, recipeId, recipeTitle, addedBy: userId, addedByName };
	});
	await setDoc(ref, { items: [...newItems, ...existing], updatedAt: new Date().toISOString() }, { merge: true });
}

// ── ListPickerModal — used by recipe/meal add flows ────────────────────────────

function ListPickerModal({ visible, lists, loading, onSelect, onClose }) {
	const { C } = useTheme();
	return (
		<Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
			<TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }} activeOpacity={1} onPress={onClose} />
			<View style={{ backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8, paddingBottom: 40 }}>
				<View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.borderLight, alignSelf: "center", marginBottom: 16 }} />
				<Text style={{ fontSize: 17, fontFamily: "PlusJakartaSans_700Bold", color: C.primaryPinkDark, paddingHorizontal: 20, marginBottom: 8 }}>
					Add to which list?
				</Text>
				{loading ? (
					<View style={{ paddingVertical: 24, alignItems: "center" }}>
						<ActivityIndicator color={C.primaryPurple} />
					</View>
				) : lists.map((list) => (
					<TouchableOpacity
						key={list.id}
						onPress={() => onSelect(list)}
						activeOpacity={0.8}
						style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.borderLight }}>
						<View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: list.isShared ? "#d4eef5" : C.bgPurple, alignItems: "center", justifyContent: "center" }}>
							<Icon name={list.isShared ? "users" : "cart"} size={17} color={list.isShared ? "#2a5f8f" : C.primaryPurple} />
						</View>
						<View style={{ flex: 1 }}>
							<Text style={{ fontSize: 15, fontFamily: "NunitoSans_700Bold", color: C.textCharcoal }}>{list.name}</Text>
							{list.isShared && <Text style={{ fontFamily: "NunitoSans_400Regular", fontSize: 11, color: "#2a5f8f", marginTop: 1 }}>Shared with family</Text>}
						</View>
						<Icon name="chevRight" size={15} color={C.mutedText} />
					</TouchableOpacity>
				))}
			</View>
		</Modal>
	);
}

// ── Hub card ──────────────────────────────────────────────────────────────────

function HubCard({
	icon,
	iconBg,
	iconColor,
	title,
	subtitle,
	badge,
	onPress,
	disabled,
	fullWidth,
	accentColor,
}) {
	const { C } = useTheme();
	return (
		<TouchableOpacity
			onPress={disabled ? null : onPress}
			activeOpacity={disabled ? 1 : 0.82}
			style={{
				flex: fullWidth ? undefined : 1,
				backgroundColor: C.white,
				borderRadius: 20,
				padding: 20,
				borderWidth: 1,
				borderColor: C.borderLight,
				shadowColor: accentColor || "#9b7fe8",
				shadowOpacity: disabled ? 0.03 : 0.08,
				shadowRadius: 10,
				shadowOffset: { width: 0, height: 3 },
				elevation: disabled ? 1 : 3,
				opacity: disabled ? 0.65 : 1,
				overflow: "hidden",
			}}>
			{/* Decorative circle */}
			<View
				style={{
					position: "absolute",
					top: -18,
					right: -18,
					width: 72,
					height: 72,
					borderRadius: 36,
					backgroundColor: (accentColor || C.primaryPurple) + "12",
				}}
			/>

			{/* Icon */}
			<View
				style={{
					width: 50,
					height: 50,
					borderRadius: 15,
					backgroundColor: iconBg,
					alignItems: "center",
					justifyContent: "center",
					marginBottom: 14,
				}}>
				<Icon name={icon} size={24} color={iconColor} />
			</View>

			{/* Badge */}
			{badge && (
				<View
					style={{
						alignSelf: "flex-start",
						backgroundColor:
							badge === "Pro"
								? "#f5c84222"
								: badge === "Coming Soon"
									? C.bgPurple
									: "#f0fdf4",
						borderRadius: 999,
						paddingHorizontal: 9,
						paddingVertical: 3,
						marginBottom: 8,
					}}>
					<Text
						style={{
							fontSize: 10,
							fontFamily: "NunitoSans_800ExtraBold",
							color:
								badge === "Pro"
									? "#c8920a"
									: badge === "Coming Soon"
										? C.primaryPurple
										: "#16a34a",
							textTransform: "uppercase",
							letterSpacing: 0.5,
						}}>
						{badge}
					</Text>
				</View>
			)}

			<Text
				style={{
					fontSize: 17,
					fontFamily: "PlusJakartaSans_600SemiBold",
					color: C.primaryPinkDark,
					marginBottom: 4,
				}}>
				{title}
			</Text>
			<Text
				style={{ fontFamily: "NunitoSans_400Regular", fontSize: 12, color: C.mutedText, lineHeight: 17 }}
				numberOfLines={2}>
				{subtitle}
			</Text>

			{/* Arrow — only for tappable cards */}
			{!disabled && (
				<View
					style={{
						position: "absolute",
						bottom: 16,
						right: 16,
						width: 28,
						height: 28,
						borderRadius: 10,
						backgroundColor: (accentColor || C.primaryPurple) + "18",
						alignItems: "center",
						justifyContent: "center",
					}}>
					<Icon
						name="chevRight"
						size={14}
						color={accentColor || C.primaryPurple}
					/>
				</View>
			)}
		</TouchableOpacity>
	);
}

// ── Compact row button (for secondary actions like Shopping List) ──────────────

function RowCard({
	icon,
	iconBg,
	iconColor,
	title,
	subtitle,
	badge,
	onPress,
	accentColor,
}) {
	const { C } = useTheme();
	return (
		<TouchableOpacity
			onPress={onPress}
			activeOpacity={0.82}
			style={{
				flexDirection: "row",
				alignItems: "center",
				gap: 14,
				backgroundColor: C.white,
				borderRadius: 16,
				paddingHorizontal: 16,
				paddingVertical: 14,
				borderWidth: 1,
				borderColor: C.borderLight,
				shadowColor: accentColor || "#9b7fe8",
				shadowOpacity: 0.05,
				shadowRadius: 6,
				shadowOffset: { width: 0, height: 2 },
				elevation: 1,
			}}>
			<View
				style={{
					width: 42,
					height: 42,
					borderRadius: 13,
					backgroundColor: iconBg,
					alignItems: "center",
					justifyContent: "center",
					flexShrink: 0,
				}}>
				<Icon name={icon} size={20} color={iconColor} />
			</View>
			<View style={{ flex: 1 }}>
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: 8,
						marginBottom: 2,
					}}>
					<Text
						style={{ fontSize: 15, fontFamily: "NunitoSans_800ExtraBold", color: C.textCharcoal }}>
						{title}
					</Text>
					{badge && (
						<View
							style={{
								backgroundColor: "#f5c84222",
								borderRadius: 999,
								paddingHorizontal: 7,
								paddingVertical: 2,
							}}>
							<Text
								style={{
									fontSize: 9,
									fontFamily: "NunitoSans_800ExtraBold",
									color: "#c8920a",
									textTransform: "uppercase",
									letterSpacing: 0.4,
								}}>
								{badge}
							</Text>
						</View>
					)}
				</View>
				<Text
					style={{ fontFamily: "NunitoSans_400Regular", fontSize: 12, color: C.mutedText, lineHeight: 16 }}
					numberOfLines={1}>
					{subtitle}
				</Text>
			</View>
			<View
				style={{
					width: 26,
					height: 26,
					borderRadius: 9,
					backgroundColor: (accentColor || C.primaryPurple) + "18",
					alignItems: "center",
					justifyContent: "center",
					flexShrink: 0,
				}}>
				<Icon
					name="chevRight"
					size={13}
					color={accentColor || C.primaryPurple}
				/>
			</View>
		</TouchableOpacity>
	);
}

// ── Hub view ──────────────────────────────────────────────────────────────────

function MealsHub({ onNavigate, isPro, onUpgradePro }) {
	const { C } = useTheme();
	return (
		<ScrollView
			showsVerticalScrollIndicator={false}
			contentContainerStyle={{ paddingBottom: 32, gap: 14 }}>
			{/* Page title */}
			<Text style={{ fontFamily: "PlusJakartaSans_700Bold", fontSize: 24, color: C.primaryPinkDark, marginBottom: 2 }}>
				Meals
			</Text>
			{/* Recipes — large full-width */}
			<HubCard
				icon="chef"
				iconBg={C.bgPurple}
				iconColor={C.primaryPurple}
				accentColor={C.primaryPurple}
				title="Recipes"
				subtitle="Browse baby-friendly BLW recipes by age, category, and allergen status."
				fullWidth
				onPress={() => onNavigate("recipes")}
			/>

			{/* Guides — large full-width, links to website */}
			<HubCard
				icon="info"
				iconBg="#fff7ed"
				iconColor="#c2410c"
				accentColor="#c2410c"
				title="Guides"
				subtitle="BLW how-to guides, food preparation tips, and safe feeding advice."
				fullWidth
				onPress={() =>
					WebBrowser.openBrowserAsync(
						"https://munchsprouts.co.uk/getting-start-new",
					)
				}
			/>

			{/* Shopping List — compact row */}

			{/* Row: Meal Planner + AI Ideas */}
			<View style={{ flexDirection: "row", gap: 14 }}>
				<HubCard
					icon="cart"
					iconBg="#dbeafe"
					iconColor="#1d4ed8"
					accentColor="#1d4ed8"
					title="Shopping List"
					subtitle={isPro ? "Multiple lists · share with family · import from recipes." : "Build your list and import ingredients from recipes."}
					badge={isPro ? "Pro" : null}
					onPress={() => onNavigate("shopping")}
				/>
				<HubCard
					icon="calendar"
					iconBg="#f0fdf4"
					iconColor="#16a34a"
					accentColor="#16a34a"
					title="Meal Planner"
					subtitle="Plan your week, track food exposure & get AI suggestions."
					onPress={() => onNavigate("mealPlanner")}
				/>
			</View>
			<HubCard
				icon="sparkle"
				iconBg={isPro ? "#fdf4ff" : "#fef9c3"}
				iconColor={isPro ? "#9333ea" : "#c8920a"}
				accentColor={isPro ? "#9333ea" : "#c8920a"}
				title="Smart Meal Ideas"
				subtitle={
					isPro
						? "AI-powered ideas based on your child's food log."
						: "Upgrade to Pro to unlock."
				}
				badge={isPro ? null : "Pro"}
				onPress={isPro ? () => onNavigate("mealIdeas") : onUpgradePro}
			/>
		</ScrollView>
	);
}

// ── Back breadcrumb ───────────────────────────────────────────────────────────

function BackBreadcrumb({ label, onBack }) {
	const { C } = useTheme();
	return (
		<TouchableOpacity
			onPress={onBack}
			activeOpacity={0.75}
			style={{
				flexDirection: "row",
				alignItems: "center",
				gap: 6,
				alignSelf: "flex-start",
				backgroundColor: C.bgPurple,
				borderRadius: 999,
				paddingHorizontal: 14,
				paddingVertical: 8,
				marginBottom: 12,
			}}>
			{/* Wrap in View to apply rotation — SVG icons don't accept style transforms directly */}
			<View style={{ transform: [{ rotate: "180deg" }] }}>
				<Icon name="chevRight" size={13} color={C.primaryPurple} />
			</View>
			<Text style={{ fontSize: 13, fontFamily: "NunitoSans_700Bold", color: C.primaryPurple }}>
				{label}
			</Text>
		</TouchableOpacity>
	);
}

// ── Main MealsHubScreen ───────────────────────────────────────────────────────

export function MealsHubScreen({
	// shared
	isPro,
	recipes,
	user,
	onUpgradePro,
	// child context for Smart Meal Ideas
	activeChild,
	childFoodLog,
	// RecipesScreen
	favouriteRecipeIds,
	onToggleFav,
	onLogRecipe,
	onRestorePurchases,
	jumpToRecipeId,
	onJumpHandled,
	// Smart Recipes (AI-generated, saved to Firestore)
	smartRecipes,
	onDeleteSmartRecipe,
	onRateSmartRecipe,
	// Incremented by App.js when the Meals nav tab is tapped while already on Meals
	resetKey,
}) {
	const { C } = useTheme();
	const [view, setView] = useState("hub"); // "hub" | "recipes" | "shopping" | "mealIdeas" | "mealPlanner"

	// ── List picker state ──────────────────────────────────────────────────────
	const [showPicker,   setShowPicker]   = useState(false);
	const [pickerLists,  setPickerLists]  = useState([]);
	const [pickerLoading, setPickerLoading] = useState(false);
	const [pendingAdd,   setPendingAdd]   = useState(null); // { recipeId, recipeTitle, ingredients, navigate }

	// Tapping Meals nav tab while already on Meals → return to hub
	useEffect(() => {
		if (resetKey > 0) setView("hub");
	}, [resetKey]);

	// Auto-navigate to recipes when a jumpToRecipeId is set (e.g. from Dashboard)
	useEffect(() => {
		if (jumpToRecipeId) setView("recipes");
	}, [jumpToRecipeId]);

	// ── Shared add-to-list flow ────────────────────────────────────────────────
	const triggerAdd = async (recipeId, recipeTitle, ingredients, navigate) => {
		if (!user?.uid) return;
		const addedByName = user.displayName || user.email?.split("@")[0] || "You";
		if (!isPro) {
			// Free users: always write to default personal list
			const defaultList = { id: "shopping", name: "Shopping List", isShared: false, childId: null };
			await appendToShoppingList(user.uid, defaultList, recipeId, recipeTitle, ingredients, addedByName);
			if (navigate) setView("shopping");
			return;
		}
		// Pro: load lists, show picker if multiple
		setPickerLoading(true);
		setPendingAdd({ recipeId, recipeTitle, ingredients, navigate, addedByName });
		setShowPicker(true);
		const childId = activeChild?.id || null;
		const lists = await loadAllLists(user.uid, childId);
		setPickerLists(lists);
		setPickerLoading(false);

		// If only one list skip the picker
		if (lists.length === 1) {
			setShowPicker(false);
			setPendingAdd(null);
			await appendToShoppingList(user.uid, lists[0], recipeId, recipeTitle, ingredients, addedByName);
			if (navigate) setView("shopping");
		}
	};

	const handlePickerSelect = async (list) => {
		setShowPicker(false);
		if (!pendingAdd || !user?.uid) return;
		const { recipeId, recipeTitle, ingredients, navigate, addedByName } = pendingAdd;
		setPendingAdd(null);
		await appendToShoppingList(user.uid, list, recipeId, recipeTitle, ingredients, addedByName);
		if (navigate) setView("shopping");
	};

	const handlePickerClose = () => {
		setShowPicker(false);
		setPendingAdd(null);
	};

	// ── Add recipe ingredients — navigates to shopping list so user sees result ─
	const handleAddToShoppingList = (recipeId, recipeTitle, ingredients) =>
		triggerAdd(recipeId, recipeTitle, ingredients, true);

	// ── Add ingredients from Smart Meal Ideas / Meal Planner — no navigation ───
	const handleAddToShoppingListNoNav = (recipeId, recipeTitle, ingredients) =>
		triggerAdd(recipeId, recipeTitle, ingredients, false);

	return (
		<View style={{ flex: 1, backgroundColor: C.screen }}>
			{/* Back breadcrumb — only in sub-pages */}
			{view !== "hub" && (
				<BackBreadcrumb
					label={
						view === "mealIdeas"    ? "Smart Meal Ideas"
						: view === "mealPlanner" ? "Meal Planner"
						: "Meals"
					}
					onBack={() => {
						if (view === "recipes" && jumpToRecipeId) onJumpHandled?.();
						setView("hub");
					}}
				/>
			)}

			{/* Hub */}
			<View style={{ flex: 1, display: view === "hub" ? "flex" : "none" }}>
				<MealsHub
					onNavigate={setView}
					isPro={isPro}
					onUpgradePro={onUpgradePro}
				/>
			</View>

			{/* Recipes sub-page */}
			<View style={{ flex: 1, display: view === "recipes" ? "flex" : "none" }}>
				<RecipesScreen
					isPro={isPro}
					recipes={recipes}
					favouriteRecipeIds={favouriteRecipeIds}
					onUpgradePro={onUpgradePro}
					onToggleFav={onToggleFav}
					onLogRecipe={onLogRecipe}
					onRestorePurchases={onRestorePurchases}
					user={user}
					jumpToRecipeId={jumpToRecipeId}
					onJumpHandled={onJumpHandled}
					onAddToShoppingList={handleAddToShoppingList}
					smartRecipes={smartRecipes}
					onDeleteSmartRecipe={onDeleteSmartRecipe}
					onRateSmartRecipe={onRateSmartRecipe}
				/>
			</View>

			{/* Shopping sub-page — visible prop triggers a Firestore reload each time the user opens it */}
			<View style={{ flex: 1, display: view === "shopping" ? "flex" : "none" }}>
				<ShoppingListScreen
					user={user}
					isPro={isPro}
					onUpgradePro={onUpgradePro}
					recipes={recipes}
					visible={view === "shopping"}
					activeChild={activeChild}
				/>
			</View>

			{/* Smart Meal Ideas sub-page — always mounted so generated recipes survive navigation */}
			<View style={{ flex: 1, display: view === "mealIdeas" ? "flex" : "none" }}>
				<SmartMealIdeasScreen
					child={activeChild}
					foodLog={childFoodLog}
					user={user}
					isPro={isPro}
					onUpgradePro={onUpgradePro}
					onAddToShoppingList={handleAddToShoppingListNoNav}
					onLogRecipe={onLogRecipe}
				/>
			</View>

			{/* Meal Planner sub-page */}
			<View style={{ flex: 1, display: view === "mealPlanner" ? "flex" : "none" }}>
				<MealPlannerScreen
					user={user}
					isPro={isPro}
					onUpgradePro={onUpgradePro}
					activeChild={activeChild}
					recipes={recipes}
					smartRecipes={smartRecipes}
					onAddToShoppingList={handleAddToShoppingListNoNav}
					onNavigateToShopping={() => setView("shopping")}
					childFoodLog={childFoodLog}
				/>
			</View>

			{/* List picker — shown when Pro user adds from any recipe flow */}
			<ListPickerModal
				visible={showPicker}
				lists={pickerLists}
				loading={pickerLoading}
				onSelect={handlePickerSelect}
				onClose={handlePickerClose}
			/>
		</View>
	);
}
