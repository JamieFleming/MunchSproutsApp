import React, { useState, useMemo, memo } from "react";
import {
	View, Text, TextInput, TouchableOpacity, ScrollView,
	Modal, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Image, Linking,
} from "react-native";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useTheme, useStyles } from "../ThemeContext";
import { Icon, CategoryIcon } from "../components/Icon";

const LEGAL_URLS = {
	privacy: "https://munchsprouts.co.uk/privacy-policy",
	terms:   "https://munchsprouts.co.uk/terms-of-use",
};

// ── Small shared components ───────────────────────────────────────────────────

function FreezableBadge({ style }) {
	const { C } = useTheme();
	return (
		<View style={[{ backgroundColor: "#d4eef5", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, flexDirection: "row", alignItems: "center", gap: 4 }, style]}>
			<View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#2a5f8f" }} />
			<Text style={{ fontSize: 10, fontFamily: "NunitoSans_700Bold", color: "#2a5f8f" }}>Freezable</Text>
		</View>
	);
}

function NutritionBar({ nutrition }) {
	const { C } = useTheme();
	if (!nutrition) return null;
	const items = [
		{ label: "Calories", value: nutrition.calories, unit: "kcal", bg: "#fde8cc", color: "#a85a1a" },
		{ label: "Protein",  value: nutrition.protein,  unit: "g",    bg: "#d4f0e0", color: "#2d7a55" },
		{ label: "Carbs",    value: nutrition.carbs,    unit: "g",    bg: "#d4e8f5", color: "#2a5f8f" },
	];
	return (
		<View style={{ flexDirection: "row", gap: 8, marginBottom: 18 }}>
			{items.map((item) => (
				<View key={item.label} style={{ flex: 1, backgroundColor: item.bg, borderRadius: 12, padding: 10, alignItems: "center", borderWidth: 1, borderColor: C.borderLight }}>
					<Text style={{ fontSize: 18, fontFamily: "NunitoSans_800ExtraBold", color: item.color }}>{item.value}</Text>
					<Text style={{ fontSize: 9, fontFamily: "NunitoSans_700Bold", color: item.color, textTransform: "uppercase", marginTop: 1 }}>{item.unit}</Text>
					<Text style={{ fontSize: 10, fontFamily: "NunitoSans_400Regular", color: item.color, opacity: 0.7, marginTop: 2 }}>{item.label}</Text>
				</View>
			))}
		</View>
	);
}

const FeaturedCard = memo(function FeaturedCard({ recipe, isPro, onPress }) {

	const { C } = useTheme();
	const effectiveLocked = recipe.locked && !isPro;
	return (
		<TouchableOpacity onPress={onPress} activeOpacity={0.88} style={{ width: 200, borderRadius: 18, overflow: "hidden", backgroundColor: C.white, borderWidth: 1, borderColor: C.borderLight, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 }}>
			{recipe.imageUrl ? (
				<Image source={{ uri: recipe.imageUrl }} style={{ width: "100%", height: 120 }} resizeMode="cover" />
			) : (
				<View style={{ width: "100%", height: 120, backgroundColor: C.bgPurple, alignItems: "center", justifyContent: "center" }}>
					<CategoryIcon category={recipe.category} size={56} />
				</View>
			)}
			<View style={{ position: "absolute", top: 8, left: 8, flexDirection: "row", gap: 5 }}>
				<View style={{ backgroundColor: "rgba(212,160,23,0.92)", borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, flexDirection: "row", alignItems: "center", gap: 4 }}>
					<Icon name="starFill" size={9} color="#fff" />
					<Text style={{ fontSize: 10, fontFamily: "NunitoSans_700Bold", color: "#fff" }}>Featured</Text>
				</View>
				{effectiveLocked && (
					<View style={{ backgroundColor: "rgba(224,123,57,0.92)", borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 }}>
						<Text style={{ fontSize: 10, fontFamily: "NunitoSans_700Bold", color: "#fff" }}>PRO</Text>
					</View>
				)}
			</View>
			<View style={{ padding: 12 }}>
				<Text style={{ fontFamily: "PlusJakartaSans_600SemiBold", fontSize: 14, color: C.primaryPinkDark, marginBottom: 6 }} numberOfLines={2}>{recipe.title}</Text>
				<View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
					<View style={{ backgroundColor: C.bgGreen,   borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 }}><Text style={{ fontSize: 10, fontFamily: "NunitoSans_700Bold", color: "#2e7d52" }}>{recipe.ageGroup}</Text></View>
					<View style={{ backgroundColor: C.bgPurple, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 }}><Text style={{ fontSize: 10, fontFamily: "NunitoSans_700Bold", color: C.primaryPurple }}>{recipe.time}</Text></View>
					{recipe.freezable && <FreezableBadge />}
				</View>
			</View>
		</TouchableOpacity>
	);
});

// ── Recipe card (collapsed + expanded) ───────────────────────────────────────

// ── Recipe Detail Modal ───────────────────────────────────────────────────────

const RecipeDetailModal = memo(function RecipeDetailModal({ recipe: r, visible, isSaved, isPro, onClose, onToggleFav, onLogRecipe, onAddToList }) {
	const { C } = useTheme();
	const s = useStyles();
	if (!r) return null;
	const effectiveLocked = r.locked && !isPro;

	return (
		<Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
			<View style={{ flex: 1, backgroundColor: C.screen }}>
				{/* Header bar */}
				<View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.borderLight }}>
					<TouchableOpacity onPress={onClose} style={{ backgroundColor: C.bgPurple, borderRadius: 10, padding: 8, marginRight: 12 }}>
						<Icon name="chevDown" size={16} color={C.mutedText} />
					</TouchableOpacity>
					<Text style={[s.modalTitle, { flex: 1 }]} numberOfLines={1}>{r.title}</Text>
					{!effectiveLocked && (
						<TouchableOpacity onPress={onToggleFav} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isSaved ? "#fef6d4" : C.bgPurple, alignItems: "center", justifyContent: "center" }}>
							<Icon name={isSaved ? "starFill" : "star"} size={16} color={isSaved ? "#c49a10" : C.mutedText} />
						</TouchableOpacity>
					)}
				</View>

				<ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
					{/* Hero image or category icon */}
					{r.imageUrl ? (
						<Image source={{ uri: r.imageUrl }} style={{ width: "100%", height: 220 }} resizeMode="cover" />
					) : (
						<View style={{ height: 140, backgroundColor: C.bgPurple, alignItems: "center", justifyContent: "center" }}>
							<CategoryIcon category={r.category} size={72} />
						</View>
					)}

					<View style={{ padding: 20, gap: 18 }}>
						{/* Title + badges */}
						<View style={{ gap: 10 }}>
							<Text style={{ fontSize: 22, fontFamily: "PlusJakartaSans_700Bold", color: C.primaryPinkDark, lineHeight: 28 }}>{r.title}</Text>
							<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
								{r.featured  && <View style={{ backgroundColor: "#fef6d4", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, flexDirection: "row", alignItems: "center", gap: 4 }}><Icon name="starFill" size={9} color="#c49a10" /><Text style={{ fontSize: 11, fontFamily: "NunitoSans_700Bold", color: "#c49a10" }}>Featured</Text></View>}
								{r.category  && <View style={s.tagPurple}><Text style={s.tagPurpleText}>{r.category}</Text></View>}
								{r.ageGroup  && <View style={s.tagGreen}><Text style={s.tagGreenText}>{r.ageGroup}</Text></View>}
								{r.time      && <View style={s.tagPurple}><Text style={s.tagPurpleText}>{r.time}</Text></View>}
								{r.servings  && <View style={s.tagPurple}><Text style={s.tagPurpleText}>{r.servings} servings</Text></View>}
								{(r.tags || []).map((t) => <View key={t} style={s.tagWarning}><Text style={s.tagWarningText}>{t}</Text></View>)}
								{r.freezable && <FreezableBadge />}
							</View>
						</View>

						{/* Locked state */}
						{effectiveLocked ? (
							<View style={{ backgroundColor: C.bgPurple, borderRadius: 16, padding: 20, alignItems: "center", gap: 12 }}>
								<Icon name="lock" size={32} color={C.mutedText} />
								<Text style={{ fontSize: 16, fontFamily: "NunitoSans_800ExtraBold", color: C.textCharcoal }}>Pro Recipe</Text>
								<Text style={{ fontSize: 13, color: C.mutedText, textAlign: "center", lineHeight: 20 }}>Upgrade to Pro to unlock this recipe and hundreds more.</Text>
							</View>
						) : (
							<>
								{r.description && (
									<Text style={{ fontSize: 14, color: C.mutedText, lineHeight: 22, fontStyle: "italic" }}>{r.description}</Text>
								)}

								{r.nutrition && <NutritionBar nutrition={r.nutrition} />}

								{r.allergens?.length > 0 && (
									<View style={{ backgroundColor: "#fde8e8", borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
										<Icon name="alert" size={18} color="#c0392b" />
										<View style={{ flex: 1 }}>
											<Text style={{ fontFamily: "NunitoSans_800ExtraBold", fontSize: 13, color: "#c0392b", marginBottom: 4 }}>Contains allergens</Text>
											<Text style={{ fontSize: 13, color: "#c0392b", lineHeight: 20 }}>{r.allergens.join(", ")}</Text>
										</View>
									</View>
								)}

								{/* Ingredients */}
								<View style={{ gap: 10 }}>
									<Text style={s.sectionTitle}>Ingredients</Text>
									{(r.ingredients || []).map((ing, i) => (
										<View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: C.bgPurple, borderRadius: 12, padding: 13 }}>
											<View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.primaryPurple, marginTop: 5, flexShrink: 0 }} />
											<Text style={{ fontSize: 14, color: C.textCharcoal, fontFamily: "NunitoSans_600SemiBold", flex: 1 }}>{ing}</Text>
										</View>
									))}
								</View>

								{/* Method */}
								<View style={{ gap: 10 }}>
									<Text style={s.sectionTitle}>Method</Text>
									{(r.steps || []).map((step, i) => (
										<View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: i % 2 === 0 ? C.white : C.bgPurple, borderRadius: 12, padding: 13, borderWidth: i % 2 === 0 ? 1 : 0, borderColor: C.borderLight }}>
											<View style={{ backgroundColor: C.bgPurple, borderRadius: 999, width: 24, height: 24, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
												<Text style={{ fontSize: 12, fontFamily: "NunitoSans_800ExtraBold", color: C.primaryPurple }}>{i + 1}</Text>
											</View>
											<Text style={{ fontSize: 14, fontFamily: "NunitoSans_400Regular", color: C.textCharcoal, lineHeight: 21, flex: 1, paddingTop: 2 }}>{step}</Text>
										</View>
									))}
								</View>

								{r.notes && (
									<View style={{ backgroundColor: "#fff8e1", borderRadius: 14, padding: 16, flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
										<Icon name="sparkle" size={16} color="#a85a1a" />
										<View style={{ flex: 1 }}>
											<Text style={{ fontFamily: "NunitoSans_800ExtraBold", fontSize: 13, color: "#a85a1a", marginBottom: 4 }}>Tip</Text>
											<Text style={{ fontSize: 13, fontFamily: "NunitoSans_400Regular", color: "#7a4a10", lineHeight: 20 }}>{r.notes}</Text>
										</View>
									</View>
								)}

								{r.freezable && (
									<View style={{ backgroundColor: "#d4eef5", borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 10 }}>
										<View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#2a5f8f" }} />
										<Text style={{ fontSize: 13, fontFamily: "NunitoSans_700Bold", color: "#2a5f8f" }}>This recipe can be frozen for later use</Text>
									</View>
								)}

								{/* Actions */}
								<View style={{ gap: 10, marginTop: 4 }}>
									<View style={{ flexDirection: "row", gap: 10 }}>
										<TouchableOpacity onPress={onToggleFav} activeOpacity={0.8}
											style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: isSaved ? "#fef6d4" : C.bgPurple, borderRadius: 14, paddingVertical: 14 }}>
											<Icon name={isSaved ? "starFill" : "star"} size={17} color={isSaved ? "#c49a10" : C.mutedText} />
											<Text style={{ fontFamily: "NunitoSans_700Bold", fontSize: 14, color: isSaved ? "#c49a10" : C.mutedText }}>{isSaved ? "Saved" : "Save"}</Text>
										</TouchableOpacity>
										<TouchableOpacity onPress={onLogRecipe} activeOpacity={0.8}
											style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.primaryPurple, borderRadius: 14, paddingVertical: 14, elevation: 3 }}>
											<Icon name="plus" size={17} color={C.white} />
											<Text style={{ fontFamily: "NunitoSans_700Bold", fontSize: 14, color: C.white }}>Log This</Text>
										</TouchableOpacity>
									</View>
									{!!onAddToList && (
										<TouchableOpacity onPress={onAddToList} activeOpacity={0.8}
											style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#dbeafe", borderRadius: 14, paddingVertical: 14 }}>
											<Icon name="cart" size={17} color="#1d4ed8" />
											<Text style={{ fontFamily: "NunitoSans_700Bold", fontSize: 14, color: "#1d4ed8" }}>Add to Shopping List</Text>
										</TouchableOpacity>
									)}
								</View>
							</>
						)}
					</View>
				</ScrollView>
			</View>
		</Modal>
	);
});

// ── Recipe list card (summary only — detail opens in RecipeDetailModal) ───────

const RecipeCard = memo(function RecipeCard({ r, isSaved, isPro, onPress }) {
	const { C } = useTheme();
	const s = useStyles();
	const effectiveLocked = r.locked && !isPro;

	return (
		<TouchableOpacity
			onPress={onPress}
			activeOpacity={0.85}
			style={[s.card, { padding: 0, overflow: "hidden", opacity: effectiveLocked ? 0.82 : 1, backgroundColor: C.white }]}>
			{/* Image or icon band */}
			{r.imageUrl ? (
				<View style={{ position: "relative" }}>
					<Image source={{ uri: r.imageUrl }} style={{ width: "100%", height: 150 }} resizeMode="cover" />
					<View style={{ position: "absolute", top: 8, left: 8, flexDirection: "row", gap: 5 }}>
						{r.featured  && (
							<View style={{ backgroundColor: "rgba(196,154,16,0.92)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, flexDirection: "row", alignItems: "center", gap: 4 }}>
								<Icon name="starFill" size={9} color="#fff" />
								<Text style={{ fontSize: 10, fontFamily: "NunitoSans_700Bold", color: "#fff" }}>Featured</Text>
							</View>
						)}
						{r.freezable && (
							<View style={{ backgroundColor: "rgba(42,95,143,0.92)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, flexDirection: "row", alignItems: "center", gap: 4 }}>
								<View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: "#fff" }} />
								<Text style={{ fontSize: 10, fontFamily: "NunitoSans_700Bold", color: "#fff" }}>Freezable</Text>
							</View>
						)}
					</View>
					<View style={{ position: "absolute", top: 8, right: 8, flexDirection: "row", gap: 5 }}>
						{effectiveLocked && <View style={{ backgroundColor: C.warningStroke, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}><Text style={{ fontSize: 10, fontFamily: "NunitoSans_700Bold", color: "#fff" }}>PRO</Text></View>}
						{isSaved && (
							<View style={{ backgroundColor: "rgba(196,154,16,0.92)", borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, flexDirection: "row", alignItems: "center" }}>
								<Icon name="starFill" size={10} color="#fff" />
							</View>
						)}
					</View>
				</View>
			) : (
				<View style={{ width: "100%", height: 80, backgroundColor: C.bgPurple, alignItems: "center", justifyContent: "center" }}>
					<CategoryIcon category={r.category} size={44} />
				</View>
			)}

			<View style={{ padding: 14 }}>
				{/* Title */}
				<Text style={{ fontFamily: "PlusJakartaSans_600SemiBold", fontSize: 16, color: C.primaryPinkDark, marginBottom: 8 }} numberOfLines={2}>{r.title}</Text>

				{/* Meta pills */}
				<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
					{r.ageGroup  && <View style={{ borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: "#d4f0e0" }}><Text style={{ fontSize: 10, fontFamily: "NunitoSans_700Bold", color: "#2e7d52" }}>{r.ageGroup}</Text></View>}
					{r.time      && <View style={{ borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: C.bgPurple }}><Text style={{ fontSize: 10, fontFamily: "NunitoSans_700Bold", color: C.primaryPurple }}>{r.time}</Text></View>}
					{r.servings  && <View style={{ borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: "#dbeafe" }}><Text style={{ fontSize: 10, fontFamily: "NunitoSans_700Bold", color: "#1d4ed8" }}>{r.servings} servings</Text></View>}
					{r.category  && <View style={s.tagPurple}><Text style={s.tagPurpleText}>{r.category}</Text></View>}
					{r.freezable && <FreezableBadge />}
					{!r.imageUrl && r.featured  && (
						<View style={{ backgroundColor: "#fef6d4", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, flexDirection: "row", alignItems: "center", gap: 4 }}>
							<Icon name="starFill" size={9} color="#c49a10" />
							<Text style={{ fontSize: 10, fontFamily: "NunitoSans_700Bold", color: "#c49a10" }}>Featured</Text>
						</View>
					)}
					{!r.imageUrl && isSaved && (
						<View style={{ backgroundColor: "#fef6d4", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, flexDirection: "row", alignItems: "center", gap: 4 }}>
							<Icon name="starFill" size={9} color="#c49a10" />
							<Text style={{ fontSize: 10, fontFamily: "NunitoSans_700Bold", color: "#c49a10" }}>Saved</Text>
						</View>
					)}
					{!r.imageUrl && effectiveLocked && <View style={{ backgroundColor: C.warningStroke, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ fontSize: 10, fontFamily: "NunitoSans_700Bold", color: "#fff" }}>PRO</Text></View>}
					{r.allergens?.length > 0 && (
						<View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#fde8e8", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
							<Icon name="alert" size={9} color="#c0392b" />
							<Text style={{ fontSize: 10, fontFamily: "NunitoSans_700Bold", color: "#c0392b" }}>{r.allergens.join(", ")}</Text>
						</View>
					)}
				</View>

				{/* Description */}
				{r.description ? (
					<Text style={{ fontSize: 13, fontFamily: "NunitoSans_400Regular", color: C.mutedText, lineHeight: 19, marginBottom: 10 }} numberOfLines={2}>{r.description}</Text>
				) : null}

				{/* Bottom row */}
				<View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
					{effectiveLocked ? (
						<View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
							<Icon name="lock" size={12} color={C.mutedText} />
							<Text style={{ fontSize: 11, fontFamily: "NunitoSans_700Bold", color: C.mutedText, textTransform: "uppercase" }}>Upgrade to Pro</Text>
						</View>
					) : (
						<View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
							<Text style={{ fontSize: 13, fontFamily: "NunitoSans_700Bold", color: C.primaryPurple }}>View Recipe</Text>
							<Icon name="chevRight" size={13} color={C.primaryPurple} />
						</View>
					)}
				</View>
			</View>
		</TouchableOpacity>
	);
});

// ── Smart Recipe Card ─────────────────────────────────────────────────────────

const SMART_COLORS = [
	{ color: "#7c3aed", bg: "#ede8f7" },
	{ color: "#16a34a", bg: "#f0fdf4" },
	{ color: "#c2410c", bg: "#fff7ed" },
	{ color: "#2a5f8f", bg: "#dbeafe" },
];

const RATING_LABELS = ["", "Not for us", "It was ok", "Pretty good", "Really liked it", "Absolutely loved it!"];

function SmartStarRating({ rating, onRate, size = 22 }) {
	const { C } = useTheme();
	return (
		<View style={{ flexDirection: "row", gap: 6 }}>
			{[1, 2, 3, 4, 5].map((star) => (
				<TouchableOpacity key={star} onPress={() => onRate(star)} hitSlop={6} activeOpacity={0.7}>
					<Icon
						name={star <= (rating || 0) ? "starFill" : "star"}
						size={size}
						color={star <= (rating || 0) ? "#c49a10" : (C.borderLight || "#d1d5db")}
					/>
				</TouchableOpacity>
			))}
		</View>
	);
}

// ── Smart Recipe Detail Modal ─────────────────────────────────────────────────

const SmartRecipeDetailModal = memo(function SmartRecipeDetailModal({ recipe: r, visible, onClose, onRate, onDelete, onAddToList, onLogRecipe }) {
	const { C } = useTheme();
	if (!r) return null;

	const index = 0; // colour is fixed per recipe via recipe.colorIndex passed in
	const { color, bg } = SMART_COLORS[(r.colorIndex ?? 0) % SMART_COLORS.length];

	const savedAt = r.savedAt?.toDate?.() || (r.savedAt ? new Date(r.savedAt) : null);
	const dateStr = savedAt
		? savedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
		: "";

	return (
		<Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
			<View style={{ flex: 1, backgroundColor: C.screen }}>
				{/* Colour strip */}
				<View style={{ height: 4, backgroundColor: color }} />

				{/* Header bar */}
				<View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.borderLight }}>
					<TouchableOpacity onPress={onClose} style={{ backgroundColor: C.bgPurple, borderRadius: 10, padding: 8, marginRight: 12 }}>
						<Icon name="chevDown" size={16} color={C.mutedText} />
					</TouchableOpacity>
					<Text style={{ flex: 1, fontSize: 16, fontFamily: "NunitoSans_800ExtraBold", color: C.textCharcoal }} numberOfLines={1}>{r.title}</Text>
					{r.rating ? (
						<View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
							<Icon name="starFill" size={14} color="#c49a10" />
							<Text style={{ fontSize: 13, fontFamily: "NunitoSans_700Bold", color: "#c49a10" }}>{r.rating}</Text>
						</View>
					) : null}
				</View>

				<ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
					{/* Hero block */}
					<View style={{ backgroundColor: bg, padding: 20, gap: 12 }}>
						<View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
							<View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: color + "22", alignItems: "center", justifyContent: "center" }}>
								<Icon name="sparkle" size={28} color={color} />
							</View>
							<View style={{ flex: 1, gap: 6 }}>
								<Text style={{ fontSize: 20, fontFamily: "PlusJakartaSans_700Bold", color: C.textCharcoal, lineHeight: 26 }}>{r.title}</Text>
								<View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
									<View style={{ backgroundColor: "#7c3aed", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
										<Text style={{ fontSize: 9, fontFamily: "NunitoSans_800ExtraBold", color: "#fff", textTransform: "uppercase", letterSpacing: 0.5 }}>AI Generated</Text>
									</View>
									{r.mealType && (
										<View style={{ backgroundColor: color + "22", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
											<Text style={{ fontSize: 11, fontFamily: "NunitoSans_700Bold", color }}>{r.mealType}</Text>
										</View>
									)}
									{r.ageGroup && (
										<View style={{ backgroundColor: C.bgPurple, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
											<Text style={{ fontSize: 11, fontFamily: "NunitoSans_700Bold", color: C.primaryPurple }}>{r.ageGroup}</Text>
										</View>
									)}
								</View>
							</View>
						</View>
						<View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
							{r.childName ? <Text style={{ fontSize: 12, color: C.mutedText }}>For {r.childName}</Text> : <View />}
							{dateStr ? <Text style={{ fontSize: 11, color: C.mutedText }}>{dateStr}</Text> : null}
						</View>
					</View>

					<View style={{ padding: 20, gap: 18 }}>
						{/* Description */}
						{r.description ? (
							<Text style={{ fontSize: 14, color: C.mutedText, lineHeight: 22, fontStyle: "italic" }}>{r.description}</Text>
						) : null}

						{/* Why suggested */}
						{r.whySuggested ? (
							<View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: C.bgPurple, borderRadius: 14, padding: 14 }}>
								<Icon name="sparkle" size={15} color={C.primaryPurple} />
								<View style={{ flex: 1 }}>
									<Text style={{ fontSize: 12, fontFamily: "NunitoSans_800ExtraBold", color: C.primaryPurple, marginBottom: 4 }}>Why we suggested this</Text>
									<Text style={{ fontSize: 13, color: C.primaryPurpleDark, lineHeight: 19 }}>{r.whySuggested}</Text>
								</View>
							</View>
						) : null}

						{/* Nutrition */}
						{r.nutrition && (
							<View style={{ gap: 8 }}>
								<Text style={{ fontSize: 11, fontFamily: "NunitoSans_800ExtraBold", color: C.mutedText, textTransform: "uppercase", letterSpacing: 0.5 }}>Approx. nutrition per serving</Text>
								<NutritionBar nutrition={r.nutrition} />
								<Text style={{ fontSize: 10, color: C.mutedText, fontStyle: "italic", marginTop: -12 }}>Values are estimates only — not medical or dietetic advice</Text>
							</View>
						)}

						{/* New food highlight */}
						{r.newFood ? (
							<View style={{ backgroundColor: "#fef9c3", borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 10 }}>
								<Icon name="sparkle" size={16} color="#ca8a04" />
								<Text style={{ fontSize: 13, fontFamily: "NunitoSans_700Bold", color: "#92400e" }}>New food: {r.newFood}</Text>
							</View>
						) : null}

						{/* Allergens */}
						{r.allergens?.length > 0 && (
							<View style={{ backgroundColor: "#fde8e8", borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
								<Icon name="alert" size={18} color="#c0392b" />
								<View style={{ flex: 1 }}>
									<Text style={{ fontFamily: "NunitoSans_800ExtraBold", fontSize: 13, color: "#c0392b", marginBottom: 4 }}>Contains allergens</Text>
									<Text style={{ fontSize: 13, color: "#c0392b", lineHeight: 20 }}>{r.allergens.join(", ")}</Text>
								</View>
							</View>
						)}

						{/* Ingredients */}
						{r.ingredients?.length > 0 && (
							<View style={{ gap: 10 }}>
								<Text style={{ fontSize: 13, fontFamily: "NunitoSans_800ExtraBold", color: C.textCharcoal, textTransform: "uppercase", letterSpacing: 0.5 }}>Ingredients</Text>
								{r.ingredients.map((ing, i) => (
									<View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: C.bgPurple, borderRadius: 12, padding: 13 }}>
										<View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, marginTop: 5, flexShrink: 0 }} />
										<Text style={{ fontSize: 14, color: C.textCharcoal, fontFamily: "NunitoSans_600SemiBold", flex: 1 }}>{ing}</Text>
									</View>
								))}
							</View>
						)}

						{/* Steps */}
						{r.steps?.length > 0 && (
							<View style={{ gap: 10 }}>
								<Text style={{ fontSize: 13, fontFamily: "NunitoSans_800ExtraBold", color: C.textCharcoal, textTransform: "uppercase", letterSpacing: 0.5 }}>Method</Text>
								{r.steps.map((step, i) => (
									<View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: i % 2 === 0 ? C.white : C.bgPurple, borderRadius: 12, padding: 13, borderWidth: i % 2 === 0 ? 1 : 0, borderColor: C.borderLight }}>
										<View style={{ backgroundColor: color, borderRadius: 10, width: 26, height: 26, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
											<Text style={{ fontSize: 12, fontFamily: "NunitoSans_700Bold", color: "#fff" }}>{i + 1}</Text>
										</View>
										<Text style={{ fontSize: 14, color: C.textCharcoal, lineHeight: 21, flex: 1, paddingTop: 2 }}>{step}</Text>
									</View>
								))}
							</View>
						)}

						{/* Serving suggestions */}
						{r.servingSuggestions?.length > 0 && (
							<View style={{ gap: 10 }}>
								<Text style={{ fontSize: 13, fontFamily: "NunitoSans_800ExtraBold", color: C.textCharcoal, textTransform: "uppercase", letterSpacing: 0.5 }}>Serve with</Text>
								{r.servingSuggestions.map((suggestion, i) => (
									<View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: C.bgPurple, borderRadius: 12, padding: 13 }}>
										<View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, marginTop: 6, flexShrink: 0 }} />
										<Text style={{ fontSize: 14, color: C.textCharcoal, fontFamily: "NunitoSans_400Regular", flex: 1, lineHeight: 21 }}>{suggestion}</Text>
									</View>
								))}
							</View>
						)}

						{/* Star rating */}
						<View style={{ backgroundColor: C.bgPurple, borderRadius: 16, padding: 16, gap: 10 }}>
							<Text style={{ fontSize: 13, fontFamily: "NunitoSans_800ExtraBold", color: C.textCharcoal }}>
								{r.rating ? "Your rating" : "Rate this recipe"}
							</Text>
							<SmartStarRating rating={r.rating} onRate={onRate} size={26} />
							{r.rating ? (
								<Text style={{ fontSize: 13, color: "#c49a10", fontFamily: "NunitoSans_600SemiBold" }}>{RATING_LABELS[r.rating]}</Text>
							) : (
								<Text style={{ fontSize: 12, color: C.mutedText }}>Tap a star to rate</Text>
							)}
						</View>

						{/* Actions */}
						<View style={{ gap: 10 }}>
							{onLogRecipe && (
								<TouchableOpacity onPress={onLogRecipe} activeOpacity={0.8}
									style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.primaryPurple, borderRadius: 14, paddingVertical: 14, elevation: 3 }}>
									<Icon name="plus" size={17} color={C.white} />
									<Text style={{ fontFamily: "NunitoSans_700Bold", fontSize: 14, color: C.white }}>Log This</Text>
								</TouchableOpacity>
							)}
							<View style={{ flexDirection: "row", gap: 10 }}>
								{onAddToList && (
									<TouchableOpacity onPress={onAddToList} activeOpacity={0.8}
										style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#dbeafe", borderRadius: 14, paddingVertical: 14 }}>
										<Icon name="cart" size={17} color="#1d4ed8" />
										<Text style={{ fontFamily: "NunitoSans_700Bold", fontSize: 14, color: "#1d4ed8" }}>Shopping List</Text>
									</TouchableOpacity>
								)}
								<TouchableOpacity onPress={onDelete} activeOpacity={0.8}
									style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#fef2f2", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20 }}>
									<Icon name="trash" size={17} color="#c0392b" />
									<Text style={{ fontFamily: "NunitoSans_700Bold", fontSize: 14, color: "#c0392b" }}>Delete</Text>
								</TouchableOpacity>
							</View>
						</View>
					</View>
				</ScrollView>
			</View>
		</Modal>
	);
});

// ── Smart Recipe list card (summary only) ─────────────────────────────────────

const SmartRecipeCard = memo(function SmartRecipeCard({ recipe, colorIndex, onPress }) {
	const { C } = useTheme();
	const { color, bg } = SMART_COLORS[colorIndex % SMART_COLORS.length];

	const savedAt = recipe.savedAt?.toDate?.() || (recipe.savedAt ? new Date(recipe.savedAt) : null);
	const dateStr = savedAt
		? savedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
		: "";

	return (
		<TouchableOpacity onPress={onPress} activeOpacity={0.85} style={{
			backgroundColor: C.white, borderRadius: 18, overflow: "hidden",
			shadowColor: color, shadowOpacity: 0.1, shadowRadius: 12,
			shadowOffset: { width: 0, height: 4 }, elevation: 3,
		}}>
			{/* Colour strip */}
			<View style={{ height: 4, backgroundColor: color }} />

			<View style={{ padding: 16, gap: 10 }}>
				{/* Header */}
				<View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
					<View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: bg, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
						<Icon name="sparkle" size={22} color={color} />
					</View>
					<View style={{ flex: 1 }}>
						<Text style={{ fontSize: 15, fontFamily: "NunitoSans_800ExtraBold", color: C.textCharcoal, marginBottom: 4 }}>{recipe.title}</Text>
						<View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
							<View style={{ backgroundColor: "#7c3aed", borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 }}>
								<Text style={{ fontSize: 9, fontFamily: "NunitoSans_800ExtraBold", color: "#fff", textTransform: "uppercase", letterSpacing: 0.4 }}>AI</Text>
							</View>
							{recipe.mealType && (
								<View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
									<Text style={{ fontSize: 10, fontFamily: "NunitoSans_700Bold", color }}>{recipe.mealType}</Text>
								</View>
							)}
							{recipe.ageGroup && (
								<View style={{ backgroundColor: C.bgPurple, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
									<Text style={{ fontSize: 10, fontFamily: "NunitoSans_700Bold", color: C.primaryPurple }}>{recipe.ageGroup}</Text>
								</View>
							)}
							{recipe.childName && (
								<Text style={{ fontSize: 10, color: C.mutedText }}>for {recipe.childName}</Text>
							)}
						</View>
					</View>
					{/* Rating + chevron */}
					<View style={{ alignItems: "flex-end", gap: 4 }}>
						{recipe.rating ? (
							<View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
								<Icon name="starFill" size={12} color="#c49a10" />
								<Text style={{ fontSize: 11, fontFamily: "NunitoSans_700Bold", color: "#c49a10" }}>{recipe.rating}</Text>
							</View>
						) : null}
						<Icon name="chevRight" size={15} color={C.mutedText} />
					</View>
				</View>

				{/* Description preview */}
				{recipe.description ? (
					<Text style={{ fontSize: 13, color: C.mutedText, lineHeight: 19 }} numberOfLines={2}>
						{recipe.description}
					</Text>
				) : null}

				{/* New food + date */}
				<View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
					{recipe.newFood ? (
						<View style={{ backgroundColor: "#fef9c3", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, flexDirection: "row", alignItems: "center", gap: 5 }}>
							<Icon name="sparkle" size={10} color="#ca8a04" />
							<Text style={{ fontSize: 11, fontFamily: "NunitoSans_700Bold", color: "#ca8a04" }}>New food: {recipe.newFood}</Text>
						</View>
					) : <View />}
					{dateStr ? <Text style={{ fontSize: 10, color: C.mutedText }}>{dateStr}</Text> : null}
				</View>
			</View>
		</TouchableOpacity>
	);
});

// ── Screen ────────────────────────────────────────────────────────────────────

const EMPTY_SUGGEST = { title: "", category: "", ageGroup: "", time: "", description: "", ingredients: "", steps: "" };

export function RecipesScreen({ isPro, recipes, favouriteRecipeIds, onUpgradePro, onToggleFav, onLogRecipe, onRestorePurchases, user, jumpToRecipeId = null, onJumpHandled, onAddToShoppingList, smartRecipes = [], onDeleteSmartRecipe, onRateSmartRecipe }) {
	const { C } = useTheme();
	const s = useStyles();

	const [selectedRecipe,      setSelectedRecipe]     = useState(null);  // regular recipe open in detail modal
	const [selectedSmartRecipe, setSelectedSmartRecipe] = useState(null); // smart recipe open in detail modal
	const [filterAge,          setFilterAge]          = useState("all");
	const [searchQuery,        setSearchQuery]        = useState("");
	const [upgradeLoading,     setUpgradeLoading]     = useState(false);
	const [upgradePlan,        setUpgradePlan]        = useState("monthly");
	const [showSuggest,        setShowSuggest]        = useState(false);
	const [suggestForm,        setSuggestForm]        = useState(EMPTY_SUGGEST);
	const [suggestSent,        setSuggestSent]        = useState(false);
	const [suggestLoading,     setSuggestLoading]     = useState(false);
	// Shopping list ingredient picker
	const [shopPickerRecipe,   setShopPickerRecipe]   = useState(null);
	const [shopPickerChecked,  setShopPickerChecked]  = useState({});
	const [shopPickerLoading,  setShopPickerLoading]  = useState(false);

	const setSF = (k, v) => setSuggestForm((p) => ({ ...p, [k]: v }));

	const openRecipe = (recipe) => { if (recipe.locked && !isPro) return; setSelectedRecipe(recipe); };

	// Shopping list picker helpers
	const openShopPicker = (recipe) => {
		const init = {};
		(recipe.ingredients || []).forEach((_, i) => { init[i] = true; });
		setShopPickerChecked(init);
		setShopPickerRecipe(recipe);
	};

	const handleShopPickerAdd = async () => {
		if (!shopPickerRecipe || !onAddToShoppingList) return;
		const selected = (shopPickerRecipe.ingredients || []).filter((_, i) => shopPickerChecked[i]);
		if (selected.length === 0) return;
		setShopPickerLoading(true);
		try {
			await onAddToShoppingList(shopPickerRecipe.id, shopPickerRecipe.title, selected);
			setShopPickerRecipe(null); // close modal — navigation to shopping handled by MealsHubScreen
		} catch (e) {
			Alert.alert("Couldn't add items", e?.message || "Please check your connection and try again.");
		} finally {
			setShopPickerLoading(false);
		}
	};

	const handleSuggestSubmit = async () => {
		if (!suggestForm.title || !suggestForm.description || !suggestForm.ingredients || !suggestForm.steps) {
			Alert.alert("Missing info", "Please fill in title, description, ingredients and steps.");
			return;
		}
		setSuggestLoading(true);
		try {
			await addDoc(collection(db, "recipeSuggestions"), {
				...suggestForm,
				ingredients: suggestForm.ingredients.split("\n").map((s) => s.trim()).filter(Boolean),
				steps:       suggestForm.steps.split("\n").map((s) => s.trim()).filter(Boolean),
				userId: user?.uid || "", userEmail: user?.email || "",
				status: "pending", createdAt: serverTimestamp(),
			});
			setSuggestSent(true);
		} catch {
			Alert.alert("Error", "Could not submit. Please try again.");
		}
		setSuggestLoading(false);
	};

	const ageGroups = ["all", "4-6m+", "6m+", "7-9m+", "10m+"];

	const { filtered, featuredRecipes } = useMemo(() => {
		const q = searchQuery.trim().toLowerCase();
		let base = filterAge === "all" ? recipes
			: filterAge === "saved" ? recipes.filter((r) => favouriteRecipeIds.includes(r.id))
			: recipes.filter((r) => r.ageGroup === filterAge);
		if (q) base = base.filter((r) =>
			r.title?.toLowerCase().includes(q) ||
			r.description?.toLowerCase().includes(q) ||
			(r.ingredients || []).some((ing) => ing.toLowerCase().includes(q))
		);
		if (!isPro) base = [...base.filter((r) => !r.locked), ...base.filter((r) => r.locked)];
		return {
			filtered: base,
			featuredRecipes: recipes.filter((r) => r.featured),
		};
	}, [recipes, favouriteRecipeIds, filterAge, searchQuery, isPro]);

	React.useEffect(() => {
		if (!jumpToRecipeId) return;
		const recipe = recipes.find((r) => r.id === jumpToRecipeId);
		if (!recipe) return;
		const timer = setTimeout(() => { openRecipe(recipe); onJumpHandled?.(); }, 450);
		return () => clearTimeout(timer);
	}, [jumpToRecipeId]);

	return (
		<>
		<ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 24 }}>

			{/* Page title */}
			<Text style={s.pageTitle}>Recipes</Text>

			{/* Pro upgrade banner */}
			{!isPro && (
				<View style={{ backgroundColor: "#2d1f5e", borderRadius: 20, padding: 20, overflow: "hidden" }}>
					<View style={{ position: "absolute", top: -24, right: -24, width: 110, height: 110, borderRadius: 55, backgroundColor: "rgba(155,127,232,0.18)" }} />
					<View style={{ position: "absolute", bottom: -16, left: -16, width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(61,184,122,0.12)" }} />

					{/* Header */}
					<View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 }}>
						<View style={{ backgroundColor: "#f5c842", borderRadius: 10, width: 34, height: 34, alignItems: "center", justifyContent: "center" }}>
							<Icon name="crown" size={17} color="#2d1f5e" />
						</View>
						<View>
							<Text style={{ fontFamily: "PlusJakartaSans_700Bold", fontSize: 17, color: "#fff", letterSpacing: -0.3 }}>Munch Sprouts Pro</Text>
							<Text style={{ fontSize: 12, color: "#f5c842", fontFamily: "NunitoSans_700Bold" }}>
								{upgradePlan === "lifetime" ? "£39.99 one-off" : upgradePlan === "yearly" ? "£19.99 / year" : "£2.99 / month"}
							</Text>
						</View>
					</View>

					{/* Plan toggle */}
					<View style={{ flexDirection: "row", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 12, padding: 4, marginTop: 14, marginBottom: 14 }}>
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
										<Text style={{ fontFamily: "NunitoSans_800ExtraBold", fontSize: 13, color: active ? "#2d1f5e" : "rgba(255,255,255,0.6)" }}>
											{label}
										</Text>
										{badge && (
											<View style={{ backgroundColor: active ? "#2d1f5e" : "rgba(245,200,66,0.25)", borderRadius: 999, paddingHorizontal: 5, paddingVertical: 1 }}>
												<Text style={{ fontSize: 9, fontFamily: "NunitoSans_700Bold", color: "#f5c842" }}>{badge}</Text>
											</View>
										)}
									</View>
									<Text style={{ fontSize: 11, fontFamily: "NunitoSans_600SemiBold", color: active ? "#2d1f5e" : "rgba(255,255,255,0.45)", marginTop: 1 }}>{price}</Text>
								</TouchableOpacity>
							);
						})}
					</View>

					{/* Feature list */}
					{["Access to all BLW recipes", "Recipes for every age group", "Nutritionist-approved meal ideas", "New recipes added regularly", "Unlimited child profiles", "PDF export, milestones & more"].map((f, i) => (
						<View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 7 }}>
							<View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: "#3db87a", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
								<Icon name="check" size={12} color="#fff" />
							</View>
							<Text style={{ fontSize: 13, color: "rgba(255,255,255,0.9)", flex: 1 }}>{f}</Text>
						</View>
					))}

					{/* CTA */}
					<TouchableOpacity
						onPress={() => { setUpgradeLoading(true); onUpgradePro?.(upgradePlan).finally(() => setUpgradeLoading(false)); }}
						disabled={upgradeLoading}
						style={{ backgroundColor: "#f5c842", borderRadius: 14, paddingVertical: 14, alignItems: "center", justifyContent: "center", marginTop: 16, flexDirection: "row", gap: 8, opacity: upgradeLoading ? 0.7 : 1 }}
						activeOpacity={0.85}>
						{upgradeLoading ? <ActivityIndicator color="#2d1f5e" /> : (
							<>
								<Icon name="crown" size={15} color="#2d1f5e" />
								<Text style={{ color: "#2d1f5e", fontFamily: "NunitoSans_800ExtraBold", fontSize: 15 }}>
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
							<Text style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontFamily: "NunitoSans_600SemiBold" }}>Restore purchase</Text>
						</TouchableOpacity>
						<Text style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", fontFamily: "NunitoSans_600SemiBold" }}>·</Text>
						<TouchableOpacity onPress={() => Linking.openURL("https://apps.apple.com/account/subscriptions")}>
							<Text style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontFamily: "NunitoSans_600SemiBold" }}>Manage subscription</Text>
						</TouchableOpacity>
					</View>
					<Text style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", textAlign: "center", paddingTop: 8, paddingHorizontal: 8, lineHeight: 14 }}>
						{upgradePlan === "lifetime"
							? "One-time payment. No subscription, no renewal."
							: `Subscription ${upgradePlan === "yearly" ? "renews annually at £19.99" : "renews monthly at £2.99"} unless cancelled at least 24 hours before the end of the current period. Manage or cancel in your Apple ID settings.`}
					</Text>
					<View style={{ flexDirection: "row", justifyContent: "center", gap: 16, paddingTop: 6 }}>
						<TouchableOpacity onPress={() => Linking.openURL(LEGAL_URLS.privacy)}>
							<Text style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "NunitoSans_400Regular" }}>Privacy Policy</Text>
						</TouchableOpacity>
						<Text style={{ fontSize: 11, color: "rgba(255,255,255,0.15)", fontFamily: "NunitoSans_400Regular" }}>·</Text>
						<TouchableOpacity onPress={() => Linking.openURL(LEGAL_URLS.terms)}>
							<Text style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "NunitoSans_400Regular" }}>Terms of Use</Text>
						</TouchableOpacity>
					</View>
				</View>
			)}

			{isPro && (
				<View style={{ backgroundColor: C.bgGreen, borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
					<Icon name="unlock" size={22} color={C.primaryGreen} />
					<Text style={{ fontFamily: "NunitoSans_700Bold", fontSize: 14, color: "#2e7d52" }}>Pro — All recipes unlocked</Text>
				</View>
			)}

			{/* Featured section */}
			{featuredRecipes.length > 0 && (
				<View>
					<View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
						<Icon name="starFill" size={14} color="#c49a10" />
						<Text style={[s.sectionTitle, { color: "#c49a10" }]}>Featured Recipes</Text>
					</View>
					<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 2, paddingBottom: 4 }}>
						{featuredRecipes.map((r) => (
							<FeaturedCard key={r.id} recipe={r} isPro={isPro} onPress={() => openRecipe(r)} />
						))}
					</ScrollView>
				</View>
			)}

			{/* Search */}
			<View style={[s.input, { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.white, borderColor: searchQuery ? C.primaryPurple : C.borderLight }]}>
				<Icon name="search" size={16} color={searchQuery ? C.primaryPurple : C.mutedText} />
				<TextInput value={searchQuery} onChangeText={setSearchQuery} placeholder="Search by ingredient or recipe name…" placeholderTextColor={C.mutedText} style={{ flex: 1, fontSize: 14, color: C.textCharcoal, fontFamily: "NunitoSans_400Regular", paddingVertical: 0 }} autoCorrect={false} autoCapitalize="none" returnKeyType="search" />
				{searchQuery.length > 0 && <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={8}><Icon name="close" size={14} color={C.mutedText} /></TouchableOpacity>}
			</View>

			{/* Age filter chips */}
			<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}>
				{ageGroups.map((ag) => {
					const active = filterAge === ag;
					return (
						<TouchableOpacity key={ag} onPress={() => setFilterAge(ag)} style={{ backgroundColor: active ? C.primaryPurple : C.white, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1.5, borderColor: active ? C.primaryPurple : C.borderLight, height: 34, justifyContent: "center" }}>
							<Text style={{ fontFamily: "NunitoSans_700Bold", fontSize: 12, color: active ? C.white : C.mutedText }}>{ag === "all" ? "All Ages" : ag}</Text>
						</TouchableOpacity>
					);
				})}
				<TouchableOpacity onPress={() => setFilterAge("saved")} style={{ backgroundColor: filterAge === "saved" ? "#c49a10" : C.white, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1.5, borderColor: filterAge === "saved" ? "#c49a10" : C.borderLight, height: 34 }}>
					<Icon name="starFill" size={12} color={filterAge === "saved" ? C.white : "#c49a10"} />
					<Text style={{ fontFamily: "NunitoSans_700Bold", fontSize: 12, color: filterAge === "saved" ? C.white : "#c49a10" }}>Saved</Text>
				</TouchableOpacity>
				{/* Smart Recipes tab */}
				<TouchableOpacity onPress={() => setFilterAge("smart")} style={{ backgroundColor: filterAge === "smart" ? "#7c3aed" : C.white, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1.5, borderColor: filterAge === "smart" ? "#7c3aed" : C.borderLight, height: 34 }}>
					<Icon name="sparkle" size={12} color={filterAge === "smart" ? C.white : "#7c3aed"} />
					<Text style={{ fontFamily: "NunitoSans_700Bold", fontSize: 12, color: filterAge === "smart" ? C.white : "#7c3aed" }}>Smart Recipes</Text>
					{smartRecipes.length > 0 && (
						<View style={{ backgroundColor: filterAge === "smart" ? "rgba(255,255,255,0.3)" : "#ede8f7", borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1, minWidth: 18, alignItems: "center" }}>
							<Text style={{ fontSize: 10, fontFamily: "NunitoSans_800ExtraBold", color: filterAge === "smart" ? "#fff" : "#7c3aed" }}>{smartRecipes.length}</Text>
						</View>
					)}
				</TouchableOpacity>
			</ScrollView>

			{/* Suggest a recipe button */}
			<TouchableOpacity
				onPress={() => { setShowSuggest(true); setSuggestSent(false); setSuggestForm(EMPTY_SUGGEST); }}
				style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.bgPurple, borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: C.borderLight }}
				activeOpacity={0.8}>
				<View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: C.primaryPurple + "22", alignItems: "center", justifyContent: "center" }}>
					<Icon name="plus" size={18} color={C.primaryPurple} />
				</View>
				<View style={{ flex: 1 }}>
					<Text style={{ fontFamily: "NunitoSans_700Bold", fontSize: 14, color: C.primaryPurple }}>Suggest a Recipe</Text>
					<Text style={{ fontSize: 12, color: C.mutedText, marginTop: 2 }}>Submit your own BLW recipe for review</Text>
				</View>
				<Icon name="chevRight" size={16} color={C.mutedText} />
			</TouchableOpacity>

			{/* Suggest modal */}
			<Modal visible={showSuggest} transparent animationType="slide" onRequestClose={() => setShowSuggest(false)}>
				<KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={s.modalOverlay}>
					<View style={[s.modalSheet, { maxHeight: "92%" }]}>
						<View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
							<Text style={s.modalTitle}>Suggest a Recipe</Text>
							<TouchableOpacity onPress={() => setShowSuggest(false)} style={{ backgroundColor: C.bgPurple, borderRadius: 10, padding: 8 }}>
								<Icon name="close" size={16} color={C.mutedText} />
							</TouchableOpacity>
						</View>
						{suggestSent ? (
							<View style={{ alignItems: "center", paddingVertical: 30 }}>
								<View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: C.statGreenBg, alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
									<Icon name="check" size={28} color={C.statGreenText} />
								</View>
								<Text style={{ fontFamily: "PlusJakartaSans_700Bold", fontSize: 18, color: C.primaryPinkDark, marginBottom: 8 }}>Recipe Submitted!</Text>
								<Text style={{ fontSize: 14, color: C.mutedText, textAlign: "center", lineHeight: 22 }}>Thank you! We'll review your recipe and add it to the app if approved.</Text>
								<TouchableOpacity onPress={() => setShowSuggest(false)} style={[s.btnPrimary, { marginTop: 24 }]}>
									<Text style={s.btnPrimaryText}>Done</Text>
								</TouchableOpacity>
							</View>
						) : (
							<ScrollView showsVerticalScrollIndicator={false}>
								<View style={{ gap: 14, paddingBottom: 20 }}>
									{[
										{ key: "title",    label: "Recipe Name *",  placeholder: "e.g. Sweet Potato Fritters" },
										{ key: "category", label: "Category",        placeholder: "e.g. Mains" },
										{ key: "ageGroup", label: "Age Group",        placeholder: "e.g. 6m+" },
										{ key: "time",     label: "Prep Time",        placeholder: "e.g. 20 min" },
									].map(({ key, label, placeholder }) => (
										<View key={key}>
											<Text style={s.label}>{label}</Text>
											<TextInput value={suggestForm[key]} onChangeText={(v) => setSF(key, v)} placeholder={placeholder} style={[s.input, { backgroundColor: C.white }]} placeholderTextColor={C.mutedText} autoComplete="off" autoCorrect={false} />
										</View>
									))}
									<View>
										<Text style={s.label}>Description *</Text>
										<TextInput value={suggestForm.description} onChangeText={(v) => setSF("description", v)} placeholder="Brief description of the recipe" multiline numberOfLines={3} style={[s.input, { height: 80, textAlignVertical: "top", backgroundColor: C.white }]} placeholderTextColor={C.mutedText} autoComplete="off" />
									</View>
									<View>
										<Text style={s.label}>Ingredients * (one per line)</Text>
										<TextInput value={suggestForm.ingredients} onChangeText={(v) => setSF("ingredients", v)} placeholder={"1 sweet potato\n2 tbsp flour\n1 egg"} multiline numberOfLines={5} style={[s.input, { height: 120, textAlignVertical: "top", backgroundColor: C.white }]} placeholderTextColor={C.mutedText} autoComplete="off" />
									</View>
									<View>
										<Text style={s.label}>Method / Steps * (one per line)</Text>
										<TextInput value={suggestForm.steps} onChangeText={(v) => setSF("steps", v)} placeholder={"Peel and grate the sweet potato\nMix with flour and egg\nFry until golden"} multiline numberOfLines={6} style={[s.input, { height: 140, textAlignVertical: "top", backgroundColor: C.white }]} placeholderTextColor={C.mutedText} autoComplete="off" />
									</View>
									<View style={{ backgroundColor: C.bgPurple, borderRadius: 12, padding: 14 }}>
										<Text style={{ fontSize: 12, color: C.mutedText, lineHeight: 18 }}>Your recipe will be reviewed by the Munch Sprouts team before being added to the app.</Text>
									</View>
									<TouchableOpacity onPress={handleSuggestSubmit} disabled={suggestLoading} style={[s.btnPrimary, suggestLoading && { opacity: 0.6 }]} activeOpacity={0.8}>
										{suggestLoading ? <ActivityIndicator color="#ffffff" /> : <Text style={s.btnPrimaryText}>Submit Recipe</Text>}
									</TouchableOpacity>
								</View>
							</ScrollView>
						)}
					</View>
				</KeyboardAvoidingView>
			</Modal>

			{/* Smart Recipes list */}
			{filterAge === "smart" && (
				/* ── Pro gate ── */
				!isPro ? (
					<View style={{ backgroundColor: "#2d1f5e", borderRadius: 20, padding: 24, alignItems: "center", gap: 16, overflow: "hidden" }}>
						{/* Decorative circles */}
						<View style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(155,127,232,0.15)" }} />
						<View style={{ position: "absolute", bottom: -20, left: -20, width: 90, height: 90, borderRadius: 45, backgroundColor: "rgba(61,184,122,0.1)" }} />
						<View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: "#f5c84222", alignItems: "center", justifyContent: "center" }}>
							<Icon name="sparkle" size={30} color="#f5c842" />
						</View>
						<View style={{ alignItems: "center", gap: 8 }}>
							<Text style={{ fontSize: 20, fontFamily: "PlusJakartaSans_700Bold", color: "#fff", textAlign: "center" }}>Smart Recipes</Text>
							<Text style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", textAlign: "center", lineHeight: 20, paddingHorizontal: 8 }}>
								AI-generated meal ideas personalised to your child are saved here automatically.{"\n"}Upgrade to Pro to unlock Smart Meal Ideas and Smart Recipes.
							</Text>
						</View>
						<TouchableOpacity
							onPress={onUpgradePro}
							activeOpacity={0.85}
							style={{ backgroundColor: "#f5c842", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, flexDirection: "row", alignItems: "center", gap: 8 }}>
							<Icon name="crown" size={16} color="#2d1f5e" />
							<Text style={{ color: "#2d1f5e", fontFamily: "PlusJakartaSans_600SemiBold", fontSize: 15 }}>Upgrade to Pro</Text>
						</TouchableOpacity>
					</View>
				) : smartRecipes.length === 0 ? (
					/* ── Empty state (Pro, no recipes yet) ── */
					<View style={{ alignItems: "center", paddingVertical: 48, gap: 14 }}>
						<View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: "#ede8f7", alignItems: "center", justifyContent: "center" }}>
							<Icon name="sparkle" size={32} color="#7c3aed" />
						</View>
						<Text style={{ fontSize: 17, fontFamily: "PlusJakartaSans_700Bold", color: C.textCharcoal }}>No Smart Recipes yet</Text>
						<Text style={{ fontSize: 13, fontFamily: "NunitoSans_400Regular", color: C.mutedText, textAlign: "center", lineHeight: 20, paddingHorizontal: 20 }}>
							Go to Smart Meal Ideas and generate some ideas — they'll be automatically saved here.
						</Text>
					</View>
				) : (
					/* ── Recipe list ── */
					<View style={{ gap: 14 }}>
						{/* Disclaimer */}
						<View style={{ backgroundColor: "#fff8e1", borderRadius: 14, padding: 14, gap: 8, borderWidth: 1, borderColor: "#fde68a" }}>
							<View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
								<Icon name="alert" size={14} color="#a85a1a" />
								<Text style={{ fontSize: 12, fontFamily: "NunitoSans_800ExtraBold", color: "#a85a1a" }}>AI-generated suggestions only</Text>
							</View>
							<Text style={{ fontSize: 11, color: "#7a4a10", lineHeight: 17 }}>
								These recipes are generated by AI for inspiration and are not medical or nutritional advice. Nutritional values are estimates. Always consult your health visitor, GP, or dietitian regarding allergies or feeding concerns.
							</Text>
						</View>
						<Text style={{ fontSize: 13, color: C.mutedText }}>{smartRecipes.length} AI-generated recipe{smartRecipes.length !== 1 ? "s" : ""} saved</Text>
						{smartRecipes.map((r, i) => (
							<SmartRecipeCard
								key={r.id}
								recipe={r}
								colorIndex={i}
								onPress={() => setSelectedSmartRecipe({ ...r, colorIndex: i })}
							/>
						))}
					</View>
				)
			)}

			{/* Regular recipe list */}
			{filterAge !== "smart" && filtered.map((r) => (
				<RecipeCard
					key={r.id}
					r={r}
					isSaved={favouriteRecipeIds.includes(r.id)}
					isPro={isPro}
					onPress={() => openRecipe(r)}
				/>
			))}
		</ScrollView>

		{/* ── Shopping list ingredient picker modal ── */}
		<Modal
			visible={!!shopPickerRecipe}
			transparent
			animationType="slide"
			onRequestClose={() => !shopPickerLoading && setShopPickerRecipe(null)}>
			<View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}>
				<View style={{ backgroundColor: C.screen, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "85%", paddingBottom: 34 }}>

					{/* Handle + header */}
					<View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
						<View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.borderLight, alignSelf: "center", marginBottom: 16 }} />
						<View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
							<View style={{ flex: 1 }}>
								<Text style={{ fontSize: 18, fontFamily: "NunitoSans_800ExtraBold", color: C.textCharcoal }}>{shopPickerRecipe?.title}</Text>
								<Text style={{ fontSize: 12, color: C.mutedText, marginTop: 2 }}>Choose ingredients to add to your shopping list</Text>
							</View>
							<TouchableOpacity
								onPress={() => { if (!shopPickerLoading) setShopPickerRecipe(null); }}
								style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.bgPurple, alignItems: "center", justifyContent: "center" }}>
								<Icon name="close" size={15} color={C.mutedText} />
							</TouchableOpacity>
						</View>

						{/* Select all / none */}
						<View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
							{[
								{ label: "Select all",  action: () => { const a = {}; (shopPickerRecipe?.ingredients || []).forEach((_, i) => { a[i] = true; }); setShopPickerChecked(a); } },
								{ label: "Clear all",   action: () => setShopPickerChecked({}) },
							].map(({ label, action }) => (
								<TouchableOpacity key={label} onPress={action} activeOpacity={0.75}
									style={{ backgroundColor: C.bgPurple, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}>
									<Text style={{ fontSize: 12, fontFamily: "NunitoSans_700Bold", color: C.primaryPurple }}>{label}</Text>
								</TouchableOpacity>
							))}
						</View>
					</View>

					{/* Ingredient list */}
					<ScrollView style={{ paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
						{(shopPickerRecipe?.ingredients || []).map((ing, i) => (
							<TouchableOpacity
								key={i}
								onPress={() => setShopPickerChecked((p) => ({ ...p, [i]: !p[i] }))}
								activeOpacity={0.8}
								style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.white, borderRadius: 12, marginBottom: 8, paddingHorizontal: 14, paddingVertical: 13, gap: 12 }}>
								<View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: shopPickerChecked[i] ? C.primaryPurple : C.borderLight, backgroundColor: shopPickerChecked[i] ? C.primaryPurple : "transparent", alignItems: "center", justifyContent: "center" }}>
									{shopPickerChecked[i] && <Icon name="check" size={12} color="#fff" />}
								</View>
								<Text style={{ flex: 1, fontSize: 14, color: C.textCharcoal, fontFamily: "NunitoSans_400Regular" }}>{ing}</Text>
							</TouchableOpacity>
						))}
						<View style={{ height: 20 }} />
					</ScrollView>

					{/* Add button */}
					{(() => {
						const selectedCount = Object.values(shopPickerChecked).filter(Boolean).length;
						return (
							<View style={{ paddingHorizontal: 20, paddingTop: 10 }}>
								<TouchableOpacity
									onPress={handleShopPickerAdd}
									disabled={selectedCount === 0 || shopPickerLoading}
									activeOpacity={0.85}
									style={{ backgroundColor: selectedCount === 0 ? C.borderLight : "#1d4ed8", borderRadius: 16, paddingVertical: 15, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}>
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
							</View>
						);
					})()}
				</View>
			</View>
		</Modal>

		{/* ── Regular recipe detail modal ── */}
		<RecipeDetailModal
			recipe={selectedRecipe}
			visible={!!selectedRecipe}
			isSaved={selectedRecipe ? favouriteRecipeIds.includes(selectedRecipe.id) : false}
			isPro={isPro}
			onClose={() => setSelectedRecipe(null)}
			onToggleFav={() => selectedRecipe && onToggleFav(selectedRecipe.id)}
			onLogRecipe={() => { if (selectedRecipe) { onLogRecipe(selectedRecipe); setSelectedRecipe(null); } }}
			onAddToList={onAddToShoppingList && selectedRecipe && !(selectedRecipe.locked && !isPro)
				? () => { openShopPicker(selectedRecipe); setSelectedRecipe(null); }
				: null}
		/>

		{/* ── Smart recipe detail modal ── */}
		<SmartRecipeDetailModal
			recipe={selectedSmartRecipe}
			visible={!!selectedSmartRecipe}
			onClose={() => setSelectedSmartRecipe(null)}
			onRate={(rating) => {
				if (selectedSmartRecipe) {
					onRateSmartRecipe?.(selectedSmartRecipe.id, rating);
					setSelectedSmartRecipe((prev) => prev ? { ...prev, rating } : null);
				}
			}}
			onDelete={() => {
				if (!selectedSmartRecipe) return;
				Alert.alert(
					"Delete recipe?",
					`Remove "${selectedSmartRecipe.title}" from your Smart Recipes?`,
					[
						{ text: "Cancel", style: "cancel" },
						{ text: "Delete", style: "destructive", onPress: () => { onDeleteSmartRecipe?.(selectedSmartRecipe.id); setSelectedSmartRecipe(null); } },
					],
				);
			}}
			onAddToList={onAddToShoppingList && selectedSmartRecipe
				? () => { openShopPicker(selectedSmartRecipe); setSelectedSmartRecipe(null); }
				: null}
			onLogRecipe={onLogRecipe && selectedSmartRecipe
				? () => { onLogRecipe(selectedSmartRecipe); setSelectedSmartRecipe(null); }
				: null}
		/>
		</>
	);
}
