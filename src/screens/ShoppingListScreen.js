import React, { useState, useEffect, useRef, useCallback } from "react";
import {
	View, Text, TextInput, TouchableOpacity, Modal, Alert,
	ScrollView, Platform, ActivityIndicator, KeyboardAvoidingView,
	Keyboard, Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, useStyles } from "../ThemeContext";
import { Icon } from "../components/Icon";
import { parseIngredient } from "../helpers";

// ── Helpers ───────────────────────────────────────────────────────────────────

const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const DEFAULT_LIST_ID = "shopping";
// Composite key so personal "shopping" and shared "shopping" never collide in the tab bar
const tabKey = (l) => (l?.isShared ? "s:" : "p:") + (l?.id || "");

// ── Firestore helpers ─────────────────────────────────────────────────────────

function listDocSegments(userId, list) {
	if (list.isShared && list.childId) {
		return ["children", list.childId, "lists", list.id];
	}
	return ["users", userId, "lists", list.id];
}

export async function loadAllLists(userId, childId) {
	try {
		const { collection, getDocs, doc, getDoc } = await import("firebase/firestore");
		const { db } = await import("../../firebase");

		// Always include the default family shared list when a child is active.
		// It lives at children/{childId}/lists/shopping and is always present.
		let familyList = null;
		if (childId) {
			const snap = await getDoc(doc(db, "children", childId, "lists", DEFAULT_LIST_ID));
			familyList = {
				id: DEFAULT_LIST_ID,
				name: snap.exists() ? (snap.data().name || "Family List") : "Family List",
				isShared: true,
				childId,
				isDefault: true,
			};
		}

		// Personal lists
		const personalSnap = await getDocs(collection(db, "users", userId, "lists"));
		const personal = personalSnap.docs.map((d) => ({
			id: d.id,
			name: d.data().name || "Shopping List",
			isShared: false,
			childId: null,
			isDefault: false,
		}));

		// Additional shared lists the user promoted (exclude the default "shopping" one)
		let additionalShared = [];
		if (childId) {
			const sharedSnap = await getDocs(collection(db, "children", childId, "lists"));
			additionalShared = sharedSnap.docs
				.filter((d) => d.id !== DEFAULT_LIST_ID)
				.map((d) => ({
					id: d.id,
					name: d.data().name || "Shared List",
					isShared: true,
					childId,
					isDefault: false,
				}));
		}

		const all = [
			...(familyList ? [familyList] : []),
			...additionalShared,
			...personal,
		];

		if (all.length === 0) {
			return [{ id: DEFAULT_LIST_ID, name: "Shopping List", isShared: false, childId: null, isDefault: false }];
		}
		return all;
	} catch {
		return [{ id: DEFAULT_LIST_ID, name: "Shopping List", isShared: false, childId: null, isDefault: false }];
	}
}

async function loadListItems(userId, list) {
	try {
		const { doc, getDoc } = await import("firebase/firestore");
		const { db } = await import("../../firebase");
		const snap = await getDoc(doc(db, ...listDocSegments(userId, list)));
		return snap.exists() ? (snap.data().items || []) : [];
	} catch { return []; }
}

async function persistListItems(userId, list, items) {
	try {
		const { doc, setDoc } = await import("firebase/firestore");
		const { db } = await import("../../firebase");
		await setDoc(
			doc(db, ...listDocSegments(userId, list)),
			{ name: list.name, items, updatedAt: new Date().toISOString() },
			{ merge: true },
		);
	} catch { /* silent */ }
}

async function createListDoc(userId, name) {
	try {
		const id = genId();
		const { doc, setDoc } = await import("firebase/firestore");
		const { db } = await import("../../firebase");
		await setDoc(doc(db, "users", userId, "lists", id), {
			name,
			items: [],
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		});
		return { id, name, isShared: false, childId: null, isDefault: false };
	} catch { return null; }
}

async function renameListDoc(userId, list, newName) {
	try {
		const { doc, setDoc } = await import("firebase/firestore");
		const { db } = await import("../../firebase");
		await setDoc(doc(db, ...listDocSegments(userId, list)), { name: newName }, { merge: true });
	} catch { /* silent */ }
}

async function deleteListDoc(userId, list) {
	try {
		const { doc, deleteDoc } = await import("firebase/firestore");
		const { db } = await import("../../firebase");
		await deleteDoc(doc(db, ...listDocSegments(userId, list)));
	} catch { /* silent */ }
}

async function moveListPath(userId, list, makeShared, childId, currentItems) {
	try {
		const { doc, setDoc, deleteDoc } = await import("firebase/firestore");
		const { db } = await import("../../firebase");
		if (makeShared) {
			await setDoc(doc(db, "children", childId, "lists", list.id), {
				name: list.name, items: currentItems, updatedAt: new Date().toISOString(),
			});
			await deleteDoc(doc(db, "users", userId, "lists", list.id));
		} else {
			await setDoc(doc(db, "users", userId, "lists", list.id), {
				name: list.name, items: currentItems, updatedAt: new Date().toISOString(),
			});
			await deleteDoc(doc(db, "children", list.childId, "lists", list.id));
		}
	} catch { /* silent */ }
}

// Shared lists = blue, personal lists = purple
const SHARED_COLORS = { active: "#1d4ed8", inactiveBg: "#dbeafe", inactiveBorder: "#93c5fd", inactiveText: "#1d4ed8" };

// ── ListTabBar ─────────────────────────────────────────────────────────────────

function ListTabBar({ lists, activeKey, onSelect, onAdd, onManage }) {
	const { C } = useTheme();
	return (
		<ScrollView
			horizontal
			showsHorizontalScrollIndicator={false}
			style={{ flexGrow: 0, flexShrink: 0 }}
			contentContainerStyle={{ gap: 8, paddingHorizontal: 14, paddingVertical: 10, alignItems: "center" }}>
			{lists.map((list) => {
				const key       = tabKey(list);
				const active    = key === activeKey;
				const sh        = list.isShared;
				const canManage = !list.isDefault;
				const bg     = active ? (sh ? SHARED_COLORS.active : C.primaryPurple) : (sh ? SHARED_COLORS.inactiveBg : C.white);
				const border = active ? (sh ? SHARED_COLORS.active : C.primaryPurple) : (sh ? SHARED_COLORS.inactiveBorder : C.borderLight);
				const textCol= active ? "#fff" : (sh ? SHARED_COLORS.inactiveText : C.textCharcoal);
				return (
					<TouchableOpacity
						key={key}
						onPress={() => onSelect(key)}
						onLongPress={() => canManage && onManage(list)}
						activeOpacity={0.8}
						style={{
							flexDirection: "row", alignItems: "center", gap: 5,
							backgroundColor: bg, borderRadius: 999,
							paddingLeft: 12, paddingRight: canManage ? 6 : 12, paddingVertical: 8,
							borderWidth: 1.5, borderColor: border,
						}}>
						{sh && <Icon name="users" size={11} color={active ? "#fff" : SHARED_COLORS.active} />}
						<Text style={{ fontSize: 13, fontWeight: "700", color: textCol }}>{list.name}</Text>
						{canManage && (
							<TouchableOpacity
								onPress={() => onManage(list)}
								hitSlop={{ top: 8, bottom: 8, left: 6, right: 8 }}
								style={{ padding: 0 }}>
								<Icon name="more" size={13} color={active ? "rgba(255,255,255,0.65)" : C.mutedText} />
							</TouchableOpacity>
						)}
					</TouchableOpacity>
				);
			})}
			<TouchableOpacity
				onPress={onAdd}
				activeOpacity={0.8}
				style={{
					flexDirection: "row", alignItems: "center", gap: 5,
					backgroundColor: C.bgPurple, borderRadius: 999,
					paddingHorizontal: 12, paddingVertical: 8,
					borderWidth: 1.5, borderColor: C.primaryPurple + "40",
				}}>
				<Icon name="plus" size={13} color={C.primaryPurple} />
				<Text style={{ fontSize: 13, fontWeight: "700", color: C.primaryPurple }}>New list</Text>
			</TouchableOpacity>
		</ScrollView>
	);
}

// ── ListManageSheet ────────────────────────────────────────────────────────────

function ListManageSheet({ visible, list, activeChild, canDelete, onRename, onToggleShare, onDelete, onClose }) {
	const { C } = useTheme();
	const [newName, setNewName] = useState("");
	const [editing, setEditing] = useState(false);
	const inputRef = useRef(null);

	useEffect(() => {
		if (visible) { setNewName(list?.name || ""); setEditing(false); }
	}, [visible, list?.id]);

	const handleSaveName = () => {
		const trimmed = newName.trim();
		if (trimmed && trimmed !== list?.name) onRename(list, trimmed);
		setEditing(false);
		onClose();
	};

	const hasChild  = !!activeChild;
	const isDefault = list?.isDefault;

	return (
		<Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
			<TouchableOpacity
				style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }}
				activeOpacity={1}
				onPress={onClose}
			/>
			<View style={{
				backgroundColor: C.white,
				borderTopLeftRadius: 24, borderTopRightRadius: 24,
				paddingTop: 8, paddingBottom: 40, paddingHorizontal: 20,
			}}>
				<View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.borderLight, alignSelf: "center", marginBottom: 16 }} />
				<Text style={{ fontSize: 16, fontWeight: "800", color: C.textCharcoal, marginBottom: 16 }}>
					{list?.name}
				</Text>

				{/* Rename */}
				{editing ? (
					<View style={{ gap: 10, marginBottom: 8 }}>
						<TextInput
							ref={inputRef}
							value={newName}
							onChangeText={setNewName}
							placeholder="List name"
							autoFocus
							returnKeyType="done"
							onSubmitEditing={handleSaveName}
							style={{ backgroundColor: C.bgPurple, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.textCharcoal }}
						/>
						<View style={{ flexDirection: "row", gap: 8 }}>
							<TouchableOpacity onPress={() => setEditing(false)}
								style={{ flex: 1, backgroundColor: C.bgPurple, borderRadius: 12, paddingVertical: 12, alignItems: "center" }}>
								<Text style={{ fontWeight: "700", color: C.mutedText }}>Cancel</Text>
							</TouchableOpacity>
							<TouchableOpacity onPress={handleSaveName}
								style={{ flex: 1, backgroundColor: C.primaryPurple, borderRadius: 12, paddingVertical: 12, alignItems: "center" }}>
								<Text style={{ fontWeight: "700", color: "#fff" }}>Save</Text>
							</TouchableOpacity>
						</View>
					</View>
				) : (
					<TouchableOpacity onPress={() => setEditing(true)} activeOpacity={0.8}
						style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.borderLight }}>
						<Icon name="edit" size={18} color={C.primaryPurple} />
						<Text style={{ fontSize: 15, fontWeight: "600", color: C.textCharcoal }}>Rename list</Text>
					</TouchableOpacity>
				)}

				{/* Share toggle — not available for the default family list */}
				{hasChild && !editing && !isDefault && (
					<TouchableOpacity
						onPress={() => { onToggleShare(list); onClose(); }}
						activeOpacity={0.8}
						style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.borderLight }}>
						<Icon name="users" size={18} color={list?.isShared ? "#2a5f8f" : C.mutedText} />
						<View style={{ flex: 1 }}>
							<Text style={{ fontSize: 15, fontWeight: "600", color: C.textCharcoal }}>
								{list?.isShared ? "Stop sharing with family" : `Share with ${activeChild.name}'s family`}
							</Text>
							{!list?.isShared && (
								<Text style={{ fontSize: 11, color: C.mutedText, marginTop: 2 }}>
									Family members can view and edit this list
								</Text>
							)}
						</View>
						<View style={{
							width: 42, height: 24, borderRadius: 12,
							backgroundColor: list?.isShared ? "#2a5f8f" : C.borderLight,
							justifyContent: "center", paddingHorizontal: 2,
						}}>
							<View style={{
								width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff",
								alignSelf: list?.isShared ? "flex-end" : "flex-start",
							}} />
						</View>
					</TouchableOpacity>
				)}

				{/* Delete — not available for the default family list */}
				{canDelete && !editing && !isDefault && (
					<TouchableOpacity
						onPress={() => { onDelete(list); onClose(); }}
						activeOpacity={0.8}
						style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 }}>
						<Icon name="trash" size={18} color="#c0392b" />
						<Text style={{ fontSize: 15, fontWeight: "600", color: "#c0392b" }}>Delete list</Text>
					</TouchableOpacity>
				)}
			</View>
		</Modal>
	);
}

// ── ListPickerSheet ───────────────────────────────────────────────────────────

function ListPickerSheet({ visible, lists, onSelect, onClose }) {
	const { C } = useTheme();
	return (
		<Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
			<TouchableOpacity
				style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }}
				activeOpacity={1}
				onPress={onClose}
			/>
			<View style={{
				backgroundColor: C.white,
				borderTopLeftRadius: 24, borderTopRightRadius: 24,
				paddingTop: 8, paddingBottom: 40,
			}}>
				<View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.borderLight, alignSelf: "center", marginBottom: 16 }} />
				<Text style={{ fontSize: 17, fontWeight: "800", color: C.textCharcoal, paddingHorizontal: 20, marginBottom: 8 }}>
					Add to which list?
				</Text>
				{lists.map((list) => (
					<TouchableOpacity
						key={tabKey(list)}
						onPress={() => onSelect(tabKey(list))}
						activeOpacity={0.8}
						style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.borderLight }}>
						<View style={{
							width: 38, height: 38, borderRadius: 11,
							backgroundColor: list.isShared ? SHARED_COLORS.inactiveBg : C.bgPurple,
							alignItems: "center", justifyContent: "center",
						}}>
							<Icon name={list.isShared ? "users" : "cart"} size={17} color={list.isShared ? SHARED_COLORS.active : C.primaryPurple} />
						</View>
						<View style={{ flex: 1 }}>
							<Text style={{ fontSize: 15, fontWeight: "700", color: C.textCharcoal }}>{list.name}</Text>
							{list.isShared && (
								<Text style={{ fontSize: 11, color: SHARED_COLORS.active, marginTop: 1 }}>Shared with family</Text>
							)}
						</View>
						<Icon name="chevRight" size={15} color={C.mutedText} />
					</TouchableOpacity>
				))}
			</View>
		</Modal>
	);
}

// ── CreateListModal ───────────────────────────────────────────────────────────

function CreateListModal({ visible, onCreate, onClose }) {
	const { C } = useTheme();
	const [name, setName] = useState("");
	const inputRef = useRef(null);

	useEffect(() => {
		if (visible) { setName(""); }
	}, [visible]);

	const handleCreate = () => {
		const trimmed = name.trim();
		if (!trimmed) return;
		onCreate(trimmed);
		onClose();
	};

	return (
		<Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
			<KeyboardAvoidingView
				style={{ flex: 1 }}
				behavior={Platform.OS === "ios" ? "padding" : "height"}>
				<TouchableOpacity
					style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }}
					activeOpacity={1}
					onPress={onClose}
				/>
				<View style={{
					backgroundColor: C.white,
					borderTopLeftRadius: 24, borderTopRightRadius: 24,
					paddingTop: 8, paddingBottom: 40, paddingHorizontal: 20,
				}}>
					<View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.borderLight, alignSelf: "center", marginBottom: 16 }} />
					<Text style={{ fontSize: 17, fontWeight: "800", color: C.textCharcoal, marginBottom: 16 }}>New List</Text>
					<TextInput
						ref={inputRef}
						value={name}
						onChangeText={setName}
						placeholder="e.g. Weekly Shop, Pantry…"
						autoFocus
						returnKeyType="done"
						onSubmitEditing={handleCreate}
						placeholderTextColor={C.mutedText}
						style={{ backgroundColor: C.bgPurple, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: C.textCharcoal, marginBottom: 14 }}
					/>
					<View style={{ flexDirection: "row", gap: 10 }}>
						<TouchableOpacity onPress={onClose}
							style={{ flex: 1, backgroundColor: C.bgPurple, borderRadius: 14, paddingVertical: 14, alignItems: "center" }}>
							<Text style={{ fontWeight: "700", color: C.mutedText }}>Cancel</Text>
						</TouchableOpacity>
						<TouchableOpacity
							onPress={handleCreate}
							disabled={!name.trim()}
							style={{ flex: 1, backgroundColor: name.trim() ? C.primaryPurple : C.borderLight, borderRadius: 14, paddingVertical: 14, alignItems: "center" }}>
							<Text style={{ fontWeight: "800", color: "#fff" }}>Create</Text>
						</TouchableOpacity>
					</View>
				</View>
			</KeyboardAvoidingView>
		</Modal>
	);
}

// ── EmptyState ────────────────────────────────────────────────────────────────

function EmptyState() {
	const { C } = useTheme();
	return (
		<View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, paddingBottom: 80 }}>
			<View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: C.bgPurple, alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
				<Icon name="cart" size={36} color={C.primaryPurple} />
			</View>
			<Text style={{ fontSize: 20, fontWeight: "800", color: C.textCharcoal, textAlign: "center", marginBottom: 8 }}>
				List is empty
			</Text>
			<Text style={{ fontSize: 14, color: C.mutedText, textAlign: "center", lineHeight: 20 }}>
				Add items below or tap "From Recipe" to import ingredients straight from a recipe.
			</Text>
		</View>
	);
}

// ── ItemRow ───────────────────────────────────────────────────────────────────

function ItemRow({ item, onToggle, onRemove, currentUserId, isListShared }) {
	const { C } = useTheme();
	const fadeAnim = useRef(new Animated.Value(1)).current;

	const handleRemove = () => {
		Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => onRemove(item.id));
	};

	const addedByLabel = isListShared && item.addedBy
		? item.addedBy === currentUserId ? "You" : (item.addedByName || "Partner")
		: null;

	return (
		<Animated.View style={{ opacity: fadeAnim, flexDirection: "row", alignItems: "center", backgroundColor: C.white, borderRadius: 14, marginBottom: 8, paddingHorizontal: 14, paddingVertical: 12, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 }}>
			<TouchableOpacity onPress={() => onToggle(item.id)} activeOpacity={0.7}
				style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: item.checked ? C.primaryPurple : C.borderLight, backgroundColor: item.checked ? C.primaryPurple : "transparent", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
				{item.checked && <Icon name="check" size={13} color="#fff" />}
			</TouchableOpacity>
			<View style={{ flex: 1, gap: 3 }}>
				<Text style={{ fontSize: 15, fontWeight: "600", color: item.checked ? C.mutedText : C.textCharcoal, textDecorationLine: item.checked ? "line-through" : "none" }} numberOfLines={2}>
					{item.name}
				</Text>
				<View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
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
					{addedByLabel && (
						<View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
							<Icon name="user" size={10} color={C.mutedText} />
							<Text style={{ fontSize: 11, color: C.mutedText, fontStyle: "italic" }}>{addedByLabel}</Text>
						</View>
					)}
				</View>
			</View>
			<TouchableOpacity onPress={handleRemove} activeOpacity={0.7}
				style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "#fde8e8", alignItems: "center", justifyContent: "center", marginLeft: 8 }}>
				<Icon name="trash" size={14} color="#c0392b" />
			</TouchableOpacity>
		</Animated.View>
	);
}

// ── RecipePickerModal ─────────────────────────────────────────────────────────

function RecipePickerModal({ visible, recipes, onClose, onAddIngredients }) {
	const { C } = useTheme();
	const [step, setStep]                     = useState("recipes");
	const [selectedRecipe, setSelectedRecipe] = useState(null);
	const [checked, setChecked]               = useState({});
	const [search, setSearch]                 = useState("");

	useEffect(() => {
		if (!visible) { setStep("recipes"); setSelectedRecipe(null); setChecked({}); setSearch(""); }
	}, [visible]);

	const filteredRecipes = recipes.filter((r) => r.title?.toLowerCase().includes(search.toLowerCase()));

	const handlePickRecipe = (recipe) => {
		setSelectedRecipe(recipe);
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
										Select ingredients to add to list
									</Text>
								)}
							</View>
							<TouchableOpacity onPress={onClose}
								style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.bgPurple, alignItems: "center", justifyContent: "center" }}>
								<Icon name="close" size={15} color={C.mutedText} />
							</TouchableOpacity>
						</View>
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

// ── Main Screen ───────────────────────────────────────────────────────────────

export function ShoppingListScreen({ user, isPro, onUpgradePro, recipes = [], visible = true, activeChild = null }) {
	const { C } = useTheme();
	const insets = useSafeAreaInsets();

	// ── List state ─────────────────────────────────────────────────────────────
	const [lists,           setLists]           = useState([]);
	const [activeTabKey,    setActiveTabKey]    = useState(null);
	const [manageList,      setManageList]      = useState(null);
	const [showCreate,      setShowCreate]      = useState(false);
	const [showListPicker,  setShowListPicker]  = useState(false);
	const [pendingRecipe,   setPendingRecipe]   = useState(null);

	// ── Item state ─────────────────────────────────────────────────────────────
	const [items,      setItems]      = useState([]);
	const [loading,    setLoading]    = useState(true);
	const [newName,    setNewName]    = useState("");
	const [newQty,     setNewQty]     = useState("");
	const [showRecipes, setShowRecipes] = useState(false);
	const [kbPadding,  setKbPadding]  = useState(0);
	const nameRef = useRef(null);

	// ── Keyboard avoidance (iOS) ───────────────────────────────────────────────
	useEffect(() => {
		if (Platform.OS !== "ios") return;
		const TAB_BAR_HEIGHT = 49 + insets.bottom;
		const show = Keyboard.addListener("keyboardWillShow", (e) => {
			setKbPadding(Math.max(0, e.endCoordinates.height - TAB_BAR_HEIGHT));
		});
		const hide = Keyboard.addListener("keyboardWillHide", () => setKbPadding(0));
		return () => { show.remove(); hide.remove(); };
	}, [insets.bottom]);

	// ── Derived: active list descriptor ───────────────────────────────────────
	const activeList = lists.find((l) => tabKey(l) === activeTabKey) || lists[0] || null;
	const childId    = isPro ? (activeChild?.id || null) : null;

	// ── Load all lists ─────────────────────────────────────────────────────────
	useEffect(() => {
		if (!user?.uid) { setLoading(false); return; }
		loadAllLists(user.uid, childId).then((loaded) => {
			setLists(loaded);
			setActiveTabKey(loaded[0] ? tabKey(loaded[0]) : null);
		});
	}, [user?.uid, childId]);

	// ── Load items when active list changes ────────────────────────────────────
	useEffect(() => {
		if (!activeList || !user?.uid) { setLoading(false); return; }
		setLoading(true);
		loadListItems(user.uid, activeList).then((saved) => {
			setItems(saved);
			setLoading(false);
		});
	}, [activeList?.id, activeList?.isShared]);

	// Reload when screen becomes visible
	useEffect(() => {
		if (!visible || !activeList || !user?.uid) return;
		loadListItems(user.uid, activeList).then(setItems);
	}, [visible]);

	// ── Save ───────────────────────────────────────────────────────────────────
	const save = useCallback((newItems) => {
		if (activeList && user?.uid) persistListItems(user.uid, activeList, newItems);
	}, [activeList, user?.uid]);

	// ── Item CRUD ──────────────────────────────────────────────────────────────
	const addItem = () => {
		const name = newName.trim();
		if (!name) { nameRef.current?.focus(); return; }
		const addedByName = user?.displayName || user?.email?.split("@")[0] || "You";
		const next = [{ id: genId(), name, quantity: newQty.trim(), checked: false, addedBy: user?.uid, addedByName }, ...items];
		setItems(next); save(next);
		setNewName(""); setNewQty("");
		nameRef.current?.focus();
	};

	const toggleItem = (id) => {
		const next = items.map((it) => it.id === id ? { ...it, checked: !it.checked } : it);
		setItems(next); save(next);
	};

	const removeItem = (id) => {
		const next = items.filter((it) => it.id !== id);
		setItems(next); save(next);
	};

	const clearChecked = () => {
		const next = items.filter((it) => !it.checked);
		setItems(next); save(next);
	};

	const clearAll = () => {
		Alert.alert("Clear entire list?", "This will remove all items, including ones not yet ticked off.", [
			{ text: "Cancel", style: "cancel" },
			{ text: "Clear all", style: "destructive", onPress: () => { setItems([]); save([]); } },
		]);
	};

	// ── Recipe add flow ────────────────────────────────────────────────────────
	const commitRecipeAdd = useCallback((recipeId, recipeTitle, ingredients, targetList) => {
		const list = targetList || activeList;
		if (!list || !user?.uid) return;
		const addedByName = user?.displayName || user?.email?.split("@")[0] || "You";
		const newItems = ingredients.map((ing) => {
			const { name, quantity } = parseIngredient(ing);
			return { id: genId(), name, quantity, checked: false, recipeId, recipeTitle, addedBy: user.uid, addedByName };
		});
		const next = [...newItems, ...items];
		if (!targetList || targetList.id === activeList?.id) {
			setItems(next);
		}
		persistListItems(user.uid, list, next);
	}, [activeList, items, user?.uid]);

	const handleRecipeAdd = (recipeId, recipeTitle, ingredients) => {
		if (isPro && lists.length > 1) {
			setPendingRecipe({ recipeId, recipeTitle, ingredients });
			setShowListPicker(true);
		} else {
			commitRecipeAdd(recipeId, recipeTitle, ingredients);
		}
	};

	const handleListPickerSelect = (key) => {
		setShowListPicker(false);
		if (!pendingRecipe) return;
		const target = lists.find((l) => tabKey(l) === key);
		if (target) {
			commitRecipeAdd(pendingRecipe.recipeId, pendingRecipe.recipeTitle, pendingRecipe.ingredients, target);
			setActiveTabKey(key);
		}
		setPendingRecipe(null);
	};

	// ── List management ────────────────────────────────────────────────────────
	const handleCreateList = async (name) => {
		if (!user?.uid) return;
		const newList = await createListDoc(user.uid, name);
		if (newList) {
			setLists((prev) => [...prev, newList]);
			setActiveTabKey(tabKey(newList));
			setItems([]);
		}
	};

	const handleRenameList = async (list, newName) => {
		await renameListDoc(user.uid, list, newName);
		setLists((prev) => prev.map((l) => tabKey(l) === tabKey(list) ? { ...l, name: newName } : l));
	};

	const handleToggleShare = async (list) => {
		if (list.isDefault || !activeChild?.id || !user?.uid) return;
		const currentItems = tabKey(list) === tabKey(activeList) ? items : await loadListItems(user.uid, list);
		const makeShared = !list.isShared;
		await moveListPath(user.uid, list, makeShared, activeChild.id, currentItems);
		setLists((prev) => prev.map((l) => tabKey(l) === tabKey(list)
			? { ...l, isShared: makeShared, childId: makeShared ? activeChild.id : null }
			: l,
		));
	};

	const handleDeleteList = (list) => {
		if (list.isDefault) return;
		Alert.alert(`Delete "${list.name}"?`, "All items in this list will be permanently removed.", [
			{ text: "Cancel", style: "cancel" },
			{
				text: "Delete",
				style: "destructive",
				onPress: async () => {
					await deleteListDoc(user.uid, list);
					const remaining = lists.filter((l) => tabKey(l) !== tabKey(list));
					setLists(remaining);
					if (tabKey(list) === activeTabKey) {
						const next = remaining[0];
						setActiveTabKey(next ? tabKey(next) : null);
						if (next) loadListItems(user.uid, next).then(setItems);
						else setItems([]);
					}
				},
			},
		]);
	};

	// ── Derived ────────────────────────────────────────────────────────────────
	const unchecked = items.filter((it) => !it.checked);
	const checked   = items.filter((it) => it.checked);
	const isShared  = activeList?.isShared && (activeChild?.sharedWith?.length > 0 || activeChild?.userId !== user?.uid);

	if (loading) {
		return (
			<View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
				<ActivityIndicator color={C.primaryPurple} />
			</View>
		);
	}

	return (
		<View style={{ flex: 1, backgroundColor: C.screen, paddingBottom: kbPadding }}>

			{/* List tab bar — always visible for Pro */}
			{isPro && (
				<ListTabBar
					lists={lists}
					activeKey={activeTabKey}
					onSelect={(key) => { if (key !== activeTabKey) setActiveTabKey(key); }}
					onAdd={() => setShowCreate(true)}
					onManage={setManageList}
				/>
			)}

			{/* Shared indicator */}
			{isShared && (
				<View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#d4eef5", borderRadius: 10, marginHorizontal: 14, marginBottom: 2, paddingHorizontal: 12, paddingVertical: 7 }}>
					<Icon name="users" size={13} color="#2a5f8f" />
					<Text style={{ fontSize: 12, fontWeight: "700", color: "#2a5f8f" }}>
						Shared list — updates visible to all family members
					</Text>
				</View>
			)}

			{/* Pro upsell for free users with a child */}
			{!isPro && activeChild && (
				<TouchableOpacity onPress={onUpgradePro} activeOpacity={0.85}
					style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fef9c3", borderRadius: 10, marginHorizontal: 14, marginBottom: 4, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "#f5c84240" }}>
					<Icon name="crown" size={13} color="#c8920a" />
					<Text style={{ fontSize: 12, fontWeight: "700", color: "#c8920a", flex: 1 }}>
						Upgrade to Pro to share lists and create multiple lists
					</Text>
					<Icon name="chevRight" size={12} color="#c8920a" />
				</TouchableOpacity>
			)}

			{/* Action bar */}
			<View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10 }}>
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
				{items.length > 0 && checked.length === 0 && (
					<TouchableOpacity onPress={clearAll} activeOpacity={0.8}
						style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fde8e8", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 }}>
						<Icon name="trash" size={14} color="#c0392b" />
						<Text style={{ fontSize: 13, fontWeight: "700", color: "#c0392b" }}>Clear all</Text>
					</TouchableOpacity>
				)}
			</View>

			{/* Items */}
			{items.length === 0 ? (
				<EmptyState />
			) : (
				<ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 12 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
					{unchecked.map((item) => (
						<ItemRow key={item.id} item={item} onToggle={toggleItem} onRemove={removeItem} currentUserId={user?.uid} isListShared={activeList?.isShared} />
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
						<ItemRow key={item.id} item={item} onToggle={toggleItem} onRemove={removeItem} currentUserId={user?.uid} isListShared={activeList?.isShared} />
					))}
				</ScrollView>
			)}

			{/* Sticky input */}
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

			{/* Modals */}
			<RecipePickerModal
				visible={showRecipes}
				recipes={recipes}
				onClose={() => setShowRecipes(false)}
				onAddIngredients={handleRecipeAdd}
			/>
			<ListPickerSheet
				visible={showListPicker}
				lists={lists}
				onSelect={handleListPickerSelect}
				onClose={() => { setShowListPicker(false); setPendingRecipe(null); }}
			/>
			<ListManageSheet
				visible={!!manageList}
				list={manageList}
				activeChild={isPro ? activeChild : null}
				canDelete={lists.length > 1}
				onRename={handleRenameList}
				onToggleShare={handleToggleShare}
				onDelete={handleDeleteList}
				onClose={() => setManageList(null)}
			/>
			<CreateListModal
				visible={showCreate}
				onCreate={handleCreateList}
				onClose={() => setShowCreate(false)}
			/>
		</View>
	);
}
