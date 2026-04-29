import React, { useState, useRef } from "react";
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
	Image,
} from "react-native";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { useTheme, useStyles } from "../ThemeContext";
import { Icon, CategoryIcon } from "../components/Icon";

// ── Freezable badge ─────────────────────────────────────────────────────────
function FreezableBadge({ style }) {
	return (
		<View
			style={[
				{
					backgroundColor: "#d4eef5",
					borderRadius: 999,
					paddingHorizontal: 8,
					paddingVertical: 3,
					flexDirection: "row",
					alignItems: "center",
					gap: 4,
				},
				style,
			]}>
			<Text style={{ fontSize: 12 }}>❄️</Text>
			<Text style={{ fontSize: 10, fontWeight: "700", color: "#2a5f8f" }}>
				Freezable
			</Text>
		</View>
	);
}

// ── Nutrition pill ───────────────────────────────────────────────────────────
function NutritionBar({ nutrition }) {
	const { C } = useTheme();
	if (!nutrition) return null;
	const items = [
		{
			label: "Calories",
			value: nutrition.calories,
			unit: "kcal",
			bg: "#fde8cc",
			color: "#a85a1a",
		},
		{
			label: "Protein",
			value: nutrition.protein,
			unit: "g",
			bg: "#d4f0e0",
			color: "#2d7a55",
		},
		{
			label: "Carbs",
			value: nutrition.carbs,
			unit: "g",
			bg: "#d4e8f5",
			color: "#2a5f8f",
		},
	];
	return (
		<View style={{ flexDirection: "row", gap: 8, marginBottom: 18 }}>
			{items.map((item) => (
				<View
					key={item.label}
					style={{
						flex: 1,
						backgroundColor: item.bg,
						borderRadius: 12,
						padding: 10,
						alignItems: "center",
					}}>
					<Text style={{ fontSize: 18, fontWeight: "800", color: item.color }}>
						{item.value}
					</Text>
					<Text
						style={{
							fontSize: 9,
							fontWeight: "700",
							color: item.color,
							textTransform: "uppercase",
							marginTop: 1,
						}}>
						{item.unit}
					</Text>
					<Text
						style={{
							fontSize: 10,
							color: item.color,
							opacity: 0.7,
							marginTop: 2,
						}}>
						{item.label}
					</Text>
				</View>
			))}
		</View>
	);
}

// ── Featured card (horizontal scroll) ───────────────────────────────────────
function FeaturedCard({ recipe, isPro, onPress }) {
	const { C } = useTheme();
	const effectiveLocked = recipe.locked && !isPro;
	return (
		<TouchableOpacity
			onPress={onPress}
			activeOpacity={0.88}
			style={{
				width: 200,
				borderRadius: 18,
				overflow: "hidden",
				backgroundColor: C.white,
				shadowColor: "#000",
				shadowOpacity: 0.1,
				shadowRadius: 8,
				elevation: 3,
			}}>
			{recipe.imageUrl ? (
				<Image
					source={{ uri: recipe.imageUrl }}
					style={{ width: "100%", height: 120 }}
					resizeMode="cover"
				/>
			) : (
				<View
					style={{
						width: "100%",
						height: 120,
						backgroundColor: C.bgPurple,
						alignItems: "center",
						justifyContent: "center",
					}}>
					<CategoryIcon category={recipe.category} size={56} />
				</View>
			)}
			{/* Badges overlay */}
			<View
				style={{
					position: "absolute",
					top: 8,
					left: 8,
					flexDirection: "row",
					gap: 5,
				}}>
				<View
					style={{
						backgroundColor: "rgba(212,160,23,0.92)",
						borderRadius: 999,
						paddingHorizontal: 7,
						paddingVertical: 3,
					}}>
					<Text style={{ fontSize: 10, fontWeight: "700", color: "#fff" }}>
						★ Featured
					</Text>
				</View>
				{effectiveLocked && (
					<View
						style={{
							backgroundColor: "rgba(224,123,57,0.92)",
							borderRadius: 999,
							paddingHorizontal: 7,
							paddingVertical: 3,
						}}>
						<Text style={{ fontSize: 10, fontWeight: "700", color: "#fff" }}>
							PRO
						</Text>
					</View>
				)}
			</View>
			<View style={{ padding: 12 }}>
				<Text
					style={{
						fontWeight: "700",
						fontSize: 13,
						color: C.primaryPinkDark,
						marginBottom: 6,
					}}
					numberOfLines={2}>
					{recipe.title}
				</Text>
				<View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
					<View
						style={{
							backgroundColor: C.bgGreen,
							borderRadius: 999,
							paddingHorizontal: 7,
							paddingVertical: 2,
						}}>
						<Text style={{ fontSize: 10, fontWeight: "700", color: "#2e7d52" }}>
							{recipe.ageGroup}
						</Text>
					</View>
					<View
						style={{
							backgroundColor: C.bgPurple,
							borderRadius: 999,
							paddingHorizontal: 7,
							paddingVertical: 2,
						}}>
						<Text
							style={{
								fontSize: 10,
								fontWeight: "700",
								color: C.primaryPurple,
							}}>
							{recipe.time}
						</Text>
					</View>
					{recipe.freezable && <FreezableBadge />}
				</View>
			</View>
		</TouchableOpacity>
	);
}

// ── Main ─────────────────────────────────────────────────────────────────────
export function RecipesScreen({
	isPro,
	recipes,
	favouriteRecipeIds,
	onUpgradePro,
	onToggleFav,
	onLogRecipe,
	user,
	jumpToRecipeId = null,
	onJumpHandled,
}) {
	const { C } = useTheme();
	const s = useStyles();
	const [expandedId, setExpandedId] = useState(null);
	const [filterAge, setFilterAge] = useState("all");
	const [searchQuery, setSearchQuery] = useState("");
	const [upgradeLoading, setUpgradeLoading] = useState(false);

	// Refs for scroll-to-recipe
	const scrollViewRef = useRef(null);
	const cardPositions = useRef({});
	const [showSuggest, setShowSuggest] = useState(false);
	const [suggestForm, setSuggestForm] = useState({
		title: "",
		category: "",
		ageGroup: "",
		time: "",
		description: "",
		ingredients: "",
		steps: "",
	});
	const [suggestSent, setSuggestSent] = useState(false);
	const [suggestLoading, setSuggestLoading] = useState(false);
	const setSF = (k, v) => setSuggestForm((p) => ({ ...p, [k]: v }));

	const handleSuggestSubmit = async () => {
		if (
			!suggestForm.title ||
			!suggestForm.description ||
			!suggestForm.ingredients ||
			!suggestForm.steps
		) {
			Alert.alert(
				"Missing info",
				"Please fill in title, description, ingredients and steps.",
			);
			return;
		}
		setSuggestLoading(true);
		try {
			await addDoc(collection(db, "recipeSuggestions"), {
				...suggestForm,
				ingredients: suggestForm.ingredients
					.split("\n")
					.map((s) => s.trim())
					.filter(Boolean),
				steps: suggestForm.steps
					.split("\n")
					.map((s) => s.trim())
					.filter(Boolean),
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
	const q = searchQuery.trim().toLowerCase();

	let filtered =
		filterAge === "all"
			? recipes
			: filterAge === "saved"
				? recipes.filter((r) => favouriteRecipeIds.includes(r.id))
				: recipes.filter((r) => r.ageGroup === filterAge);

	// Search by ingredient, title or description
	if (q) {
		filtered = filtered.filter(
			(r) =>
				r.title?.toLowerCase().includes(q) ||
				r.description?.toLowerCase().includes(q) ||
				(r.ingredients || []).some((ing) => ing.toLowerCase().includes(q)),
		);
	}

	if (!isPro) {
		filtered = [
			...filtered.filter((r) => !r.locked),
			...filtered.filter((r) => r.locked),
		];
	}

	const featuredRecipes = recipes.filter((r) => r.featured);

	const toggle = (id, locked) => {
		if (locked && !isPro) return;
		setExpandedId((prev) => (prev === id ? null : id));
	};

	// Scroll the main ScrollView to a recipe card and expand it
	const jumpToRecipe = (id, locked) => {
		if (locked && !isPro) return;
		setExpandedId(id);
		// Small delay so expand animation doesn't interfere with scroll
		setTimeout(() => {
			const y = cardPositions.current[id];
			if (y != null) {
				scrollViewRef.current?.scrollTo({ y: y - 16, animated: true });
			}
		}, 80);
	};

	// Jump to recipe when navigated from dashboard
	React.useEffect(() => {
		if (!jumpToRecipeId) return;
		const recipe = recipes.find((r) => r.id === jumpToRecipeId);
		if (!recipe) return;
		// Longer delay on first mount to let layout settle
		const timer = setTimeout(() => {
			jumpToRecipe(jumpToRecipeId, recipe.locked);
			onJumpHandled?.();
		}, 450);
		return () => clearTimeout(timer);
	}, [jumpToRecipeId]);

	return (
		<ScrollView
			ref={scrollViewRef}
			showsVerticalScrollIndicator={false}
			contentContainerStyle={{ gap: 16, paddingBottom: 24 }}>
			{/* ── Pro upgrade banner ── */}
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

			{/* ── Featured section ── */}
			{featuredRecipes.length > 0 && (
				<View>
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: 8,
							marginBottom: 12,
						}}>
						<Text style={{ fontSize: 12 }}>★</Text>
						<Text style={[s.sectionTitle, { color: "#c49a10" }]}>
							Featured Recipes
						</Text>
					</View>
					<ScrollView
						horizontal
						showsHorizontalScrollIndicator={false}
						contentContainerStyle={{
							gap: 12,
							paddingHorizontal: 2,
							paddingBottom: 4,
						}}>
						{featuredRecipes.map((r) => (
							<FeaturedCard
								key={r.id}
								recipe={r}
								isPro={isPro}
								onPress={() => jumpToRecipe(r.id, r.locked)}
							/>
						))}
					</ScrollView>
				</View>
			)}

			{/* ── Ingredient search ── */}
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					backgroundColor: C.white,
					borderRadius: 14,
					borderWidth: 1.5,
					borderColor: searchQuery ? C.primaryPurple : C.borderLight,
					paddingHorizontal: 14,
					paddingVertical: 10,
					gap: 10,
					shadowColor: "#000",
					shadowOpacity: 0.04,
					shadowRadius: 4,
					elevation: 1,
				}}>
				<Icon name="search" size={16} color={searchQuery ? C.primaryPurple : C.mutedText} />
				<TextInput
					value={searchQuery}
					onChangeText={setSearchQuery}
					placeholder="Search by ingredient or recipe name…"
					placeholderTextColor={C.mutedText}
					style={{
						flex: 1,
						fontSize: 14,
						color: C.textCharcoal,
						fontWeight: "500",
						paddingVertical: 0,
					}}
					autoCorrect={false}
					autoCapitalize="none"
					returnKeyType="search"
				/>
				{searchQuery.length > 0 && (
					<TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={8}>
						<Icon name="close" size={14} color={C.mutedText} />
					</TouchableOpacity>
				)}
			</View>

			{/* ── Age filter chips ── */}
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

			{/* ── Suggest a recipe ── */}
			<TouchableOpacity
				onPress={() => {
					setShowSuggest(true);
					setSuggestSent(false);
					setSuggestForm({
						title: "",
						category: "",
						ageGroup: "",
						time: "",
						description: "",
						ingredients: "",
						steps: "",
					});
				}}
				style={{
					flexDirection: "row",
					alignItems: "center",
					gap: 12,
					backgroundColor: C.bgPurple,
					borderRadius: 16,
					padding: 16,
					borderWidth: 1.5,
					borderColor: C.borderLight,
				}}
				activeOpacity={0.8}>
				<View
					style={{
						width: 42,
						height: 42,
						borderRadius: 13,
						backgroundColor: C.primaryPurple + "22",
						alignItems: "center",
						justifyContent: "center",
					}}>
					<Icon name="plus" size={18} color={C.primaryPurple} />
				</View>
				<View style={{ flex: 1 }}>
					<Text
						style={{ fontWeight: "700", fontSize: 14, color: C.primaryPurple }}>
						Suggest a Recipe
					</Text>
					<Text style={{ fontSize: 12, color: C.mutedText, marginTop: 2 }}>
						Submit your own BLW recipe for review
					</Text>
				</View>
				<Icon name="chevRight" size={16} color={C.mutedText} />
			</TouchableOpacity>

			{/* ── Suggest modal ── */}
			<Modal
				visible={showSuggest}
				transparent
				animationType="slide"
				onRequestClose={() => setShowSuggest(false)}>
				<KeyboardAvoidingView
					behavior={Platform.OS === "ios" ? "padding" : "height"}
					style={s.modalOverlay}>
					<View style={[s.modalSheet, { maxHeight: "92%" }]}>
						<View
							style={{
								flexDirection: "row",
								justifyContent: "space-between",
								alignItems: "center",
								marginBottom: 20,
							}}>
							<Text style={s.modalTitle}>Suggest a Recipe</Text>
							<TouchableOpacity
								onPress={() => setShowSuggest(false)}
								style={{
									backgroundColor: C.bgPurple,
									borderRadius: 10,
									padding: 8,
								}}>
								<Icon name="close" size={16} color={C.mutedText} />
							</TouchableOpacity>
						</View>
						{suggestSent ? (
							<View style={{ alignItems: "center", paddingVertical: 30 }}>
								<View
									style={{
										width: 64,
										height: 64,
										borderRadius: 32,
										backgroundColor: C.statGreenBg,
										alignItems: "center",
										justifyContent: "center",
										marginBottom: 16,
									}}>
									<Icon name="check" size={28} color={C.statGreenText} />
								</View>
								<Text
									style={{
										fontWeight: "700",
										fontSize: 18,
										color: C.primaryPinkDark,
										marginBottom: 8,
									}}>
									Recipe Submitted!
								</Text>
								<Text
									style={{
										fontSize: 14,
										color: C.mutedText,
										textAlign: "center",
										lineHeight: 22,
									}}>
									{
										"Thank you! We'll review your recipe and add it to the app if approved."
									}
								</Text>
								<TouchableOpacity
									onPress={() => setShowSuggest(false)}
									style={[s.btnPrimary, { marginTop: 24 }]}>
									<Text style={s.btnPrimaryText}>Done</Text>
								</TouchableOpacity>
							</View>
						) : (
							<ScrollView showsVerticalScrollIndicator={false}>
								<View style={{ gap: 14, paddingBottom: 20 }}>
									{[
										{
											key: "title",
											label: "Recipe Name *",
											placeholder: "e.g. Sweet Potato Fritters",
										},
										{
											key: "category",
											label: "Category",
											placeholder: "e.g. Mains",
										},
										{
											key: "ageGroup",
											label: "Age Group",
											placeholder: "e.g. 6m+",
										},
										{
											key: "time",
											label: "Prep Time",
											placeholder: "e.g. 20 min",
										},
									].map(({ key, label, placeholder }) => (
										<View key={key}>
											<Text style={s.label}>{label}</Text>
											<TextInput
												value={suggestForm[key]}
												onChangeText={(v) => setSF(key, v)}
												placeholder={placeholder}
												style={[s.input, { backgroundColor: C.white }]}
												placeholderTextColor={C.mutedText}
												autoComplete="off"
												autoCorrect={false}
											/>
										</View>
									))}
									<View>
										<Text style={s.label}>Description *</Text>
										<TextInput
											value={suggestForm.description}
											onChangeText={(v) => setSF("description", v)}
											placeholder="Brief description of the recipe"
											multiline
											numberOfLines={3}
											style={[
												s.input,
												{
													height: 80,
													textAlignVertical: "top",
													backgroundColor: C.white,
												},
											]}
											placeholderTextColor={C.mutedText}
											autoComplete="off"
										/>
									</View>
									<View>
										<Text style={s.label}>Ingredients * (one per line)</Text>
										<TextInput
											value={suggestForm.ingredients}
											onChangeText={(v) => setSF("ingredients", v)}
											placeholder={"1 sweet potato\n2 tbsp flour\n1 egg"}
											multiline
											numberOfLines={5}
											style={[
												s.input,
												{
													height: 120,
													textAlignVertical: "top",
													backgroundColor: C.white,
												},
											]}
											placeholderTextColor={C.mutedText}
											autoComplete="off"
										/>
									</View>
									<View>
										<Text style={s.label}>Method / Steps * (one per line)</Text>
										<TextInput
											value={suggestForm.steps}
											onChangeText={(v) => setSF("steps", v)}
											placeholder={
												"Peel and grate the sweet potato\nMix with flour and egg\nFry until golden"
											}
											multiline
											numberOfLines={6}
											style={[
												s.input,
												{
													height: 140,
													textAlignVertical: "top",
													backgroundColor: C.white,
												},
											]}
											placeholderTextColor={C.mutedText}
											autoComplete="off"
										/>
									</View>
									<View
										style={{
											backgroundColor: C.bgPurple,
											borderRadius: 12,
											padding: 14,
										}}>
										<Text
											style={{
												fontSize: 12,
												color: C.mutedText,
												lineHeight: 18,
											}}>
											Your recipe will be reviewed by the Munch Sprouts team
											before being added to the app.
										</Text>
									</View>
									<TouchableOpacity
										onPress={handleSuggestSubmit}
										disabled={suggestLoading}
										style={[s.btnPrimary, suggestLoading && { opacity: 0.6 }]}
										activeOpacity={0.8}>
										{suggestLoading ? (
											<ActivityIndicator color="#ffffff" />
										) : (
											<Text style={s.btnPrimaryText}>Submit Recipe</Text>
										)}
									</TouchableOpacity>
								</View>
							</ScrollView>
						)}
					</View>
				</KeyboardAvoidingView>
			</Modal>

			{/* ── Recipe list ── */}
			{filtered.map((r) => {
				const effectiveLocked = r.locked && !isPro;
				const isOpen = expandedId === r.id && !effectiveLocked;
				const isSaved = favouriteRecipeIds.includes(r.id);

				return (
					<View
						key={r.id}
						onLayout={(e) => {
							cardPositions.current[r.id] = e.nativeEvent.layout.y;
						}}
						style={[
							s.card,
							{
								padding: 0,
								overflow: "hidden",
								borderWidth: isOpen ? 2 : 0,
								borderColor: C.primaryPurple,
								opacity: effectiveLocked ? 0.8 : 1,
								backgroundColor: C.white,
							},
						]}>
						{/* ── Card image ── */}
						<TouchableOpacity
							onPress={() => toggle(r.id, r.locked)}
							activeOpacity={effectiveLocked ? 1 : 0.85}>
							{r.imageUrl ? (
								<View style={{ position: "relative" }}>
									<Image
										source={{ uri: r.imageUrl }}
										style={{ width: "100%", height: 170 }}
										resizeMode="cover"
									/>
									{/* Dark gradient hint */}
									<View
										style={{
											position: "absolute",
											bottom: 0,
											left: 0,
											right: 0,
											height: 60,
											backgroundColor: "transparent",
											background:
												"linear-gradient(transparent, rgba(0,0,0,0.3))",
										}}
									/>
									{/* Top-left badges */}
									<View
										style={{
											position: "absolute",
											top: 10,
											left: 10,
											flexDirection: "row",
											gap: 6,
										}}>
										{r.featured && (
											<View
												style={{
													backgroundColor: "rgba(196,154,16,0.92)",
													borderRadius: 999,
													paddingHorizontal: 8,
													paddingVertical: 3,
												}}>
												<Text
													style={{
														fontSize: 10,
														fontWeight: "700",
														color: "#fff",
													}}>
													★ Featured
												</Text>
											</View>
										)}
										{r.freezable && (
											<View
												style={{
													backgroundColor: "rgba(42,95,143,0.92)",
													borderRadius: 999,
													paddingHorizontal: 8,
													paddingVertical: 3,
													flexDirection: "row",
													alignItems: "center",
													gap: 3,
												}}>
												<Text style={{ fontSize: 11 }}>❄️</Text>
												<Text
													style={{
														fontSize: 10,
														fontWeight: "700",
														color: "#fff",
													}}>
													Freezable
												</Text>
											</View>
										)}
									</View>
									{/* Top-right badges */}
									<View
										style={{
											position: "absolute",
											top: 10,
											right: 10,
											flexDirection: "row",
											gap: 6,
										}}>
										{effectiveLocked && (
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
														color: "#fff",
													}}>
													PRO
												</Text>
											</View>
										)}
										{isSaved && (
											<View
												style={{
													backgroundColor: "rgba(196,154,16,0.92)",
													borderRadius: 999,
													paddingHorizontal: 7,
													paddingVertical: 3,
												}}>
												<Text style={{ fontSize: 11, color: "#fff" }}>★</Text>
											</View>
										)}
									</View>
								</View>
							) : (
								<View
									style={{
										padding: 18,
										paddingBottom: 0,
										flexDirection: "row",
										alignItems: "center",
										gap: 14,
									}}>
									<CategoryIcon category={r.category} size={52} />
									<View
										style={{
											flex: 1,
											flexDirection: "row",
											flexWrap: "wrap",
											gap: 6,
										}}>
										{r.featured && (
											<View
												style={{
													backgroundColor: "#fef6d4",
													borderRadius: 999,
													paddingHorizontal: 8,
													paddingVertical: 3,
												}}>
												<Text
													style={{
														fontSize: 10,
														fontWeight: "700",
														color: "#c49a10",
													}}>
													★ Featured
												</Text>
											</View>
										)}
										{r.freezable && <FreezableBadge />}
										{effectiveLocked && (
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
														color: "#fff",
													}}>
													PRO
												</Text>
											</View>
										)}
									</View>
								</View>
							)}

							{/* ── Card body ── */}
							<View style={{ padding: 16 }}>
								<View
									style={{
										flexDirection: "row",
										justifyContent: "space-between",
										alignItems: "flex-start",
										marginBottom: 10,
									}}>
									<Text
										style={{
											fontWeight: "700",
											fontSize: 15,
											color: C.primaryPinkDark,
											flex: 1,
											marginRight: 8,
										}}>
										{r.title}
									</Text>
									{effectiveLocked ? (
										<Icon name="lock" size={16} color={C.mutedText} />
									) : (
										<Icon
											name={isOpen ? "chevUp" : "chevDown"}
											size={16}
											color={C.mutedText}
										/>
									)}
								</View>

								{/* Meta row */}
								<View
									style={{
										flexDirection: "row",
										flexWrap: "wrap",
										gap: 6,
										marginBottom: 6,
									}}>
									{r.category && (
										<View style={s.tagPurple}>
											<Text style={s.tagPurpleText}>{r.category}</Text>
										</View>
									)}
									{r.ageGroup && (
										<View style={s.tagGreen}>
											<Text style={s.tagGreenText}>{r.ageGroup}</Text>
										</View>
									)}
									{r.time && (
										<View style={s.tagPurple}>
											<Text style={s.tagPurpleText}>⏱ {r.time}</Text>
										</View>
									)}
									{r.servings && (
										<View style={s.tagPurple}>
											<Text style={s.tagPurpleText}>
												🍽 {r.servings} servings
											</Text>
										</View>
									)}
									{(r.tags || []).map((t) => (
										<View key={t} style={s.tagWarning}>
											<Text style={s.tagWarningText}>{t}</Text>
										</View>
									))}
								</View>
							</View>
						</TouchableOpacity>

						{/* ── Expanded content ── */}
						{isOpen && (
							<View
								style={{
									borderTopWidth: 1,
									borderTopColor: C.borderLight,
									padding: 18,
								}}>
								{/* Description */}
								{r.description ? (
									<Text
										style={{
											fontSize: 13,
											color: C.textCharcoal,
											marginBottom: 18,
											lineHeight: 21,
											fontStyle: "italic",
										}}>
										{r.description}
									</Text>
								) : null}

								{/* Nutrition */}
								{r.nutrition && <NutritionBar nutrition={r.nutrition} />}

								{/* Allergens */}
								{r.allergens && r.allergens.length > 0 && (
									<View
										style={{
											backgroundColor: "#fde8e8",
											borderRadius: 12,
											padding: 12,
											marginBottom: 18,
											flexDirection: "row",
											alignItems: "flex-start",
											gap: 10,
										}}>
										<Icon name="alert" size={16} color="#c0392b" />
										<View style={{ flex: 1 }}>
											<Text
												style={{
													fontWeight: "700",
													fontSize: 12,
													color: "#c0392b",
													marginBottom: 4,
												}}>
												Allergens
											</Text>
											<Text
												style={{
													fontSize: 12,
													color: "#c0392b",
													lineHeight: 18,
												}}>
												{r.allergens.join(", ")}
											</Text>
										</View>
									</View>
								)}

								{/* Ingredients */}
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

								{/* Steps */}
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

								{/* Notes */}
								{r.notes ? (
									<View
										style={{
											backgroundColor: "#fff8e1",
											borderRadius: 12,
											padding: 14,
											marginTop: 14,
											flexDirection: "row",
											gap: 10,
											alignItems: "flex-start",
										}}>
										<Text style={{ fontSize: 16 }}>💡</Text>
										<View style={{ flex: 1 }}>
											<Text
												style={{
													fontWeight: "700",
													fontSize: 12,
													color: "#a85a1a",
													marginBottom: 4,
												}}>
												Tip
											</Text>
											<Text
												style={{
													fontSize: 12,
													color: "#7a4a10",
													lineHeight: 18,
												}}>
												{r.notes}
											</Text>
										</View>
									</View>
								) : null}

								{/* Freezable note */}
								{r.freezable && (
									<View
										style={{
											backgroundColor: "#d4eef5",
											borderRadius: 12,
											padding: 12,
											marginTop: 12,
											flexDirection: "row",
											alignItems: "center",
											gap: 8,
										}}>
										<Text style={{ fontSize: 16 }}>❄️</Text>
										<Text
											style={{
												fontSize: 12,
												fontWeight: "700",
												color: "#2a5f8f",
											}}>
											This recipe can be frozen for later use
										</Text>
									</View>
								)}

								{/* Action buttons */}
								<View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
									<TouchableOpacity
										onPress={() => onToggleFav(r.id)}
										style={{
											flex: 1,
											flexDirection: "row",
											alignItems: "center",
											justifyContent: "center",
											gap: 8,
											backgroundColor: isSaved ? "#fef6d4" : C.bgPurple,
											borderRadius: 12,
											paddingVertical: 12,
										}}
										activeOpacity={0.8}>
										<Icon
											name={isSaved ? "starFill" : "star"}
											size={16}
											color={isSaved ? "#c49a10" : C.mutedText}
										/>
										<Text
											style={{
												fontWeight: "700",
												fontSize: 13,
												color: isSaved ? "#c49a10" : C.mutedText,
											}}>
											{isSaved ? "Saved" : "Save"}
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

						{/* ── Locked footer ── */}
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
