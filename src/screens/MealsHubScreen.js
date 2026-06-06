import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useTheme } from "../ThemeContext";
import { Icon } from "../components/Icon";
import { parseIngredient } from "../helpers";
import { RecipesScreen } from "./RecipesScreen";
import { ShoppingListScreen } from "./ShoppingListScreen";
import { SmartMealIdeasScreen } from "./SmartMealIdeasScreen";

// ── Firestore helper — writes items directly to the shopping list doc ─────────

const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

async function appendToShoppingList(
	userId,
	recipeId,
	recipeTitle,
	ingredients,
) {
	const { doc, getDoc, setDoc } = await import("firebase/firestore");
	const { db } = await import("../../firebase");
	const ref = doc(db, "users", userId, "lists", "shopping");
	const snap = await getDoc(ref);
	const existing = snap.exists() ? snap.data().items || [] : [];
	const newItems = ingredients.map((ing) => {
		const { name, quantity } = parseIngredient(ing);
		return {
			id: genId(),
			name,
			quantity,
			checked: false,
			recipeId,
			recipeTitle,
		};
	});
	await setDoc(
		ref,
		{ items: [...newItems, ...existing], updatedAt: new Date().toISOString() },
		{ merge: true },
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
				shadowColor: accentColor || "#9b7fe8",
				shadowOpacity: disabled ? 0.05 : 0.12,
				shadowRadius: 14,
				shadowOffset: { width: 0, height: 5 },
				elevation: disabled ? 1 : 4,
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
							fontWeight: "800",
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
					fontWeight: "800",
					color: C.textCharcoal,
					marginBottom: 4,
				}}>
				{title}
			</Text>
			<Text
				style={{ fontSize: 12, color: C.mutedText, lineHeight: 17 }}
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
				shadowColor: accentColor || "#9b7fe8",
				shadowOpacity: 0.08,
				shadowRadius: 10,
				shadowOffset: { width: 0, height: 3 },
				elevation: 2,
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
						style={{ fontSize: 15, fontWeight: "800", color: C.textCharcoal }}>
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
									fontWeight: "800",
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
					style={{ fontSize: 12, color: C.mutedText, lineHeight: 16 }}
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
					iconBg={isPro ? "#dbeafe" : "#fef9c3"}
					iconColor={isPro ? "#1d4ed8" : "#c8920a"}
					accentColor={isPro ? "#1d4ed8" : "#c8920a"}
					title="Shopping List"
					subtitle={
						isPro
							? "Add items and import ingredients from recipes."
							: "Upgrade to Pro to unlock."
					}
					badge={isPro ? null : "Pro"}
					onPress={() => onNavigate("shopping")}
				/>
				<HubCard
					icon="calendar"
					iconBg="#f0fdf4"
					iconColor="#16a34a"
					accentColor="#16a34a"
					title="Meal Planner"
					subtitle="Plan your week at a glance."
					badge="Coming Soon"
					disabled
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
			<Text style={{ fontSize: 13, fontWeight: "700", color: C.primaryPurple }}>
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
	const [view, setView] = useState("hub"); // "hub" | "recipes" | "shopping" | "mealIdeas"

	// Tapping Meals nav tab while already on Meals → return to hub
	useEffect(() => {
		if (resetKey > 0) setView("hub");
	}, [resetKey]);

	// Auto-navigate to recipes when a jumpToRecipeId is set (e.g. from Dashboard)
	useEffect(() => {
		if (jumpToRecipeId) setView("recipes");
	}, [jumpToRecipeId]);

	// ── Add recipe ingredients — navigates to shopping list so user sees result ─
	const handleAddToShoppingList = async (
		recipeId,
		recipeTitle,
		ingredients,
	) => {
		if (!user?.uid) throw new Error("Not signed in");
		await appendToShoppingList(user.uid, recipeId, recipeTitle, ingredients);
		setView("shopping");
	};

	// ── Add ingredients from Smart Meal Ideas — stays on the same screen ────────
	const handleAddToShoppingListNoNav = async (
		recipeId,
		recipeTitle,
		ingredients,
	) => {
		if (!user?.uid) throw new Error("Not signed in");
		await appendToShoppingList(user.uid, recipeId, recipeTitle, ingredients);
		// Intentionally no navigation — SmartMealIdeasScreen shows its own success state
	};

	return (
		<View style={{ flex: 1, backgroundColor: C.screen }}>
			{/* Back breadcrumb — only in sub-pages */}
			{view !== "hub" && (
				<BackBreadcrumb
					label={view === "mealIdeas" ? "Smart Meal Ideas" : "Meals"}
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
					onAddToShoppingList={isPro ? handleAddToShoppingList : null}
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
				/>
			</View>

			{/* Smart Meal Ideas sub-page — always mounted so generated recipes survive navigation */}
			<View
				style={{ flex: 1, display: view === "mealIdeas" ? "flex" : "none" }}>
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
		</View>
	);
}
