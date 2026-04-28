import React, { useState } from "react";
import {
	View,
	Text,
	TextInput,
	TouchableOpacity,
	ScrollView,
	Modal,
	KeyboardAvoidingView,
	Platform,
	Alert,
	ActivityIndicator,
} from "react-native";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { useTheme, useStyles } from "../ThemeContext";
import { Icon, CategoryIcon } from "../components/Icon";
import { CATEGORIES } from "../constants";

export function RecipesScreen({
	isPro,
	recipes,
	favouriteRecipeIds,
	onUpgradePro,
	onToggleFav,
	onLogRecipe,
	user,
}) {
	const { C } = useTheme();
	const s = useStyles();
	const [expandedId, setExpandedId] = useState(null);
	const [filterAge, setFilterAge] = useState("all");
	const [upgradeLoading, setUpgradeLoading] = useState(false);
	const [showSuggest, setShowSuggest] = useState(false);
	const [suggestForm, setSuggestForm] = useState({
		title: "", category: "", ageGroup: "", time: "", description: "", ingredients: "", steps: "",
	});
	const [suggestSent, setSuggestSent] = useState(false);
	const [suggestLoading, setSuggestLoading] = useState(false);
	const setSF = (k, v) => setSuggestForm((p) => ({ ...p, [k]: v }));

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
				steps: suggestForm.steps.split("\n").map((s) => s.trim()).filter(Boolean),
				userId: user?.uid || "",
				userEmail: user?.email || "",
				status: "pending",
				createdAt: serverTimestamp(),
			});
			setSuggestSent(true);
		} catch (e) {
			Alert.alert("Error", "Could not submit. Please try again.");
		}
		setSuggestLoading(false);
	};

	const ageGroups = ["all", "4-6m+", "6m+", "7-9m+", "10m+"];
	let filtered =
		filterAge === "all"
			? recipes
			: filterAge === "saved"
				? recipes.filter((r) => favouriteRecipeIds.includes(r.id))
				: recipes.filter((r) => r.ageGroup === filterAge);

	if (!isPro) {
		filtered = [...filtered.filter((r) => !r.locked), ...filtered.filter((r) => r.locked)];
	}

	const toggle = (id, locked) => {
		if (locked && !isPro) return;
		setExpandedId((prev) => (prev === id ? null : id));
	};

	return (
		<ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 24 }}>
			{!isPro && (
				<View style={{ backgroundColor: "#2d1f5e", borderRadius: 20, padding: 22, overflow: "hidden" }}>
					<View style={{ position: "absolute", top: -20, right: -20, width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(155,127,232,0.2)" }} />
					<View style={{ position: "absolute", bottom: -30, left: -10, width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(155,127,232,0.15)" }} />
					<View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
						<View style={{ backgroundColor: C.warningStroke, borderRadius: 12, width: 38, height: 38, alignItems: "center", justifyContent: "center" }}>
							<Icon name="crown" size={20} color={C.white} />
						</View>
						<Text style={{ fontWeight: "800", fontSize: 18, color: C.white }}>Munch Sprouts Pro</Text>
					</View>
					<View style={{ flexDirection: "row", alignItems: "baseline", gap: 4, marginBottom: 14 }}>
						<Text style={{ fontSize: 34, fontWeight: "800", color: C.white }}>£4.99</Text>
						<Text style={{ fontSize: 14, color: "rgba(255,255,255,0.7)" }}>one-off</Text>
					</View>
					{["Access to all BLW recipes", "Recipes for every age group", "Nutritionist-approved meal ideas", "New recipes added regularly", "More premium features coming soon"].map((f, i) => (
						<View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 7 }}>
							<View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: C.primaryGreen, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
								<Icon name="check" size={12} color={C.white} />
							</View>
							<Text style={{ fontSize: 13, color: "rgba(255,255,255,0.9)", flex: 1 }}>{f}</Text>
						</View>
					))}
					<TouchableOpacity
						onPress={() => { setUpgradeLoading(true); onUpgradePro && onUpgradePro().finally(() => setUpgradeLoading(false)); }}
						disabled={upgradeLoading}
						style={{ backgroundColor: C.warningStroke, borderRadius: 14, paddingVertical: 14, alignItems: "center", justifyContent: "center", marginTop: 16, flexDirection: "row", gap: 8, opacity: upgradeLoading ? 0.7 : 1 }}
						activeOpacity={0.85}>
						{upgradeLoading ? <ActivityIndicator color={C.white} /> : (
							<>
								<Icon name="crown" size={16} color={C.white} />
								<Text style={{ color: C.white, fontWeight: "700", fontSize: 15 }}>Upgrade for £4.99</Text>
							</>
						)}
					</TouchableOpacity>
					<Text style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", textAlign: "center", marginTop: 8 }}>
						One-off · No subscription · Billed through {Platform.OS === "ios" ? "Apple" : "Google"} Play
					</Text>
				</View>
			)}

			{isPro && (
				<View style={{ backgroundColor: C.bgGreen, borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
					<Icon name="unlock" size={22} color={C.primaryGreen} />
					<Text style={{ fontWeight: "700", fontSize: 14, color: "#2e7d52" }}>Pro — All recipes unlocked</Text>
				</View>
			)}

			<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}>
				{ageGroups.map((ag) => (
					<TouchableOpacity
						key={ag}
						onPress={() => setFilterAge(ag)}
						style={{ backgroundColor: filterAge === ag ? C.primaryPurple : C.white, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 }}>
						<Text style={{ fontSize: 13, fontWeight: "700", color: filterAge === ag ? C.white : C.mutedText }}>
							{ag === "all" ? "All Ages" : ag}
						</Text>
					</TouchableOpacity>
				))}
				<TouchableOpacity
					onPress={() => setFilterAge("saved")}
					style={{ backgroundColor: filterAge === "saved" ? "#c49a10" : C.white, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 6, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 }}>
					<Icon name="starFill" size={12} color={filterAge === "saved" ? C.white : "#c49a10"} />
					<Text style={{ fontSize: 13, fontWeight: "700", color: filterAge === "saved" ? C.white : "#c49a10" }}>Saved</Text>
				</TouchableOpacity>
			</ScrollView>

			<TouchableOpacity
				onPress={() => { setShowSuggest(true); setSuggestSent(false); setSuggestForm({ title: "", category: "", ageGroup: "", time: "", description: "", ingredients: "", steps: "" }); }}
				style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.bgPurple, borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: C.borderLight }}
				activeOpacity={0.8}>
				<View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: C.primaryPurple + "22", alignItems: "center", justifyContent: "center" }}>
					<Icon name="plus" size={18} color={C.primaryPurple} />
				</View>
				<View style={{ flex: 1 }}>
					<Text style={{ fontWeight: "700", fontSize: 14, color: C.primaryPurple }}>Suggest a Recipe</Text>
					<Text style={{ fontSize: 12, color: C.mutedText, marginTop: 2 }}>Submit your own BLW recipe for review</Text>
				</View>
				<Icon name="chevRight" size={16} color={C.mutedText} />
			</TouchableOpacity>

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
								<Text style={{ fontWeight: "700", fontSize: 18, color: C.primaryPinkDark, marginBottom: 8 }}>Recipe Submitted!</Text>
								<Text style={{ fontSize: 14, color: C.mutedText, textAlign: "center", lineHeight: 22 }}>
									{"Thank you! We'll review your recipe and add it to the app if approved."}
								</Text>
								<TouchableOpacity onPress={() => setShowSuggest(false)} style={[s.btnPrimary, { marginTop: 24 }]}>
									<Text style={s.btnPrimaryText}>Done</Text>
								</TouchableOpacity>
							</View>
						) : (
							<ScrollView showsVerticalScrollIndicator={false}>
								<View style={{ gap: 14, paddingBottom: 20 }}>
									{[
										{ key: "title", label: "Recipe Name *", placeholder: "e.g. Sweet Potato Fritters" },
										{ key: "category", label: "Category", placeholder: "e.g. Mains" },
										{ key: "ageGroup", label: "Age Group", placeholder: "e.g. 6m+" },
										{ key: "time", label: "Prep Time", placeholder: "e.g. 20 min" },
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
										<Text style={{ fontSize: 12, color: C.mutedText, lineHeight: 18 }}>
											Your recipe will be reviewed by the Munch Sprouts team before being added to the app.
										</Text>
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

			{filtered.map((r) => {
				const effectiveLocked = r.locked && !isPro;
				const isOpen = expandedId === r.id && !effectiveLocked;
				return (
					<View
						key={r.id}
						style={[s.card, { padding: 0, overflow: "hidden", borderWidth: isOpen ? 2 : 0, borderColor: C.primaryPurple, opacity: effectiveLocked ? 0.75 : 1, backgroundColor: C.white }]}>
						<TouchableOpacity onPress={() => toggle(r.id, r.locked)} style={{ flexDirection: "row", gap: 16, alignItems: "center", padding: 18 }} activeOpacity={effectiveLocked ? 1 : 0.8}>
							<CategoryIcon category={r.category} size={52} />
							<View style={{ flex: 1 }}>
								<View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
									<Text style={{ fontWeight: "700", fontSize: 14, color: C.primaryPinkDark, flex: 1 }}>{r.title}</Text>
									{effectiveLocked ? (
										<View style={{ backgroundColor: C.warningStroke, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
											<Text style={{ fontSize: 10, fontWeight: "700", color: C.white }}>PRO</Text>
										</View>
									) : (
										<Icon name={isOpen ? "chevUp" : "chevDown"} size={16} color={C.mutedText} />
									)}
								</View>
								<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
									<View style={s.tagPurple}><Text style={s.tagPurpleText}>{r.category}</Text></View>
									<View style={s.tagGreen}><Text style={s.tagGreenText}>{r.ageGroup}</Text></View>
									<View style={s.tagPurple}><Text style={s.tagPurpleText}>{r.time}</Text></View>
									{r.tags.map((t) => (
										<View key={t} style={s.tagWarning}><Text style={s.tagWarningText}>{t}</Text></View>
									))}
								</View>
							</View>
						</TouchableOpacity>

						{isOpen && (
							<View style={{ borderTopWidth: 1, borderTopColor: C.borderLight, padding: 18 }}>
								{r.description ? (
									<Text style={{ fontSize: 13, color: C.textCharcoal, marginBottom: 18, lineHeight: 20, fontStyle: "italic" }}>{r.description}</Text>
								) : null}
								<Text style={[s.sectionTitle, { marginBottom: 12 }]}>Ingredients</Text>
								{r.ingredients.map((ing, i) => (
									<View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: C.bgPurple, borderRadius: 12, padding: 12, marginBottom: 8 }}>
										<View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.primaryPurple, marginTop: 5, flexShrink: 0 }} />
										<Text style={{ fontSize: 14, color: C.textCharcoal, fontWeight: "600", flex: 1 }}>{ing}</Text>
									</View>
								))}
								<Text style={[s.sectionTitle, { marginTop: 18, marginBottom: 12 }]}>Method</Text>
								{r.steps.map((step, i) => (
									<View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 14, backgroundColor: i % 2 === 0 ? C.white : C.bgPurple, borderRadius: 12, padding: 12, marginBottom: 8 }}>
										<View style={{ backgroundColor: C.primaryPurple, borderRadius: 12, width: 26, height: 26, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
											<Text style={{ fontSize: 12, fontWeight: "700", color: C.white }}>{i + 1}</Text>
										</View>
										<Text style={{ fontSize: 13, color: C.textCharcoal, lineHeight: 20, flex: 1, paddingTop: 3 }}>{step}</Text>
									</View>
								))}
								<View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
									<TouchableOpacity
										onPress={() => onToggleFav(r.id)}
										style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: favouriteRecipeIds.includes(r.id) ? "#fef6d4" : C.bgPurple, borderRadius: 12, paddingVertical: 12 }}
										activeOpacity={0.8}>
										<Icon name={favouriteRecipeIds.includes(r.id) ? "starFill" : "star"} size={16} color={favouriteRecipeIds.includes(r.id) ? "#c49a10" : C.mutedText} />
										<Text style={{ fontWeight: "700", fontSize: 13, color: favouriteRecipeIds.includes(r.id) ? "#c49a10" : C.mutedText }}>
											{favouriteRecipeIds.includes(r.id) ? "Saved" : "Save"}
										</Text>
									</TouchableOpacity>
									<TouchableOpacity
										onPress={() => onLogRecipe(r)}
										style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.primaryPurple, borderRadius: 12, paddingVertical: 12, shadowColor: C.primaryPurple, shadowOpacity: 0.3, shadowRadius: 6, elevation: 3 }}
										activeOpacity={0.8}>
										<Icon name="plus" size={16} color={C.white} />
										<Text style={{ fontWeight: "700", fontSize: 13, color: C.white }}>Log This</Text>
									</TouchableOpacity>
								</View>
							</View>
						)}

						{effectiveLocked && (
							<View style={{ borderTopWidth: 1, borderTopColor: C.borderLight, padding: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
								<Icon name="lock" size={13} color={C.mutedText} />
								<Text style={{ fontSize: 11, fontWeight: "700", color: C.mutedText, textTransform: "uppercase" }}>Upgrade to Pro to view this recipe</Text>
							</View>
						)}
					</View>
				);
			})}
		</ScrollView>
	);
}
