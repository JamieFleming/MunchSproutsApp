import React, { useState, useEffect } from "react";
import {
	View,
	Text,
	TouchableOpacity,
	ScrollView,
	Modal,
	Alert,
	StatusBar,
	Platform,
	KeyboardAvoidingView,
	Image,
} from "react-native";
import {
	SafeAreaView,
	useSafeAreaInsets,
	SafeAreaProvider,
} from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";
import {
	useAuth,
	logOut,
	fetchChildren,
	fetchFoodLog,
	fetchBottleLog,
	fetchRecipes,
	fetchFavouriteRecipes,
	toggleRecipeFavourite,
	addFoodEntry,
	updateFoodEntry,
	deleteFoodEntry,
	addBottleEntry,
	updateBottleEntry,
	deleteBottleEntry,
	addChild as fbAddChild,
	updateChild as fbUpdateChild,
	deleteChild as fbDeleteChild,
	deleteAccount,
} from "./firebaseHooks";
import AuthScreen from "./AuthScreen";
import Purchases, { LOG_LEVEL } from "react-native-purchases";

import { ThemeContext, useTheme, useStyles } from "./src/ThemeContext";
import { THEMES } from "./src/constants";
import { normalize, groupByFood } from "./src/helpers";

import { LoadingScreen } from "./src/screens/LoadingScreen";
import { DashboardScreen } from "./src/screens/DashboardScreen";
import { LogScreen } from "./src/screens/LogScreen";
import { RecipesScreen } from "./src/screens/RecipesScreen";
import { MoreScreen } from "./src/screens/MoreScreen";
import { ChildrenScreen } from "./src/screens/ChildrenScreen";
import { BottleScreen } from "./src/screens/BottleScreen";

import { Icon } from "./src/components/Icon";
import { FoodForm } from "./src/components/FoodForm";
import { EditModal } from "./src/components/EditModal";
import { LogRecipeModal } from "./src/components/LogRecipeModal";

// ─── HELPER ───────────────────────────────────────────────────────────────────
function buildUserMap(userId, userEmail, kids) {
	const map = { [userId]: userEmail };
	for (const child of kids) {
		if (child.ownerEmail && child.userId) map[child.userId] = child.ownerEmail;
		if (child.sharedWith && child.sharedWithEmails) {
			child.sharedWith.forEach((uid, i) => {
				if (child.sharedWithEmails[i]) map[uid] = child.sharedWithEmails[i];
			});
		}
	}
	return map;
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
function MainApp({ user, isPro: isPropPro }) {
	const { C, theme } = useTheme();
	const s = useStyles();
	const insets = useSafeAreaInsets();
	const [isPro, setIsPro] = useState(isPropPro);

	// Sync when Firestore finishes loading (isPropPro starts false while auth resolves)
	useEffect(() => {
		if (isPropPro) setIsPro(true);
	}, [isPropPro]);

	const [page, setPage] = useState("dashboard");
	const [foodLog, setFoodLog] = useState([]);
	const [children, setChildren] = useState([]);
	const [activeChildId, setActiveChildId] = useState(null);
	const [dataLoaded, setDataLoaded] = useState(false);
	const [editEntry, setEditEntry] = useState(null);
	const [toasts, setToasts] = useState([]);
	const [showChildPicker, setShowChildPicker] = useState(false);
	const [showLogRecipeModal, setShowLogRecipeModal] = useState(false);
	const [logRecipeTarget, setLogRecipeTarget] = useState(null);
	const [logFilter, setLogFilter] = useState("");
	const [logOpenKey, setLogOpenKey] = useState(null);
	const [prefillFood, setPrefillFood] = useState(null);
	const [refreshing, setRefreshing] = useState(false);
	const [userMap, setUserMap] = useState({});
	const [showAddMenu, setShowAddMenu] = useState(false);
	const [recipes, setRecipes] = useState([]);
	const [favouriteRecipeIds, setFavouriteRecipeIds] = useState([]);
	const [bottleLog, setBottleLog] = useState([]);

	// ── RevenueCat init ──
	useEffect(() => {
		if (!user) return;
		Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
		const apiKey =
			Platform.OS === "ios"
				? "appl_xNGjmEgufsXuWySnKebRetuKCGj"
				: "goog_rcHUTFIPkKdXdEAQHcexulBdpOj";
		Purchases.configure({ apiKey, appUserID: user.uid });
	}, [user]);

	// ── Initial data load ──
	useEffect(() => {
		if (!user) return;
		Promise.all([
			fetchFoodLog(user.uid),
			fetchChildren(user.uid),
			fetchRecipes(),
			fetchFavouriteRecipes(user.uid),
			fetchBottleLog(user.uid),
		])
			.then(([log, kids, recs, favIds, bottles]) => {
				setFoodLog(log);
				setChildren(kids);
				setRecipes(recs);
				setFavouriteRecipeIds(favIds);
				setBottleLog(bottles);
				if (kids.length > 0) setActiveChildId(kids[0].id);
				setDataLoaded(true);
				setUserMap(buildUserMap(user.uid, user.email, kids));
			})
			.catch((err) => {
				console.error("Error loading data:", err);
				setDataLoaded(true);
			});
	}, [user]);

	// ── Derived state ──
	const activeChild = children.find((c) => c.id === activeChildId) || children[0] || null;
	const childLog = activeChild ? foodLog.filter((f) => f.childId === activeChild.id) : foodLog;

	// ── Toast helper ──
	const toast = (msg, type = "success") => {
		const id = Date.now();
		setToasts((p) => [...p, { id, msg, type }]);
		setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3000);
	};

	// ── Pull-to-refresh ──
	const onRefresh = async () => {
		setRefreshing(true);
		try {
			const [log, kids, recs, favIds, bottles] = await Promise.all([
				fetchFoodLog(user.uid),
				fetchChildren(user.uid),
				fetchRecipes(),
				fetchFavouriteRecipes(user.uid),
				fetchBottleLog(user.uid),
			]);
			setFoodLog(log);
			setChildren(kids);
			setRecipes(recs);
			setFavouriteRecipeIds(favIds);
			setBottleLog(bottles);
			if (kids.length > 0) {
				const stillExists = kids.find((k) => k.id === activeChildId);
				if (!stillExists) setActiveChildId(kids[0].id);
			}
			setUserMap(buildUserMap(user.uid, user.email, kids));
			toast("Updated");
		} catch (e) {
			console.error("Refresh failed:", e);
		}
		setRefreshing(false);
	};

	// ── Food log handlers ──
	const handleAddAttempt = (group) => {
		setPrefillFood({
			name: group.name,
			category: group.category,
			categories: group.attempts?.[0]?.categories || (group.category ? [group.category] : []),
			feedType: group.attempts?.[0]?.feedType || "",
		});
		setPage("add");
	};

	const addFood = async (form, err) => {
		if (!form) {
			Alert.alert("Missing Info", err || "Please fill in required fields.");
			return;
		}
		if (!activeChild) {
			Alert.alert(
				"No child selected",
				"You need to add a child before logging food. Would you like to add one now?",
				[
					{ text: "Not now", style: "cancel" },
					{ text: "Add child", onPress: () => setPage("children") },
				],
			);
			return;
		}
		const existing = childLog.filter((f) => normalize(f.name) === normalize(form.name));
		const entry = {
			childId: activeChild.id,
			attemptNum: existing.length + 1,
			...form,
			categories: form.categories || (form.category ? [form.category] : []),
			category: form.category || (form.categories?.[0] ?? ""),
			ml: (form.categories || []).includes("Liquids") ? form.ml || "" : "",
		};
		try {
			const newId = await addFoodEntry(user.uid, entry);
			setFoodLog((p) => [...p, { id: newId, ...entry }]);
			toast(existing.length === 0 ? `Added "${form.name}"` : `"${form.name}" attempt #${existing.length + 1}`);
			setPage("log");
		} catch (e) {
			Alert.alert("Error", "Could not save entry.");
		}
	};

	const editFood = async (updated, err) => {
		if (!updated) {
			Alert.alert("Missing Info", err || "Please fill required fields.");
			return;
		}
		try {
			await updateFoodEntry(updated.id, updated);
			setFoodLog((p) => p.map((f) => (f.id === updated.id ? { ...f, ...updated } : f)));
			setEditEntry(null);
			toast("Entry updated");
		} catch (e) {
			Alert.alert("Error", "Could not update entry.");
		}
	};

	const deleteFood = async (id) => {
		try {
			await deleteFoodEntry(id);
			setFoodLog((p) => p.filter((f) => f.id !== id));
			toast("Entry deleted");
		} catch (e) {
			Alert.alert("Error", "Could not delete entry.");
		}
	};

	const toggleFav = async (id) => {
		const entry = foodLog.find((f) => f.id === id);
		if (!entry) return;
		const newVal = !entry.favourite;
		try {
			await updateFoodEntry(id, { favourite: newVal });
			setFoodLog((p) => p.map((f) => (f.id === id ? { ...f, favourite: newVal } : f)));
		} catch (e) {}
	};

	// ── Bottle log handlers ──
	const addBottle = async (entry) => {
		if (!activeChild) {
			Alert.alert("No child selected", "Please select a child first.");
			return;
		}
		try {
			const newId = await addBottleEntry(user.uid, { ...entry, childId: activeChild.id });
			setBottleLog((p) => [...p, { id: newId, ...entry, childId: activeChild.id }]);
			toast("Bottle logged");
		} catch (e) {
			Alert.alert("Error", "Could not save bottle entry.");
		}
	};

	const editBottle = async (updated) => {
		try {
			await updateBottleEntry(updated.id, updated);
			setBottleLog((p) => p.map((b) => (b.id === updated.id ? { ...b, ...updated } : b)));
			toast("Updated");
		} catch (e) {
			Alert.alert("Error", "Could not update entry.");
		}
	};

	const deleteBottle = async (id) => {
		try {
			await deleteBottleEntry(id);
			setBottleLog((p) => p.filter((b) => b.id !== id));
			toast("Entry deleted");
		} catch (e) {
			Alert.alert("Error", "Could not delete entry.");
		}
	};

	// ── Child handlers ──
	const addChild = async (child) => {
		try {
			const newId = await fbAddChild(user.uid, child);
			const newChild = { id: newId, ...child };
			setChildren((p) => [...p, newChild]);
			if (!activeChildId) setActiveChildId(newId);
			toast(`${child.name} added`);
		} catch (e) {
			Alert.alert("Error", "Could not add child.");
		}
	};

	const editChild = async (updated) => {
		try {
			await fbUpdateChild(updated.id, updated);
			setChildren((p) => p.map((c) => (c.id === updated.id ? updated : c)));
			toast("Updated");
		} catch (e) {
			Alert.alert("Error", "Could not update child.");
		}
	};

	const deleteChild = async (id) => {
		try {
			await fbDeleteChild(id, user.uid);
		} catch (e) {
			console.warn("deleteChild error:", e.message);
		} finally {
			setChildren((p) => p.filter((c) => c.id !== id));
			setFoodLog((p) => p.filter((f) => f.childId !== id));
			if (activeChildId === id) {
				const remaining = children.filter((c) => c.id !== id);
				setActiveChildId(remaining.length > 0 ? remaining[0].id : null);
			}
			toast("Child removed");
		}
	};

	// ── Recipes ──
	const handleToggleRecipeFav = async (recipeId) => {
		const isFav = favouriteRecipeIds.includes(recipeId);
		setFavouriteRecipeIds((prev) => (isFav ? prev.filter((id) => id !== recipeId) : [...prev, recipeId]));
		try {
			await toggleRecipeFavourite(user.uid, recipeId, isFav);
		} catch (e) {
			setFavouriteRecipeIds((prev) => (isFav ? [...prev, recipeId] : prev.filter((id) => id !== recipeId)));
			Alert.alert("Error", e.message || "Could not update favourite.");
		}
	};

	const handleLogRecipe = (recipe) => {
		if (!activeChild) {
			Alert.alert("No child selected", "Please select a child first.");
			return;
		}
		setLogRecipeTarget(recipe);
		setShowLogRecipeModal(true);
	};

	const handleLogRecipeConfirm = async (reaction, notes) => {
		if (!logRecipeTarget || !activeChild) return;
		const categoryMap = {
			Breakfast: "Grains",
			"Finger Foods": "Other",
			Mains: "Proteins",
			Snacks: "Fruits",
			Lunch: "Vegetables",
			Dinner: "Proteins",
			Desserts: "Fruits",
		};
		const existing = childLog.filter((f) => normalize(f.name) === normalize(logRecipeTarget.title));
		const entry = {
			childId: activeChild.id,
			date: new Date().toISOString().split("T")[0],
			name: logRecipeTarget.title,
			category: categoryMap[logRecipeTarget.category] || logRecipeTarget.category || "Other",
			form: "Mixed Texture",
			reaction: reaction || "",
			notes: notes || "",
			favourite: false,
			attemptNum: existing.length + 1,
		};
		try {
			const newId = await addFoodEntry(user.uid, entry);
			setFoodLog((p) => [...p, { id: newId, ...entry }]);
			setShowLogRecipeModal(false);
			setLogRecipeTarget(null);
			toast(`"${logRecipeTarget.title}" added to food log`);
			setPage("log");
		} catch (e) {
			Alert.alert("Error", "Could not add to food log.");
		}
	};

	// ── Account handlers ──
	const handleLogout = () =>
		Alert.alert("Sign Out", "Are you sure?", [
			{ text: "Cancel" },
			{ text: "Sign Out", style: "destructive", onPress: () => logOut() },
		]);

	const handleDeleteAccount = async () => {
		try {
			await deleteAccount(user.uid);
		} catch (e) {
			if (e.code === "auth/requires-recent-login") {
				Alert.alert("Please sign in again", "Sign out and back in before deleting your account.");
			} else {
				Alert.alert("Error", e.message || "Could not delete account.");
			}
		}
	};

	const handleUpgradePro = async () => {
		try {
			const offerings = await Purchases.getOfferings();
			if (!offerings.current || offerings.current.availablePackages.length === 0) {
				Alert.alert(
					"Not available",
					"Purchase not available right now. Make sure you have set up a product in App Store Connect and linked it in RevenueCat.",
				);
				return;
			}
			const proPackage = offerings.current.availablePackages[0];
			const { customerInfo } = await Purchases.purchasePackage(proPackage);
			if (customerInfo.entitlements.active["pro"]) {
				const { doc, updateDoc } = await import("firebase/firestore");
				const { db: firedb } = await import("./firebase");
				await updateDoc(doc(firedb, "users", user.uid), { plan: "pro" });
				setIsPro(true);
				Alert.alert("Welcome to Pro! 🎉", "You now have access to all recipes and premium features.");
			}
		} catch (e) {
			if (e.userCancelled) return;
			Alert.alert("Purchase failed", e.message || "Something went wrong. Please try again.");
		}
	};

	const handleRestorePurchases = async () => {
		try {
			const customerInfo = await Purchases.restorePurchases();
			if (customerInfo.entitlements.active["pro"]) {
				const { doc, updateDoc } = await import("firebase/firestore");
				const { db: firedb } = await import("./firebase");
				await updateDoc(doc(firedb, "users", user.uid), { plan: "pro" });
				setIsPro(true);
				Alert.alert("Restored ✓", "Your Pro purchase has been restored.");
			} else {
				Alert.alert("Nothing to restore", "No previous Pro purchase found on this Apple/Google account.");
			}
		} catch (e) {
			Alert.alert("Error", e.message || "Could not restore purchases.");
		}
	};

	// ── Family sharing ──
	const handleManageSharing = async (emailOrUid, childId, onSuccess, isRemove = false) => {
		if (!childId) {
			Alert.alert("No child selected", "Please select a child to share.");
			return;
		}
		try {
			const {
				doc,
				updateDoc,
				arrayUnion,
				arrayRemove,
				collection,
				query,
				where,
				getDocs: fsGetDocs,
			} = await import("firebase/firestore");
			const { db: firedb } = await import("./firebase");

			if (isRemove) {
				await updateDoc(doc(firedb, "children", childId), { sharedWith: arrayRemove(emailOrUid) });
				const child = children.find((c) => c.id === childId);
				const uidIndex = (child?.sharedWith || []).indexOf(emailOrUid);
				const matchingEmail = uidIndex !== -1 ? (child?.sharedWithEmails || [])[uidIndex] : null;
				if (matchingEmail) {
					await updateDoc(doc(firedb, "children", childId), {
						sharedWithEmails: arrayRemove(matchingEmail),
					});
				}
				setChildren((prev) =>
					prev.map((c) =>
						c.id === childId
							? {
									...c,
									sharedWith: (c.sharedWith || []).filter((u) => u !== emailOrUid),
									sharedWithEmails: matchingEmail
										? (c.sharedWithEmails || []).filter((e) => e !== matchingEmail)
										: c.sharedWithEmails || [],
								}
							: c,
					),
				);
				Alert.alert("Removed", "Access has been removed.");
				return;
			}

			const usersQuery = query(
				collection(firedb, "users"),
				where("email", "==", emailOrUid.toLowerCase().trim()),
			);
			const snap = await fsGetDocs(usersQuery);
			if (snap.empty) {
				Alert.alert(
					"Account not found",
					`No Munch Sprouts account found for ${emailOrUid}. They need to create an account first.`,
				);
				return;
			}
			const theirUid = snap.docs[0].id;
			if (theirUid === user.uid) {
				Alert.alert("That's you", "You can't share a child with yourself.");
				return;
			}
			const child = children.find((c) => c.id === childId);
			if (child?.sharedWith?.includes(theirUid)) {
				Alert.alert("Already shared", `${emailOrUid} already has access to ${child.name}.`);
				return;
			}
			const theirEmail = emailOrUid.toLowerCase().trim();
			await updateDoc(doc(firedb, "children", childId), {
				sharedWith: arrayUnion(theirUid),
				sharedWithEmails: arrayUnion(theirEmail),
			});
			setChildren((prev) =>
				prev.map((c) =>
					c.id === childId
						? {
								...c,
								sharedWith: [...(c.sharedWith || []), theirUid],
								sharedWithEmails: [...(c.sharedWithEmails || []), theirEmail],
							}
						: c,
				),
			);
			const childName = child?.name || "your child";
			Alert.alert(
				"Shared! ✓",
				`${emailOrUid} now has access to ${childName}. They will see the data next time they open the app.`,
			);
			if (onSuccess) onSuccess();
		} catch (e) {
			console.error("Sharing error:", e);
			Alert.alert("Error", e.message || "Could not update sharing. Please try again.");
		}
	};

	if (!dataLoaded) return <LoadingScreen />;

	const nav = [
		{ id: "dashboard", icon: "home", label: "Home" },
		{ id: "log", icon: "list", label: "Foods" },
		{ id: "bottle", icon: "bottle", label: "Bottles" },
		{ id: "recipes", icon: "chef", label: "Recipes" },
		{ id: "more", icon: "more", label: "More" },
	];
	const titles = {
		dashboard: "Dashboard",
		log: "Food Log",
		add: "Log Food",
		bottle: "Bottle Log",
		recipes: "Recipes",
		more: "More",
		children: "Children",
	};

	return (
		<SafeAreaView style={{ flex: 1, backgroundColor: C.screen }} edges={["top"]}>
			<StatusBar
				barStyle={theme === "dark" ? "light-content" : "dark-content"}
				backgroundColor={C.navBg}
			/>

			{/* ── Header ── */}
			<View style={s.header}>
				<View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
					<Image
						source={require("./assets/logo.png")}
						style={{ width: 36, height: 36, borderRadius: 10 }}
						resizeMode="contain"
					/>
					<View>
						<Text style={s.appName}>Munch Sprouts</Text>
						<Text style={s.pageSubtitle}>{titles[page] || "Dashboard"}</Text>
					</View>
				</View>

				<TouchableOpacity
					onPress={() => setShowChildPicker(true)}
					style={{
						backgroundColor: C.bgPurple,
						borderRadius: 999,
						paddingHorizontal: 14,
						paddingVertical: 7,
						flexDirection: "row",
						alignItems: "center",
						gap: 6,
					}}>
					<Svg width={16} height={16} viewBox="0 0 32 32">
						<Circle cx="16" cy="13" r="7" fill={C.primaryPurple} opacity="0.8" />
						<Circle cx="11" cy="12" r="1.5" fill={C.white} />
						<Circle cx="21" cy="12" r="1.5" fill={C.white} />
						<Path
							d="M11 16.5 Q16 19.5 21 16.5"
							stroke={C.white}
							strokeWidth="1.5"
							strokeLinecap="round"
							fill="none"
						/>
					</Svg>
					<Text style={{ fontSize: 13, fontWeight: "700", color: C.primaryPurple }} numberOfLines={1}>
						{activeChild ? activeChild.name : "Add Baby"}
					</Text>
					<Icon name="chevDown" size={12} color={C.primaryPurple} />
				</TouchableOpacity>
			</View>

			{/* ── Child picker modal ── */}
			<Modal
				visible={showChildPicker}
				transparent
				animationType="slide"
				onRequestClose={() => setShowChildPicker(false)}>
				<TouchableOpacity
					style={s.pickerOverlay}
					onPress={() => setShowChildPicker(false)}
					activeOpacity={1}>
					<View
						style={[s.pickerSheet, { maxHeight: "70%" }]}
						onStartShouldSetResponder={() => true}>
						<Text style={s.pickerTitle}>Select Child</Text>
						<ScrollView>
							{children.map((c) => (
								<TouchableOpacity
									key={c.id}
									onPress={() => {
										setActiveChildId(c.id);
										setShowChildPicker(false);
									}}
									style={[s.pickerItem, c.id === activeChildId && { backgroundColor: C.bgPurple }]}>
									<View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
										{c.photoUri ? (
											<Image
												source={{ uri: c.photoUri }}
												style={{ width: 34, height: 34, borderRadius: 17 }}
												resizeMode="cover"
											/>
										) : (
											<View
												style={{
													width: 34,
													height: 34,
													borderRadius: 17,
													backgroundColor: C.primaryPurple + "22",
													alignItems: "center",
													justifyContent: "center",
												}}>
												<Icon name="baby" size={16} color={C.primaryPurple} />
											</View>
										)}
										<Text
											style={[
												s.pickerItemText,
												c.id === activeChildId && { color: C.primaryPurple, fontWeight: "700" },
											]}>
											{c.name}
										</Text>
									</View>
									{c.id === activeChildId && <Icon name="check" size={16} color={C.primaryPurple} />}
								</TouchableOpacity>
							))}
							<TouchableOpacity
								onPress={() => {
									setShowChildPicker(false);
									setPage("children");
								}}
								style={[
									s.pickerItem,
									{ borderWidth: 1.5, borderColor: C.borderLight, borderRadius: 14, marginTop: 8 },
								]}>
								<View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
									<View
										style={{
											width: 34,
											height: 34,
											borderRadius: 17,
											backgroundColor: C.bgPurple,
											alignItems: "center",
											justifyContent: "center",
										}}>
										<Icon name="plus" size={16} color={C.primaryPurple} />
									</View>
									<Text style={[s.pickerItemText, { color: C.primaryPurple }]}>Manage Children</Text>
								</View>
							</TouchableOpacity>
						</ScrollView>
					</View>
				</TouchableOpacity>
			</Modal>

			{/* ── Page content ── */}
			<View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16, backgroundColor: C.screen }}>
				{page === "dashboard" && (
					<DashboardScreen
						child={activeChild}
						foodLog={childLog}
						bottleLog={activeChild ? bottleLog.filter((b) => b.childId === activeChild.id) : bottleLog}
						onNavigate={setPage}
						onNavigateFiltered={(pg, filter, openKey) => {
							setLogFilter(filter);
							setLogOpenKey(openKey || null);
							setPage(pg);
						}}
						refreshing={refreshing}
						onRefresh={onRefresh}
					/>
				)}
				{page === "log" && (
					<LogScreen
						foodLog={childLog}
						childName={activeChild?.name || null}
						initialFilter={logFilter}
						initialOpenKey={logOpenKey}
						userMap={userMap}
						currentUserId={user.uid}
						onEdit={setEditEntry}
						onDelete={deleteFood}
						onToggleFavourite={toggleFav}
						onAddAttempt={handleAddAttempt}
						refreshing={refreshing}
						onRefresh={onRefresh}
					/>
				)}
				{page === "add" && (
					<KeyboardAvoidingView
						behavior={Platform.OS === "ios" ? "padding" : "height"}
						style={{ flex: 1 }}>
						<ScrollView
							showsVerticalScrollIndicator={false}
							contentContainerStyle={{ paddingBottom: 40 }}>
							<Text style={[s.pageTitle, { marginBottom: 20 }]}>Log Food or Drink</Text>
							<View style={s.card}>
								<FoodForm
									onSubmit={(form, err) => {
										addFood(form, err);
										if (!err) setPrefillFood(null);
									}}
									isPro={isPro}
									initial={prefillFood || {}}
									existingFoods={Object.values(groupByFood(childLog))}
								/>
							</View>
						</ScrollView>
					</KeyboardAvoidingView>
				)}
				{page === "recipes" && (
					<RecipesScreen
						isPro={isPro}
						recipes={recipes}
						favouriteRecipeIds={favouriteRecipeIds}
						onUpgradePro={handleUpgradePro}
						onToggleFav={handleToggleRecipeFav}
						onLogRecipe={handleLogRecipe}
						user={user}
					/>
				)}
				{page === "bottle" && (
					<BottleScreen
						bottleLog={activeChild ? bottleLog.filter((b) => b.childId === activeChild.id) : bottleLog}
						childName={activeChild?.name || null}
						onAdd={addBottle}
						onEdit={editBottle}
						onDelete={deleteBottle}
					/>
				)}
				{page === "more" && (
					<MoreScreen
						user={user}
						isPro={isPro}
						ownedChildren={children}
						defaultChildId={activeChild?.id || null}
						onLogout={handleLogout}
						onDeleteAccount={handleDeleteAccount}
						onUpgradePro={handleUpgradePro}
						onRestorePurchases={handleRestorePurchases}
						onManageSharing={handleManageSharing}
					/>
				)}
				{page === "children" && (
					<ChildrenScreen
						children={children}
						activeChildId={activeChild?.id}
						onSetActive={setActiveChildId}
						onAdd={addChild}
						onEdit={editChild}
						onDelete={deleteChild}
					/>
				)}
			</View>

			{/* ── Bottom Nav ── */}
			<View style={[s.bottomNav, { paddingBottom: insets.bottom > 0 ? insets.bottom : 10 }]}>
				{nav.map((n) => {
					const active =
						page === n.id ||
						(n.id === "more" && page === "settings") ||
						(n.id === "more" && page === "children");
					return (
						<TouchableOpacity key={n.id} onPress={() => setPage(n.id)} style={s.navItem} activeOpacity={0.8}>
							<View
								style={{
									width: 28,
									height: 28,
									borderRadius: 10,
									backgroundColor: active ? C.primaryPurple + "18" : "transparent",
									alignItems: "center",
									justifyContent: "center",
								}}>
								<Icon name={n.icon} size={20} color={active ? C.primaryPurple : C.mutedText} />
							</View>
							<Text style={[s.navLabel, active && { color: C.primaryPurple, fontWeight: "700" }]}>
								{n.label}
							</Text>
						</TouchableOpacity>
					);
				})}
			</View>

			{/* ── Floating Add Button ── */}
			{page !== "add" && (
				<TouchableOpacity
					onPress={() => setShowAddMenu(true)}
					activeOpacity={0.85}
					style={{
						position: "absolute",
						bottom: (insets.bottom > 0 ? insets.bottom : 10) + 64,
						right: 20,
						width: 58,
						height: 58,
						borderRadius: 29,
						backgroundColor: C.primaryPurple,
						alignItems: "center",
						justifyContent: "center",
						shadowColor: C.primaryPurple,
						shadowOpacity: 0.55,
						shadowRadius: 14,
						shadowOffset: { width: 0, height: 6 },
						elevation: 12,
					}}>
					<Icon name="plus" size={26} color="#ffffff" />
				</TouchableOpacity>
			)}

			{/* ── Add Menu Sheet ── */}
			<Modal
				visible={showAddMenu}
				transparent
				animationType="slide"
				onRequestClose={() => setShowAddMenu(false)}>
				<TouchableOpacity
					style={{ flex: 1, backgroundColor: "rgba(90,45,122,0.35)", justifyContent: "flex-end" }}
					onPress={() => setShowAddMenu(false)}
					activeOpacity={1}>
					<View
						style={{ backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: (insets.bottom > 0 ? insets.bottom : 16) + 8 }}
						onStartShouldSetResponder={() => true}>
						<Text style={{ fontWeight: "800", fontSize: 18, color: C.primaryPinkDark, marginBottom: 20 }}>
							What would you like to log?
						</Text>
						<TouchableOpacity
							onPress={() => { setShowAddMenu(false); setPage("add"); }}
							activeOpacity={0.85}
							style={{ flexDirection: "row", alignItems: "center", gap: 16, backgroundColor: C.bgPurple, borderRadius: 18, padding: 18, marginBottom: 12 }}>
							<View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: C.primaryPurple, alignItems: "center", justifyContent: "center" }}>
								<Icon name="utensils" size={22} color="#ffffff" />
							</View>
							<View>
								<Text style={{ fontWeight: "700", fontSize: 16, color: C.primaryPinkDark }}>Food or Drink</Text>
								<Text style={{ fontSize: 13, color: C.mutedText, marginTop: 2 }}>Log a meal, snack or liquid</Text>
							</View>
							<Icon name="chevRight" size={16} color={C.mutedText} style={{ marginLeft: "auto" }} />
						</TouchableOpacity>
						<TouchableOpacity
							onPress={() => { setShowAddMenu(false); setPage("bottle"); }}
							activeOpacity={0.85}
							style={{ flexDirection: "row", alignItems: "center", gap: 16, backgroundColor: "#d4e8f5", borderRadius: 18, padding: 18 }}>
							<View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: "#2a5f8f", alignItems: "center", justifyContent: "center" }}>
								<Icon name="bottle" size={22} color="#ffffff" />
							</View>
							<View>
								<Text style={{ fontWeight: "700", fontSize: 16, color: "#1a3f5f" }}>Bottle Feed</Text>
								<Text style={{ fontSize: 13, color: "#2a5f8f99", marginTop: 2 }}>Log formula, breast or specialised milk</Text>
							</View>
							<Icon name="chevRight" size={16} color="#2a5f8f" style={{ marginLeft: "auto" }} />
						</TouchableOpacity>
					</View>
				</TouchableOpacity>
			</Modal>

			<EditModal
				visible={!!editEntry}
				entry={editEntry}
				onSubmit={editFood}
				onClose={() => setEditEntry(null)}
				isPro={isPro}
			/>

			<LogRecipeModal
				visible={showLogRecipeModal}
				recipe={logRecipeTarget}
				childName={activeChild?.name}
				onConfirm={handleLogRecipeConfirm}
				onClose={() => {
					setShowLogRecipeModal(false);
					setLogRecipeTarget(null);
				}}
			/>

			{/* Toasts */}
			<View style={s.toastContainer} pointerEvents="none">
				{toasts.map((t) => (
					<View
						key={t.id}
						style={[
							s.toast,
							{
								backgroundColor: t.type === "warning" ? C.bgWarning : C.statGreenBg,
								borderWidth: 1.5,
								borderColor: t.type === "warning" ? C.warningStroke : C.primaryGreenLight,
							},
						]}>
						<Text
							style={{
								color: t.type === "warning" ? C.warningStroke : C.statGreenText,
								fontWeight: "700",
								fontSize: 13,
							}}>
							{t.msg}
						</Text>
					</View>
				))}
			</View>
		</SafeAreaView>
	);
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
function Root() {
	const { user, loading, isPro } = useAuth();
	if (loading) return <LoadingScreen />;
	if (!user) return <AuthScreen />;
	return <MainApp user={user} isPro={isPro} />;
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
	const [theme, setThemeState] = useState("default");
	const C = THEMES[theme] || THEMES.default;

	useEffect(() => {
		import("@react-native-async-storage/async-storage").then(({ default: AsyncStorage }) => {
			AsyncStorage.getItem("appTheme").then((saved) => {
				if (saved && THEMES[saved]) setThemeState(saved);
			});
		});
	}, []);

	const setTheme = (t) => {
		setThemeState(t);
		import("@react-native-async-storage/async-storage").then(({ default: AsyncStorage }) => {
			AsyncStorage.setItem("appTheme", t);
		});
	};

	return (
		<ThemeContext.Provider value={{ theme, C, setTheme }}>
			<SafeAreaProvider>
				<Root />
			</SafeAreaProvider>
		</ThemeContext.Provider>
	);
}
