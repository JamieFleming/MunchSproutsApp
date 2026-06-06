import React, { useState, useEffect, useRef, useCallback } from "react";
import {
	View, Text, TextInput, TouchableOpacity, Modal, Alert,
	ScrollView, Platform, ActivityIndicator,
	Keyboard, Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, useStyles } from "../ThemeContext";
import { Icon } from "../components/Icon";
import { parseIngredient } from "../helpers";

// ── Helpers ───────────────────────────────────────────────────────────────────

const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

// ── Firestore helpers (dynamic imports to avoid bundle issues) ─────────────────

async function loadItems(userId, childId) {
	try {
		const { doc, getDoc, setDoc } = await import("firebase/firestore");
		const { db }                  = await import("../../firebase");

		if (childId) {
			// Child-based path — shared between all users with access to this child
			const childSnap = await getDoc(doc(db, "children", childId, "lists", "shopping"));
			const childItems = childSnap.exists() ? (childSnap.data().items || []) : [];
			if (childItems.length > 0) return childItems;

			// First load after migration: try old user path and copy over
			const userSnap  = await getDoc(doc(db, "users", userId, "lists", "shopping"));
			const userItems = userSnap.exists() ? (userSnap.data().items || []) : [];
			if (userItems.length > 0) {
				await setDoc(
					doc(db, "children", childId, "lists", "shopping"),
					{ items: userItems, updatedAt: new Date().toISOString() },
					{ merge: true },
				);
			}
			return userItems;
		}

		const snap = await getDoc(doc(db, "users", userId, "lists", "shopping"));
		return snap.exists() ? (snap.data().items || []) : [];
	} catch { return []; }
}

async function persistItems(userId, childId, items) {
	try {
		const { doc, setDoc } = await import("firebase/firestore");
		const { db }          = await import("../../firebase");
		const ref = childId
			? doc(db, "children", childId, "lists", "shopping")
			: doc(db, "users", userId, "lists", "shopping");
		await setDoc(ref, { items, updatedAt: new Date().toISOString() }, { merge: true });
	} catch { /* silent */ }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EmptyState({ hasChecked }) {
	const { C } = useTheme();
	return (
		<View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, paddingBottom: 80 }}>
			<View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: C.bgPurple, alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
				<Icon name="cart" size={36} color={C.primaryPurple} />
			</View>
			<Text style={{ fontSize: 20, fontWeight: "800", color: C.textCharcoal, textAlign: "center", marginBottom: 8 }}>
				{hasChecked ? "All done!" : "Your list is empty"}
			</Text>
			<Text style={{ fontSize: 14, color: C.mutedText, textAlign: "center", lineHeight: 20 }}>
				{hasChecked
					? "Everything's ticked off. Clear completed items or add more below."
					: "Add items below or tap \"From Recipe\" to import ingredients straight from a recipe."}
			</Text>
		</View>
	);
}

function ItemRow({ item, onToggle, onRemove }) {
	const { C } = useTheme();
	const fadeAnim = useRef(new Animated.Value(1)).current;

	const handleRemove = () => {
		Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => onRemove(item.id));
	};

	return (
		<Animated.View style={{ opacity: fadeAnim, flexDirection: "row", alignItems: "center", backgroundColor: C.white, borderRadius: 14, marginBottom: 8, paddingHorizontal: 14, paddingVertical: 12, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 }}>
			{/* Checkbox */}
			<TouchableOpacity onPress={() => onToggle(item.id)} activeOpacity={0.7}
				style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: item.checked ? C.primaryPurple : C.borderLight, backgroundColor: item.checked ? C.primaryPurple : "transparent", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
				{item.checked && <Icon name="check" size={13} color="#fff" />}
			</TouchableOpacity>

			{/* Name + badges */}
			<View style={{ flex: 1, gap: 3 }}>
				<Text style={{ fontSize: 15, fontWeight: "600", color: item.checked ? C.mutedText : C.textCharcoal, textDecorationLine: item.checked ? "line-through" : "none" }} numberOfLines={2}>
					{item.name}
				</Text>
				<View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
					{!!item.quantity && (
						<View style={{ backgroundColor: "#f0f6fc", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
							<Text style={{ fontSize: 11, color: "#2a5f8f", fontWeight: "600" }}>{item.quantity}</Text>
						</View>
					)}
					{!!item.recipeTitle && (
						<View style={{ backgroundColor: C.bgPurple, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
							<Text style={{ fontSize: 11, color: C.primaryPurple, fontWeight: "600" }}>📖 {item.recipeTitle}</Text>
						</View>
					)}
				</View>
			</View>

			{/* Delete */}
			<TouchableOpacity onPress={handleRemove} activeOpacity={0.7}
				style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "#fde8e8", alignItems: "center", justifyContent: "center", marginLeft: 8 }}>
				<Icon name="trash" size={14} color="#c0392b" />
			</TouchableOpacity>
		</Animated.View>
	);
}

// ── Recipe Picker Modal ───────────────────────────────────────────────────────

function RecipePickerModal({ visible, recipes, onClose, onAddIngredients }) {
	const { C } = useTheme();
	const [step, setStep]                 = useState("recipes"); // "recipes" | "ingredients"
	const [selectedRecipe, setSelectedRecipe] = useState(null);
	const [checked, setChecked]           = useState({});
	const [search, setSearch]             = useState("");

	// Reset when closed
	useEffect(() => {
		if (!visible) { setStep("recipes"); setSelectedRecipe(null); setChecked({}); setSearch(""); }
	}, [visible]);

	const filteredRecipes = recipes.filter((r) =>
		r.title?.toLowerCase().includes(search.toLowerCase()),
	);

	const handlePickRecipe = (recipe) => {
		setSelectedRecipe(recipe);
		// Pre-select all ingredients
		const init = {};
		(recipe.ingredients || []).forEach((ing, i) => { init[i] = true; });
		setChecked(init);
		setStep("ingredients");
	};

	const handleAdd = () => {
		if (!selectedRecipe) return;
		const selected = (selectedRecipe.ingredients || []).filter((_, i) => checked[i]);
		if (selected.length === 0) return;
		onAddIngredients(selectedRecipe.id, selectedRecipe.title, selected);
		onClose();
	};

	const selectedCount = Object.values(checked).filter(Boolean).length;

	return (
		<Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
			<View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}>
				<View style={{ backgroundColor: C.screen, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "90%", paddingBottom: 34 }}>

					{/* Handle + Header */}
					<View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
						<View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.borderLight, alignSelf: "center", marginBottom: 16 }} />
						<View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
							{step === "ingredients" && (
								<TouchableOpacity onPress={() => setStep("recipes")} style={{ marginRight: 10, padding: 4 }}>
									<View style={{ transform: [{ rotate: "180deg" }] }}>
										<Icon name="chevRight" size={20} color={C.mutedText} />
									</View>
								</TouchableOpacity>
							)}
							<View style={{ flex: 1 }}>
								<Text style={{ fontSize: 18, fontWeight: "800", color: C.textCharcoal }}>
									{step === "recipes" ? "Choose a Recipe" : selectedRecipe?.title}
								</Text>
								{step === "ingredients" && (
									<Text style={{ fontSize: 12, color: C.mutedText, marginTop: 1 }}>
										Select ingredients to add to your list
									</Text>
								)}
							</View>
							<TouchableOpacity onPress={onClose}
								style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.bgPurple, alignItems: "center", justifyContent: "center" }}>
								<Icon name="close" size={15} color={C.mutedText} />
							</TouchableOpacity>
						</View>

						{/* Search (recipe step only) */}
						{step === "recipes" && (
							<View style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.bgPurple, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12, gap: 8 }}>
								<Icon name="search" size={16} color={C.mutedText} />
								<TextInput
									value={search}
									onChangeText={setSearch}
									placeholder="Search recipes…"
									placeholderTextColor={C.mutedText}
									style={{ flex: 1, fontSize: 14, color: C.textCharcoal }}
								/>
							</View>
						)}
					</View>

					{/* Recipe list */}
					{step === "recipes" && (
						<ScrollView style={{ paddingHorizontal: 20 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
							{filteredRecipes.length === 0 ? (
								<Text style={{ textAlign: "center", color: C.mutedText, paddingVertical: 24 }}>No recipes found</Text>
							) : filteredRecipes.map((r) => (
								<TouchableOpacity key={r.id} onPress={() => handlePickRecipe(r)} activeOpacity={0.8}
									style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.white, borderRadius: 14, marginBottom: 8, padding: 14, gap: 12, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 }}>
									<View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: C.bgPurple, alignItems: "center", justifyContent: "center" }}>
										<Icon name="chef" size={20} color={C.primaryPurple} />
									</View>
									<View style={{ flex: 1 }}>
										<Text style={{ fontWeight: "700", fontSize: 14, color: C.textCharcoal }} numberOfLines={1}>{r.title}</Text>
										<Text style={{ fontSize: 12, color: C.mutedText, marginTop: 2 }}>
											{(r.ingredients || []).length} ingredient{(r.ingredients || []).length !== 1 ? "s" : ""}
											{r.time ? ` · ${r.time}` : ""}
										</Text>
									</View>
									<Icon name="chevRight" size={16} color={C.mutedText} />
								</TouchableOpacity>
							))}
							<View style={{ height: 20 }} />
						</ScrollView>
					)}

					{/* Ingredient picker */}
					{step === "ingredients" && (
						<>
							<ScrollView style={{ paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
								{(selectedRecipe?.ingredients || []).map((ing, i) => (
									<TouchableOpacity key={i} onPress={() => setChecked((p) => ({ ...p, [i]: !p[i] }))} activeOpacity={0.8}
										style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.white, borderRadius: 12, marginBottom: 8, paddingHorizontal: 14, paddingVertical: 13, gap: 12, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 }}>
										<View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: checked[i] ? C.primaryPurple : C.borderLight, backgroundColor: checked[i] ? C.primaryPurple : "transparent", alignItems: "center", justifyContent: "center" }}>
											{checked[i] && <Icon name="check" size={12} color="#fff" />}
										</View>
										<Text style={{ flex: 1, fontSize: 14, color: C.textCharcoal, fontWeight: "500" }}>{ing}</Text>
									</TouchableOpacity>
								))}
								<View style={{ height: 20 }} />
							</ScrollView>

							{/* Add button */}
							<View style={{ paddingHorizontal: 20, paddingTop: 10 }}>
								<TouchableOpacity onPress={handleAdd} disabled={selectedCount === 0} activeOpacity={0.85}
									style={{ backgroundColor: selectedCount === 0 ? C.borderLight : C.primaryPurple, borderRadius: 16, paddingVertical: 15, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}>
									<Icon name="cart" size={18} color="#fff" />
									<Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>
										Add {selectedCount > 0 ? `${selectedCount} item${selectedCount !== 1 ? "s" : ""}` : "items"} to list
									</Text>
								</TouchableOpacity>
							</View>
						</>
					)}
				</View>
			</View>
		</Modal>
	);
}

// ── Pro Upgrade Gate ──────────────────────────────────────────────────────────

function ProGate({ onUpgradePro }) {
	const { C } = useTheme();
	return (
		<View style={{ flex: 1, backgroundColor: C.screen, padding: 24, justifyContent: "center" }}>
			<View style={{ backgroundColor: "#2d1f5e", borderRadius: 24, padding: 28, alignItems: "center", overflow: "hidden" }}>
				<View style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(155,127,232,0.2)" }} />
				<View style={{ position: "absolute", bottom: -20, left: -20, width: 90, height: 90, borderRadius: 45, backgroundColor: "rgba(61,184,122,0.12)" }} />
				<View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(245,200,66,0.15)", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
					<Icon name="cart" size={34} color="#f5c842" />
				</View>
				<Text style={{ fontSize: 22, fontWeight: "900", color: "#fff", textAlign: "center", marginBottom: 8 }}>Shopping List</Text>
				<Text style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", textAlign: "center", lineHeight: 20, marginBottom: 24 }}>
					Build your shopping list and import ingredients directly from recipes. Upgrade to Pro to unlock this feature.
				</Text>
				{[
					"Add & remove items with one tap",
					"Import ingredients from any recipe",
					"Tick items off as you shop",
					"Synced across all your devices",
				].map((f) => (
					<View key={f} style={{ flexDirection: "row", alignItems: "center", gap: 10, alignSelf: "stretch", marginBottom: 10 }}>
						<Icon name="check" size={13} color="#3db87a" />
						<Text style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", fontWeight: "500" }}>{f}</Text>
					</View>
				))}
				<TouchableOpacity onPress={onUpgradePro} activeOpacity={0.85}
					style={{ backgroundColor: "#f5c842", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, alignItems: "center", flexDirection: "row", gap: 8, marginTop: 10 }}>
					<Icon name="crown" size={15} color="#2d1f5e" />
					<Text style={{ color: "#2d1f5e", fontWeight: "800", fontSize: 15 }}>Upgrade to Pro</Text>
				</TouchableOpacity>
			</View>
		</View>
	);
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export function ShoppingListScreen({ user, isPro, onUpgradePro, recipes = [], visible = true, activeChild = null }) {
	const { C } = useTheme();
	const insets = useSafeAreaInsets();

	const [items,        setItems]        = useState([]);
	const [loading,      setLoading]      = useState(true);
	const [newName,      setNewName]      = useState("");
	const [newQty,       setNewQty]       = useState("");
	const [showRecipes,  setShowRecipes]  = useState(false);
	const [kbPadding,    setKbPadding]    = useState(0);
	const nameRef = useRef(null);

	// ── Keyboard avoidance (iOS) ────────────────────────────────────────────
	// keyboardWillShow gives the exact keyboard height including the suggestion
	// bar. We subtract the tab bar height so only the portion that overlaps the
	// content area is compensated for.
	useEffect(() => {
		if (Platform.OS !== "ios") return;
		const TAB_BAR_HEIGHT = 49 + insets.bottom; // content + safe-area bottom
		const show = Keyboard.addListener("keyboardWillShow", (e) => {
			setKbPadding(Math.max(0, e.endCoordinates.height - TAB_BAR_HEIGHT));
		});
		const hide = Keyboard.addListener("keyboardWillHide", () => setKbPadding(0));
		return () => { show.remove(); hide.remove(); };
	}, [insets.bottom]);

	// ── Load from Firestore ─────────────────────────────────────────────────
	const childId = activeChild?.id || null;

	useEffect(() => {
		if (!user?.uid || !isPro) { setLoading(false); return; }
		loadItems(user.uid, childId).then((saved) => { setItems(saved); setLoading(false); });
	}, [user?.uid, isPro, childId]);

	// Reload whenever the screen becomes visible (e.g. after adding items from RecipesScreen)
	useEffect(() => {
		if (!visible || !user?.uid || !isPro) return;
		loadItems(user.uid, childId).then(setItems);
	}, [visible]);

	// ── Save helper (called after every mutation) ───────────────────────────
	const save = useCallback((newItems) => {
		if (user?.uid) persistItems(user.uid, childId, newItems);
	}, [user?.uid, childId]);

	// ── CRUD ────────────────────────────────────────────────────────────────
	const addItem = () => {
		const name = newName.trim();
		if (!name) { nameRef.current?.focus(); return; }
		const next = [{ id: genId(), name, quantity: newQty.trim(), checked: false }, ...items];
		setItems(next);
		save(next);
		setNewName("");
		setNewQty("");
		nameRef.current?.focus();
	};

	const toggleItem = (id) => {
		const next = items.map((it) => it.id === id ? { ...it, checked: !it.checked } : it);
		setItems(next);
		save(next);
	};

	const removeItem = (id) => {
		const next = items.filter((it) => it.id !== id);
		setItems(next);
		save(next);
	};

	const clearChecked = () => {
		const next = items.filter((it) => !it.checked);
		setItems(next);
		save(next);
	};

	const clearAll = () => {
		Alert.alert(
			"Clear entire list?",
			"This will remove all items, including ones not yet ticked off.",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Clear all",
					style: "destructive",
					onPress: () => { setItems([]); save([]); },
				},
			],
		);
	};

	const addFromRecipe = (recipeId, recipeTitle, ingredients) => {
		const newItems = ingredients.map((ing) => {
			const { name, quantity } = parseIngredient(ing);
			return { id: genId(), name, quantity, checked: false, recipeId, recipeTitle };
		});
		const next = [...newItems, ...items];
		setItems(next);
		save(next);
	};

	// ── Derived lists ───────────────────────────────────────────────────────
	const unchecked = items.filter((it) => !it.checked);
	const checked   = items.filter((it) => it.checked);

	// ── Pro gate ────────────────────────────────────────────────────────────
	if (!isPro) return <ProGate onUpgradePro={onUpgradePro} />;

	if (loading) {
		return (
			<View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
				<ActivityIndicator color={C.primaryPurple} />
			</View>
		);
	}

	// ── Render ──────────────────────────────────────────────────────────────
	//
	// We use keyboard listeners + paddingBottom instead of KeyboardAvoidingView.
	// KAV's keyboardVerticalOffset must equal the exact pixel distance from the
	// physical screen top to the KAV top, which varies by device and is hard to
	// know statically. The listener approach reads the real keyboard height
	// (incl. suggestion bar) and subtracts the tab bar height to get precisely
	// how much of the content area is overlapped — no guesswork needed.
	const isShared = childId && (activeChild?.sharedWith?.length > 0 || activeChild?.userId !== user?.uid);

	return (
		<View style={{ flex: 1, backgroundColor: C.screen, paddingBottom: kbPadding }}>
			{/* Shared indicator */}
			{isShared && (
				<View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#d4eef5", borderRadius: 10, marginHorizontal: 16, marginBottom: 4, paddingHorizontal: 12, paddingVertical: 7 }}>
					<Icon name="users" size={13} color="#2a5f8f" />
					<Text style={{ fontSize: 12, fontWeight: "700", color: "#2a5f8f" }}>
						Shared list — updates visible to all family members
					</Text>
				</View>
			)}
			{/* Action bar */}
			<View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10 }}>
				<TouchableOpacity onPress={() => { Keyboard.dismiss(); setShowRecipes(true); }} activeOpacity={0.85}
					style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.bgPurple, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1.5, borderColor: C.primaryPurple + "30" }}>
					<Icon name="chef" size={15} color={C.primaryPurple} />
					<Text style={{ fontSize: 13, fontWeight: "700", color: C.primaryPurple }}>From Recipe</Text>
				</TouchableOpacity>

				<View style={{ flex: 1 }} />

				{checked.length > 0 && (
					<TouchableOpacity onPress={clearChecked} activeOpacity={0.8}
						style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fde8e8", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 }}>
						<Icon name="trash" size={14} color="#c0392b" />
						<Text style={{ fontSize: 13, fontWeight: "700", color: "#c0392b" }}>Clear done ({checked.length})</Text>
					</TouchableOpacity>
				)}
				{items.length > 0 && (
					<TouchableOpacity onPress={clearAll} activeOpacity={0.8}
						style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fde8e8", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 }}>
						<Icon name="trash" size={14} color="#c0392b" />
						<Text style={{ fontSize: 13, fontWeight: "700", color: "#c0392b" }}>Clear all</Text>
					</TouchableOpacity>
				)}
			</View>

			{/* List — flex:1 so it compresses when keyboard appears */}
			{items.length === 0 ? (
				<EmptyState hasChecked={false} />
			) : (
				<ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
					{unchecked.map((item) => (
						<ItemRow key={item.id} item={item} onToggle={toggleItem} onRemove={removeItem} />
					))}

					{checked.length > 0 && (
						<View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 10 }}>
							<View style={{ flex: 1, height: 1, backgroundColor: C.borderLight }} />
							<View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.bgPurple, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
								<Icon name="cartCheck" size={13} color={C.primaryPurple} />
								<Text style={{ fontSize: 11, fontWeight: "700", color: C.primaryPurple }}>In basket ({checked.length})</Text>
							</View>
							<View style={{ flex: 1, height: 1, backgroundColor: C.borderLight }} />
						</View>
					)}

					{checked.map((item) => (
						<ItemRow key={item.id} item={item} onToggle={toggleItem} onRemove={removeItem} />
					))}
				</ScrollView>
			)}

			{/* Sticky input bar — sits directly inside KAV, always above keyboard */}
			<View style={{ backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.borderLight, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 8 }}>
				<TextInput
					ref={nameRef}
					value={newName}
					onChangeText={setNewName}
					onSubmitEditing={addItem}
					returnKeyType="done"
					placeholder="Add an item…"
					placeholderTextColor={C.mutedText}
					style={{ flex: 1, fontSize: 15, color: C.textCharcoal, backgroundColor: C.bgPurple, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11, fontWeight: "500" }}
				/>
				<TextInput
					value={newQty}
					onChangeText={setNewQty}
					onSubmitEditing={addItem}
					returnKeyType="done"
					placeholder="Qty"
					placeholderTextColor={C.mutedText}
					style={{ width: 68, fontSize: 14, color: C.textCharcoal, backgroundColor: C.bgPurple, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 11, fontWeight: "500", textAlign: "center" }}
				/>
				<TouchableOpacity onPress={addItem} activeOpacity={0.85}
					style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: C.primaryPurple, alignItems: "center", justifyContent: "center" }}>
					<Icon name="plus" size={22} color="#fff" />
				</TouchableOpacity>
			</View>

			{/* Recipe picker modal */}
			<RecipePickerModal
				visible={showRecipes}
				recipes={recipes}
				onClose={() => setShowRecipes(false)}
				onAddIngredients={addFromRecipe}
			/>
		</View>
	);
}
