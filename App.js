import React, { useState, useEffect, useMemo, useCallback } from "react";
import { collection, onSnapshot, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { db as firestoreDb } from "./firebase";
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
	Linking,
	AppState,
} from "react-native";
import * as Updates from "expo-updates";
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
	fetchWeightLog,
	addWeightEntry as fbAddWeightEntry,
	updateWeightEntry as fbUpdateWeightEntry,
	deleteWeightEntry as fbDeleteWeightEntry,
} from "./firebaseHooks";
import AuthScreen from "./AuthScreen";
import Purchases, { LOG_LEVEL } from "react-native-purchases";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ThemeContext, useTheme, useStyles } from "./src/ThemeContext";
import { THEMES } from "./src/constants";
import {
	normalize,
	groupByFood,
	applyWeeklyFeaturedRotation,
	computeMilestones,
	uploadChildPhoto,
	isLocalUri,
} from "./src/helpers";

import { LoadingScreen } from "./src/screens/LoadingScreen";
import { DashboardScreen } from "./src/screens/DashboardScreen";
import { LogScreen } from "./src/screens/LogScreen";
import { MoreScreen } from "./src/screens/MoreScreen";
import { AllergenScreen } from "./src/screens/AllergenScreen";
import { ChildrenScreen } from "./src/screens/ChildrenScreen";
import { BottleScreen } from "./src/screens/BottleScreen";
import { ChildDetailScreen } from "./src/screens/ChildDetailScreen";
import { MealsHubScreen } from "./src/screens/MealsHubScreen";
import { OnboardingScreen } from "./src/screens/OnboardingScreen";
import { setupNotifications, onNotificationTapped, clearBadge, scheduleBottleReminders, cancelBottleReminders } from "./src/notificationService";
import { Icon } from "./src/components/Icon";
import { FoodForm } from "./src/components/FoodForm";
import { EditModal } from "./src/components/EditModal";
import { LogRecipeModal } from "./src/components/LogRecipeModal";
import { WeightModal } from "./src/components/WeightModal";

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Sub-components ────────────────────────────────────────────────────────────

function ChildPickerModal({
	visible,
	children,
	activeChildId,
	onSelect,
	onClose,
	onManage,
	toast,
}) {
	const { C } = useTheme();
	const s = useStyles();
	return (
		<Modal
			visible={visible}
			transparent
			animationType="slide"
			onRequestClose={onClose}>
			<TouchableOpacity
				style={s.pickerOverlay}
				onPress={onClose}
				activeOpacity={1}>
				<View
					style={[s.pickerSheet, { maxHeight: "70%" }]}
					onStartShouldSetResponder={() => true}>
					<Text style={s.pickerTitle}>Select Child</Text>
					<Text
						style={{
							fontSize: 11,
							color: C.mutedText,
							textAlign: "center",
							marginTop: -8,
							marginBottom: 10,
						}}>
						Tap ★ to set a default child
					</Text>
					<ScrollView>
						{children.map((c) => (
							<TouchableOpacity
								key={c.id}
								onPress={() => {
									onSelect(c.id);
									onClose();
								}}
								style={[
									s.pickerItem,
									c.id === activeChildId && { backgroundColor: C.bgPurple },
								]}>
								<View
									style={{
										flexDirection: "row",
										alignItems: "center",
										gap: 12,
										flex: 1,
									}}>
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
											c.id === activeChildId && {
												color: C.primaryPurple,
												fontWeight: "700",
											},
										]}>
										{c.name}
									</Text>
								</View>
								<View
									style={{
										flexDirection: "row",
										alignItems: "center",
										gap: 8,
									}}>
									<TouchableOpacity
										hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
										onPress={(e) => {
											e.stopPropagation();
											onSelect(c.id);
											onClose();
											toast(`${c.name} set as default`);
										}}>
										<Text
											style={{
												fontSize: 18,
												color:
													c.id === activeChildId ? "#d4a017" : C.borderLight,
											}}>
											★
										</Text>
									</TouchableOpacity>
									{c.id === activeChildId && (
										<Icon name="check" size={16} color={C.primaryPurple} />
									)}
								</View>
							</TouchableOpacity>
						))}
						<TouchableOpacity
							onPress={() => {
								onClose();
								onManage();
							}}
							style={[
								s.pickerItem,
								{
									borderWidth: 1.5,
									borderColor: C.borderLight,
									borderRadius: 14,
									marginTop: 8,
								},
							]}>
							<View
								style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
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
								<Text style={[s.pickerItemText, { color: C.primaryPurple }]}>
									Manage Children
								</Text>
							</View>
						</TouchableOpacity>
					</ScrollView>
				</View>
			</TouchableOpacity>
		</Modal>
	);
}

function AddMenuSheet({ visible, onClose, onFood, onBottle, onWeight, insets }) {
	const { C } = useTheme();
	const pb = (insets.bottom > 0 ? insets.bottom : 16) + 8;
	return (
		<Modal
			visible={visible}
			transparent
			animationType="slide"
			onRequestClose={onClose}>
			<TouchableOpacity
				style={{
					flex: 1,
					backgroundColor: "rgba(90,45,122,0.35)",
					justifyContent: "flex-end",
				}}
				onPress={onClose}
				activeOpacity={1}>
				<View
					style={{
						backgroundColor: C.white,
						borderTopLeftRadius: 28,
						borderTopRightRadius: 28,
						padding: 24,
						paddingBottom: pb,
					}}
					onStartShouldSetResponder={() => true}>
					<Text
						style={{
							fontWeight: "800",
							fontSize: 18,
							color: C.primaryPinkDark,
							marginBottom: 20,
						}}>
						What would you like to log?
					</Text>
					<TouchableOpacity
						onPress={onFood}
						activeOpacity={0.85}
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: 16,
							backgroundColor: C.bgPurple,
							borderRadius: 18,
							padding: 18,
							marginBottom: 12,
						}}>
						<View
							style={{
								width: 48,
								height: 48,
								borderRadius: 14,
								backgroundColor: C.primaryPurple,
								alignItems: "center",
								justifyContent: "center",
							}}>
							<Icon name="utensils" size={22} color="#fff" />
						</View>
						<View style={{ flex: 1 }}>
							<Text
								style={{
									fontWeight: "700",
									fontSize: 16,
									color: C.primaryPinkDark,
								}}>
								Food or Drink
							</Text>
							<Text style={{ fontSize: 13, color: C.mutedText, marginTop: 2 }}>
								Log a meal, snack or liquid
							</Text>
						</View>
						<Icon name="chevRight" size={16} color={C.mutedText} />
					</TouchableOpacity>
					<TouchableOpacity
						onPress={onBottle}
						activeOpacity={0.85}
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: 16,
							backgroundColor: "#d4e8f5",
							borderRadius: 18,
							padding: 18,
							marginBottom: 12,
						}}>
						<View
							style={{
								width: 48,
								height: 48,
								borderRadius: 14,
								backgroundColor: "#2a5f8f",
								alignItems: "center",
								justifyContent: "center",
							}}>
							<Icon name="bottle" size={22} color="#fff" />
						</View>
						<View style={{ flex: 1 }}>
							<Text
								style={{ fontWeight: "700", fontSize: 16, color: "#1a3f5f" }}>
								Bottle Feed
							</Text>
							<Text style={{ fontSize: 13, color: "#2a5f8f99", marginTop: 2 }}>
								Log formula, breast or specialised milk
							</Text>
						</View>
						<Icon name="chevRight" size={16} color="#2a5f8f" />
					</TouchableOpacity>
					<TouchableOpacity
						onPress={onWeight}
						activeOpacity={0.85}
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: 16,
							backgroundColor: "#e6f7ef",
							borderRadius: 18,
							padding: 18,
							marginTop: 12,
						}}>
						<View
							style={{
								width: 48,
								height: 48,
								borderRadius: 14,
								backgroundColor: "#2d7a55",
								alignItems: "center",
								justifyContent: "center",
							}}>
							<Icon name="scale" size={22} color="#fff" />
						</View>
						<View style={{ flex: 1 }}>
							<Text style={{ fontWeight: "700", fontSize: 16, color: "#1a4d35" }}>
								Weight
							</Text>
							<Text style={{ fontSize: 13, color: "#2d7a5599", marginTop: 2 }}>
								Record your baby's current weight
							</Text>
						</View>
						<Icon name="chevRight" size={16} color="#2d7a55" />
					</TouchableOpacity>
				</View>
			</TouchableOpacity>
		</Modal>
	);
}

function MilestoneModal({ milestones, onClose }) {
	const { C } = useTheme();
	const isAllergenCelebration = (milestones || []).some((m) => m.isAllergen);
	const headerEmoji =
		isAllergenCelebration && milestones?.length === 1 && milestones[0].allergenEmoji
			? milestones[0].allergenEmoji
			: "🎉";
	const headerBg = isAllergenCelebration && milestones?.length === 1
		? milestones[0].bg
		: C.bgPurple;
	const title = isAllergenCelebration ? "New Allergen Introduced!" : "Milestone Unlocked!";
	const subtitle = isAllergenCelebration
		? "Amazing work introducing a new allergen safely!"
		: "You're doing amazing — keep exploring new foods!";

	return (
		<Modal
			visible={!!milestones}
			transparent
			animationType="fade"
			onRequestClose={onClose}>
			<View
				style={{
					flex: 1,
					backgroundColor: "rgba(90,45,122,0.5)",
					justifyContent: "center",
					alignItems: "center",
					padding: 32,
				}}>
				<View
					style={{
						backgroundColor: C.white,
						borderRadius: 28,
						padding: 28,
						width: "100%",
						alignItems: "center",
						shadowColor: "#5a2d7a",
						shadowOpacity: 0.25,
						shadowRadius: 24,
						elevation: 12,
					}}>
					<View
						style={{
							width: 72,
							height: 72,
							borderRadius: 36,
							backgroundColor: headerBg,
							alignItems: "center",
							justifyContent: "center",
							marginBottom: 16,
						}}>
						<Text style={{ fontSize: 36 }}>{headerEmoji}</Text>
					</View>
					<Text
						style={{
							fontSize: 20,
							fontWeight: "900",
							color: C.primaryPinkDark,
							marginBottom: 6,
							textAlign: "center",
						}}>
						{title}
					</Text>
					<Text
						style={{
							fontSize: 13,
							color: C.mutedText,
							marginBottom: 20,
							textAlign: "center",
						}}>
						{subtitle}
					</Text>
					<View style={{ width: "100%", gap: 10, marginBottom: 24 }}>
						{(milestones || []).map((m) => (
							<View
								key={m.type}
								style={{
									flexDirection: "row",
									alignItems: "center",
									gap: 12,
									backgroundColor: m.bg,
									borderRadius: 16,
									padding: 14,
								}}>
								<View
									style={{
										width: 40,
										height: 40,
										borderRadius: 20,
										backgroundColor: `${m.color}22`,
										alignItems: "center",
										justifyContent: "center",
									}}>
									{m.isAllergen && m.allergenEmoji ? (
										<Text style={{ fontSize: 20 }}>{m.allergenEmoji}</Text>
									) : (
										<Icon name={m.icon} size={20} color={m.color} />
									)}
								</View>
								<Text
									style={{
										fontWeight: "800",
										fontSize: 15,
										color: m.color,
										flex: 1,
									}}>
									{m.label}
								</Text>
							</View>
						))}
					</View>
					<TouchableOpacity
						onPress={onClose}
						style={{
							backgroundColor: C.primaryPurple,
							borderRadius: 16,
							paddingVertical: 14,
							paddingHorizontal: 40,
							alignSelf: "stretch",
							alignItems: "center",
						}}
						activeOpacity={0.85}>
						<Text style={{ color: C.white, fontWeight: "800", fontSize: 15 }}>
							Woohoo! 🌟
						</Text>
					</TouchableOpacity>
				</View>
			</View>
		</Modal>
	);
}

// ── Main App ──────────────────────────────────────────────────────────────────

const NAV = [
	{ id: "dashboard", icon: "home",    label: "Home"     },
	{ id: "log",       icon: "list",    label: "Foods"    },
	{ id: "bottle",    icon: "bottle",  label: "Bottles"  },
	{ id: "meals",     icon: "chef",    label: "Meals"    },
	{ id: "allergens", icon: "shield",  label: "Allergens"},
];

const PAGE_TITLES = {
	dashboard: "Dashboard",
	log:       "Food Log",
	add:       "Log Food",
	bottle:    "Bottle Log",
	meals:     "Meals",
	allergens: "Allergens",
	children:  "Children",
};

function MainApp({ user, userDoc, isPro: isPropPro }) {
	const { C, theme } = useTheme();
	const s = useStyles();
	const insets = useSafeAreaInsets();
	const [isPro, setIsPro] = useState(isPropPro);
	const [showMilkOnDashboard, setShowMilkOnDashboard] = useState(true);
	const [showAllergenOnDashboard, setShowAllergenOnDashboard] = useState(true);

	useEffect(() => {
		if (isPropPro) setIsPro(true);
	}, [isPropPro]);

	useEffect(() => {
		if (!user) return;
		let alive = true;
		Promise.all([
			AsyncStorage.getItem(`showMilkDash_${user.uid}`),
			AsyncStorage.getItem(`showAllergenDash_${user.uid}`),
			AsyncStorage.getItem(`weightUnit_${user.uid}`),
			AsyncStorage.getItem(`bottleRemindersEnabled_${user.uid}`),
			AsyncStorage.getItem(`bottleReminderTimes_${user.uid}`),
		])
			.then(([savedMilkDash, savedAllergenDash, savedWeightUnit, savedBottleRemindersEnabled, savedBottleReminderTimes]) => {
				if (!alive) return;
				if (savedMilkDash === "false") setShowMilkOnDashboard(false);
				if (savedAllergenDash === "false") setShowAllergenOnDashboard(false);
				if (savedWeightUnit === "kg" || savedWeightUnit === "lbs") {
					setWeightPreference(savedWeightUnit);
				}
				if (savedBottleRemindersEnabled === "true") setBottleRemindersEnabled(true);
				if (savedBottleReminderTimes) {
					try { setBottleReminderTimes(JSON.parse(savedBottleReminderTimes)); } catch { /* silent */ }
				}
			})
			.catch(() => {});
		return () => {
			alive = false;
		};
	}, [user]);

	const [page, setPage] = useState("dashboard");
	const [mealsResetKey, setMealsResetKey] = useState(0);
	const [jumpToRecipeId, setJumpToRecipeId] = useState(null);
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
	const [logAllergenFilter, setLogAllergenFilter] = useState("");
	const [prefillFood, setPrefillFood] = useState(null);
	const [refreshing, setRefreshing] = useState(false);
	const [userMap, setUserMap] = useState({});
	const [showAddMenu, setShowAddMenu] = useState(false);
	const [showMoreModal, setShowMoreModal] = useState(false);
	const [bottleQuickAdd, setBottleQuickAdd] = useState(false);
	const [milestoneAlert, setMilestoneAlert] = useState(null);
	const [recipes, setRecipes] = useState([]);
	const [favouriteRecipeIds, setFavouriteRecipeIds] = useState([]);
	const [bottleLog, setBottleLog] = useState([]);
	const [weightLog, setWeightLog] = useState([]);
	const [childDetailFrom, setChildDetailFrom] = useState("dashboard");
	const [weightPreference, setWeightPreference] = useState("lbs");
	const [bottleRemindersEnabled, setBottleRemindersEnabled] = useState(false);
	const [bottleReminderTimes, setBottleReminderTimes] = useState([]);
	const [showWeightModal, setShowWeightModal] = useState(false);
	const [smartRecipes, setSmartRecipes] = useState([]);

	const STORAGE_KEY = `defaultChildId_${user?.uid}`;
	const saveDefaultChild = (id) =>
		AsyncStorage.setItem(STORAGE_KEY, id).catch(() => {});

	useEffect(() => {
		if (!user) return;
		Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
		Purchases.configure({
			apiKey:
				Platform.OS === "ios"
					? "appl_xNGjmEgufsXuWySnKebRetuKCGj"
					: "goog_rcHUTFIPkKdXdEAQHcexulBdpOj",
			appUserID: user.uid,
		});
	}, [user]);

	// ── Push notifications ──────────────────────────────────────────────────────
	useEffect(() => {
		if (!user) return;

		// Register device and save token to Firestore
		setupNotifications(user.uid);

		// Clear badge whenever the app is opened
		clearBadge().catch(() => {});

		// Handle notification tap
		const unsub = onNotificationTapped((response) => {
			const data = response?.notification?.request?.content?.data ?? {};
			// Open a URL if one is included in the notification data (e.g. App Store offer code redemption link)
			if (data.url) {
				Linking.openURL(data.url).catch(() => {});
			}
			// e.g. if (data.screen) setPage(data.screen);
		});

		return unsub;
	}, [user?.uid]);

	const loadData = useCallback(async () => {
		const [log, kids, recs, favIds, bottles, weights, savedId] = await Promise.all([
			fetchFoodLog(user.uid),
			fetchChildren(user.uid),
			fetchRecipes(),
			fetchFavouriteRecipes(user.uid),
			fetchBottleLog(user.uid),
			fetchWeightLog(user.uid).catch(() => []),
			AsyncStorage.getItem(STORAGE_KEY).catch(() => null),
		]);
		setFoodLog(log);
		setChildren(kids);
		setRecipes(applyWeeklyFeaturedRotation(recs));
		setFavouriteRecipeIds(favIds);
		setBottleLog(bottles);
		setWeightLog(weights);
		if (kids.length > 0) {
			const preferred = savedId && kids.find((k) => k.id === savedId);
			setActiveChildId(preferred ? savedId : kids[0].id);
		}
		setUserMap(buildUserMap(user.uid, user.email, kids));
	}, [user, STORAGE_KEY]);

	useEffect(() => {
		if (!user) return;
		let alive = true;
		loadData()
			.then(() => {
				if (alive) setDataLoaded(true);
			})
			.catch((e) => {
				console.error("Error loading data:", e);
				if (alive) setDataLoaded(true);
			});
		return () => {
			alive = false;
		};
	}, [user]);

	// ── Smart Recipes listener ────────────────────────────────────────────────
	// No orderBy — sorts client-side to avoid needing a Firestore composite index.
	useEffect(() => {
		if (!user?.uid) return;
		const unsub = onSnapshot(
			collection(firestoreDb, "users", user.uid, "smartRecipes"),
			(snap) => {
				const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
				// Sort newest-first client-side
				docs.sort((a, b) => {
					const aMs = a.savedAt?.toMillis?.() ?? 0;
					const bMs = b.savedAt?.toMillis?.() ?? 0;
					return bMs - aMs;
				});
				setSmartRecipes(docs);
			},
			(err) => console.warn("[smartRecipes] listener error:", err.message),
		);
		return () => unsub();
	}, [user?.uid]);

	const handleDeleteSmartRecipe = async (id) => {
		try {
			await deleteDoc(doc(firestoreDb, "users", user.uid, "smartRecipes", id));
		} catch (e) {
			console.warn("[smartRecipes] delete error:", e.message);
		}
	};

	const handleRateSmartRecipe = async (id, rating) => {
		try {
			await updateDoc(doc(firestoreDb, "users", user.uid, "smartRecipes", id), { rating });
		} catch (e) {
			console.warn("[smartRecipes] rate error:", e.message);
		}
	};

	// Reset log filters whenever the user navigates away from the log screen
	useEffect(() => {
		if (page !== "log") {
			setLogFilter("");
			setLogOpenKey(null);
			setLogAllergenFilter("");
		}
	}, [page]);

	const activeChild = useMemo(
		() => children.find((c) => c.id === activeChildId) || children[0] || null,
		[children, activeChildId],
	);
	const childLog = useMemo(
		() => (activeChild ? foodLog.filter((f) => f.childId === activeChild.id) : foodLog),
		[activeChild, foodLog],
	);
	const childBottleLog = useMemo(
		() => (activeChild ? bottleLog.filter((b) => b.childId === activeChild.id) : bottleLog),
		[activeChild, bottleLog],
	);
	const childWeightLog = useMemo(
		() => weightLog.filter((w) => w.childId === activeChild?.id),
		[weightLog, activeChild],
	);

	const toast = useCallback((msg, type = "success") => {
		const id = Date.now();
		setToasts((p) => [...p, { id, msg, type }]);
		setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3000);
	}, []);

	const onRefresh = useCallback(async () => {
		setRefreshing(true);
		try {
			await loadData();
			toast("Updated");
		} catch (e) {
			console.error("Refresh failed:", e);
		}
		setRefreshing(false);
	}, [loadData, toast]);

	// ── Food log ──

	const handleAddAttempt = (group) => {
		// Use the most recent attempt to pre-populate so the form reflects
		// the latest texture, feed type and allergens logged for this food
		const latest = group.attempts?.[group.attempts.length - 1] || {};
		setPrefillFood({
			name: group.name,
			category: group.category,
			categories: latest.categories || (group.category ? [group.category] : []),
			form: latest.form || "",
			feedType: latest.feedType || "",
			allergens: latest.allergens || [],
		});
		setPage("add");
	};

	const handleAllergenCheckIn = async (allergenValue, result) => {
		if (!activeChild) return;
		const isSafe = result === "safe";

		if (isSafe) {
			// Find the most recent original entry for this allergen (not itself a check-in)
			// and update it in-place rather than adding a new log entry.
			const original = [...childLog]
				.filter(
					(e) =>
						Array.isArray(e.allergens) &&
						e.allergens.includes(allergenValue) &&
						!e.isAllergenCheckin,
				)
				.sort((a, b) => {
					const da = `${a.date || ""}T${a.time || "00:00"}`;
					const db = `${b.date || ""}T${b.time || "00:00"}`;
					return db.localeCompare(da);
				})[0];

			if (!original) {
				// Fallback — shouldn't normally happen, but create a new entry if nothing found
				Alert.alert(
					"Error",
					"Could not find the original log entry to update.",
				);
				return;
			}

			const updates = {
				reaction: "Good",
				isAllergenCheckin: true,
				notes: original.notes
					? `${original.notes}\n✅ No delayed reaction confirmed after 48+ hours`
					: `✅ No delayed reaction to ${allergenValue} after 48+ hours`,
			};

			try {
				await updateFoodEntry(original.id, updates);
				setFoodLog((p) =>
					p.map((e) => (e.id === original.id ? { ...e, ...updates } : e)),
				);
				toast(`✅ ${allergenValue} — no delayed reaction, safely introduced`);
			} catch {
				Alert.alert(
					"Error",
					"Could not update check-in result. Please try again.",
				);
			}
		} else {
			// Reaction observed — add a new entry so it's clearly recorded
			const today = new Date().toISOString().split("T")[0];
			const now = new Date();
			const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
			const entry = {
				childId: activeChild.id,
				name: `${allergenValue} – reaction observed`,
				category: "",
				categories: [],
				allergens: [allergenValue],
				reaction: "Allergic",
				isAllergenCheckin: true,
				date: today,
				time,
				form: "",
				ml: "",
				photoUri: "",
				notes: `Delayed reaction to ${allergenValue} — reported at 48-hour check-in`,
			};
			try {
				const newId = await addFoodEntry(user.uid, entry);
				setFoodLog((p) => [...p, { id: newId, ...entry }]);
				toast(`⚠️ Delayed reaction to ${allergenValue} logged`);
			} catch {
				Alert.alert(
					"Error",
					"Could not save check-in result. Please try again.",
				);
			}
		}
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
		const existing = childLog.filter(
			(f) => normalize(f.name) === normalize(form.name),
		);
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
			const newEntry = { id: newId, ...entry };
			setFoodLog((p) => [...p, newEntry]);
			toast(
				existing.length === 0
					? `Added "${form.name}"`
					: `"${form.name}" attempt #${existing.length + 1}`,
			);
			if (existing.length === 0) {
				const ms = computeMilestones([...childLog, newEntry]);
				const triggered = ms[newId] || [];
				if (triggered.length > 0) setMilestoneAlert(triggered);
			}
			setPage("log");
		} catch {
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
			setFoodLog((p) =>
				p.map((f) => (f.id === updated.id ? { ...f, ...updated } : f)),
			);
			setEditEntry(null);
			toast("Entry updated");
		} catch {
			Alert.alert("Error", "Could not update entry.");
		}
	};

	const deleteFood = async (id) => {
		try {
			await deleteFoodEntry(id);
			setFoodLog((p) => p.filter((f) => f.id !== id));
			toast("Entry deleted");
		} catch {
			Alert.alert("Error", "Could not delete entry.");
		}
	};

	const toggleFav = async (id) => {
		const entry = foodLog.find((f) => f.id === id);
		if (!entry) return;
		const newVal = !entry.favourite;
		try {
			await updateFoodEntry(id, { favourite: newVal });
			setFoodLog((p) =>
				p.map((f) => (f.id === id ? { ...f, favourite: newVal } : f)),
			);
		} catch {}
	};

	// ── Bottle log ──

	const addBottle = async (entry) => {
		if (!activeChild) {
			Alert.alert("No child selected", "Please select a child first.");
			return;
		}
		try {
			const newId = await addBottleEntry(user.uid, {
				...entry,
				childId: activeChild.id,
			});
			setBottleLog((p) => [
				...p,
				{ id: newId, ...entry, childId: activeChild.id },
			]);
			toast("Bottle logged");
		} catch {
			Alert.alert("Error", "Could not save bottle entry.");
		}
	};

	const editBottle = async (updated) => {
		try {
			await updateBottleEntry(updated.id, updated);
			setBottleLog((p) =>
				p.map((b) => (b.id === updated.id ? { ...b, ...updated } : b)),
			);
			toast("Updated");
		} catch {
			Alert.alert("Error", "Could not update entry.");
		}
	};

	const deleteBottle = async (id) => {
		try {
			await deleteBottleEntry(id);
			setBottleLog((p) => p.filter((b) => b.id !== id));
			toast("Entry deleted");
		} catch {
			Alert.alert("Error", "Could not delete entry.");
		}
	};

	// ── Children ──

	const addChild = async (child) => {
		try {
			const { initialWeight, initialWeightOz, initialWeightUnit, ...childData } = child;

			// Upload photo to Firebase Storage before saving to Firestore
			if (childData.photoUri && isLocalUri(childData.photoUri)) {
				try {
					const tempName = `${user.uid}_${Date.now()}`;
					childData.photoUri = await uploadChildPhoto(childData.photoUri, user.uid, tempName);
				} catch (uploadErr) {
					console.warn("[addChild] photo upload failed:", uploadErr.message);
					childData.photoUri = ""; // never store a local URI in Firestore
				}
			}

			const newId = await fbAddChild(user.uid, childData);
			const newChild = { id: newId, ...childData };
			setChildren((p) => [...p, newChild]);
			if (!activeChildId) {
				setActiveChildId(newId);
				saveDefaultChild(newId);
			}
			// Save initial weight entry if provided — always store in canonical kg format
			const lbVal = parseFloat(initialWeight) || 0;
			const ozVal = parseFloat(initialWeightOz) || 0;
			const hasWeight = initialWeightUnit === "lbs" ? (lbVal > 0 || ozVal > 0) : lbVal > 0;
			if (hasWeight) {
				const today = new Date().toISOString().split("T")[0];
				const value_kg = Math.round(
					(initialWeightUnit === "lbs" ? (lbVal + ozVal / 16) / 2.20462 : lbVal) * 1000,
				) / 1000;
				const wId = await fbAddWeightEntry(user.uid, {
					childId: newId,
					value_kg,
					date: today,
				});
				setWeightLog((p) => [...p, { id: wId, childId: newId, value_kg, date: today, userId: user.uid }]);
			}
			toast(`${child.name} added`);
		} catch {
			Alert.alert("Error", "Could not add child.");
		}
	};

	const editChild = async (updated) => {
		try {
			let toSave = { ...updated };

			// Upload photo to Firebase Storage before saving to Firestore
			if (toSave.photoUri && isLocalUri(toSave.photoUri)) {
				try {
					toSave.photoUri = await uploadChildPhoto(toSave.photoUri, user.uid, toSave.id);
				} catch (uploadErr) {
					console.warn("[editChild] photo upload failed:", uploadErr.message);
					// Fall back to the existing saved URL (don't store local URI)
					const existing = children.find((c) => c.id === toSave.id);
					toSave.photoUri = isLocalUri(existing?.photoUri) ? "" : (existing?.photoUri || "");
				}
			}

			await fbUpdateChild(toSave.id, toSave);
			setChildren((p) => p.map((c) => (c.id === toSave.id ? toSave : c)));
			toast("Updated");
		} catch {
			Alert.alert("Error", "Could not update child.");
		}
	};

	const deleteChild = async (id) => {
		try {
			await fbDeleteChild(id, user.uid);
		} catch (e) {
			console.warn("deleteChild:", e.message);
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
		setFavouriteRecipeIds((p) =>
			isFav ? p.filter((id) => id !== recipeId) : [...p, recipeId],
		);
		try {
			await toggleRecipeFavourite(user.uid, recipeId, isFav);
		} catch (e) {
			setFavouriteRecipeIds((p) =>
				isFav ? [...p, recipeId] : p.filter((id) => id !== recipeId),
			);
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
		const existing = childLog.filter(
			(f) => normalize(f.name) === normalize(logRecipeTarget.title),
		);
		const entry = {
			childId: activeChild.id,
			date: new Date().toISOString().split("T")[0],
			name: logRecipeTarget.title,
			category:
				categoryMap[logRecipeTarget.category] ||
				logRecipeTarget.category ||
				"Other",
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
		} catch {
			Alert.alert("Error", "Could not add to food log.");
		}
	};

	// ── Weight ──

	const addWeightEntry = async (entry) => {
		try {
			const id = await fbAddWeightEntry(user.uid, entry);
			setWeightLog((p) => [...p, { id, ...entry, userId: user.uid }]);
		} catch {
			Alert.alert("Error", "Could not save weight.");
		}
	};

	const updateWeightEntry = async (id, fields) => {
		try {
			await fbUpdateWeightEntry(id, fields);
			setWeightLog((p) => p.map((w) => (w.id === id ? { ...w, ...fields } : w)));
		} catch {
			Alert.alert("Error", "Could not update weight entry.");
		}
	};

	const deleteWeightEntry = async (id) => {
		try {
			await fbDeleteWeightEntry(id);
			setWeightLog((p) => p.filter((w) => w.id !== id));
		} catch {
			Alert.alert("Error", "Could not delete weight entry.");
		}
	};

	const setWeightPreferenceUnit = (unit) => {
		setWeightPreference(unit);
		AsyncStorage.setItem(`weightUnit_${user.uid}`, unit).catch(() => {});
	};

	// ── No-child guard ──
	// Shows an alert and offers to take the user to the Children screen.
	// Returns true if there are no children (caller should bail out).
	const requireChild = useCallback(() => {
		if (children.length > 0) return false;
		Alert.alert(
			"No child added yet",
			"You need to add a child before you can log anything. Would you like to add one now?",
			[
				{ text: "Not now", style: "cancel" },
				{ text: "Add child", onPress: () => setPage("children") },
			],
		);
		return true;
	}, [children]);

	// ── Bottle reminder notifications ──

	const handleToggleBottleReminders = (enabled) => {
		setBottleRemindersEnabled(enabled);
		AsyncStorage.setItem(`bottleRemindersEnabled_${user.uid}`, String(enabled)).catch(() => {});
		if (enabled && bottleReminderTimes.length > 0) {
			scheduleBottleReminders(bottleReminderTimes, activeChild?.name || "your baby").catch(() => {});
		} else {
			cancelBottleReminders().catch(() => {});
		}
	};

	const handleAddBottleReminderTime = (time) => {
		const newTimes = [...bottleReminderTimes, time].sort(
			(a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute),
		);
		setBottleReminderTimes(newTimes);
		AsyncStorage.setItem(`bottleReminderTimes_${user.uid}`, JSON.stringify(newTimes)).catch(() => {});
		if (bottleRemindersEnabled) {
			scheduleBottleReminders(newTimes, activeChild?.name || "your baby").catch(() => {});
		}
	};

	const handleRemoveBottleReminderTime = (index) => {
		const newTimes = bottleReminderTimes.filter((_, i) => i !== index);
		setBottleReminderTimes(newTimes);
		AsyncStorage.setItem(`bottleReminderTimes_${user.uid}`, JSON.stringify(newTimes)).catch(() => {});
		if (bottleRemindersEnabled) {
			if (newTimes.length > 0) {
				scheduleBottleReminders(newTimes, activeChild?.name || "your baby").catch(() => {});
			} else {
				cancelBottleReminders().catch(() => {});
			}
		}
	};

	// ── Settings ──

	const toggleMilkOnDashboard = async () => {
		const next = !showMilkOnDashboard;
		setShowMilkOnDashboard(next);
		AsyncStorage.setItem(`showMilkDash_${user.uid}`, String(next)).catch(
			() => {},
		);
	};

	const toggleAllergenOnDashboard = async () => {
		const next = !showAllergenOnDashboard;
		setShowAllergenOnDashboard(next);
		AsyncStorage.setItem(`showAllergenDash_${user.uid}`, String(next)).catch(
			() => {},
		);
	};

	const handleLogout = () =>
		Alert.alert("Sign Out", "Are you sure?", [
			{ text: "Cancel" },
			{ text: "Sign Out", style: "destructive", onPress: () => logOut() },
		]);

	const handleDeleteAccount = async () => {
		try {
			await deleteAccount(user.uid);
			// deleteUser triggers onAuthStateChanged automatically — no manual
			// logOut() needed, the app will navigate to the auth screen on its own
		} catch (e) {
			if (e.code === "auth/requires-recent-login") {
				// Firebase requires a fresh sign-in for account deletion.
				// Sign the user out automatically so they land on the auth screen,
				// then they can sign back in and delete from Settings.
				await logOut();
				Alert.alert(
					"Please sign in again",
					"For security, account deletion requires a recent sign-in. You have been signed out — please sign back in and try again.",
				);
			} else {
				Alert.alert("Error", e.message || "Could not delete account. Please try again.");
			}
		}
	};

	const purchaseProPlan = async (planType) => {
		const offerings = await Purchases.getOfferings();
		if (
			!offerings.current ||
			offerings.current.availablePackages.length === 0
		) {
			Alert.alert(
				"Coming Soon",
				"Pro subscriptions are being reviewed by Apple and will be available very soon. Check back shortly!",
			);
			return;
		}
		const packages = offerings.current.availablePackages;
		let pkg;
		if (planType === "monthly")
			pkg = packages.find(
				(p) => p.packageType === Purchases.PACKAGE_TYPE.MONTHLY,
			);
		if (planType === "yearly")
			pkg = packages.find(
				(p) => p.packageType === Purchases.PACKAGE_TYPE.ANNUAL,
			);
		if (planType === "lifetime")
			pkg = packages.find(
				(p) => p.packageType === Purchases.PACKAGE_TYPE.LIFETIME,
			);
		if (!pkg) pkg = packages[0]; // fallback if package type not found
		const { customerInfo } = await Purchases.purchasePackage(pkg);
		if (customerInfo.entitlements.active["pro"]) {
			const { doc, updateDoc } = await import("firebase/firestore");
			const { db: firedb } = await import("./firebase");
			await updateDoc(doc(firedb, "users", user.uid), { plan: "pro" });
			setIsPro(true);
			Alert.alert(
				"Welcome to Pro! 🎉",
				"You now have access to all recipes and premium features.",
			);
		}
	};

	const handleUpgradePro = async (planType) => {
		if (!planType) {
			// No plan specified (e.g. locked feature tap) — show picker first
			Alert.alert(
				"Choose Your Plan",
				"Select the plan that works best for you",
				[
					{
						text: "Monthly — £2.99/mo",
						onPress: () => handleUpgradePro("monthly"),
					},
					{
						text: "Yearly — £19.99/yr",
						onPress: () => handleUpgradePro("yearly"),
					},
					{
						text: "Lifetime — £39.99",
						onPress: () => handleUpgradePro("lifetime"),
					},
					{ text: "Cancel", style: "cancel" },
				],
			);
			return;
		}
		try {
			await purchaseProPlan(planType);
		} catch (e) {
			if (e.userCancelled) return;
			const msg = e.message || "";
			const isUnavailable =
				msg.includes("not available") ||
				msg.includes("cannot be made") ||
				msg.includes("offerings-empty") ||
				msg.includes("why-are-offerings-empty") ||
				msg.includes("configuration") ||
				msg.includes("could not be fetched");
			if (isUnavailable) {
				Alert.alert(
					"Coming Soon",
					"Pro subscriptions are being reviewed by Apple and will be available very soon. Check back shortly!",
				);
			} else {
				Alert.alert("Purchase failed", msg || "Something went wrong. Please try again.");
			}
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
				Alert.alert(
					"Nothing to restore",
					"No previous Pro purchase found on this Apple/Google account.",
				);
			}
		} catch (e) {
			Alert.alert("Error", e.message || "Could not restore purchases.");
		}
	};

	const handleManageSharing = async (
		emailOrUid,
		childId,
		onSuccess,
		isRemove = false,
		role = "caregiver",
	) => {
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
				deleteField,
				collection,
				query,
				where,
				getDocs: fsGetDocs,
			} = await import("firebase/firestore");
			const { db: firedb } = await import("./firebase");

			if (isRemove) {
				const child    = children.find((c) => c.id === childId);
				const uidIndex = (child?.sharedWith || []).indexOf(emailOrUid);
				const matchEmail = uidIndex !== -1 ? (child?.sharedWithEmails || [])[uidIndex] : null;
				const update = {
					sharedWith: arrayRemove(emailOrUid),
					[`sharedWithRoles.${emailOrUid}`]: deleteField(),
				};
				if (matchEmail) update.sharedWithEmails = arrayRemove(matchEmail);
				await updateDoc(doc(firedb, "children", childId), update);
				setChildren((p) =>
					p.map((c) => {
						if (c.id !== childId) return c;
						const newRoles = { ...(c.sharedWithRoles || {}) };
						delete newRoles[emailOrUid];
						return {
							...c,
							sharedWith: (c.sharedWith || []).filter((u) => u !== emailOrUid),
							sharedWithEmails: matchEmail
								? (c.sharedWithEmails || []).filter((e) => e !== matchEmail)
								: c.sharedWithEmails || [],
							sharedWithRoles: newRoles,
						};
					}),
				);
				Alert.alert("Removed", "Access has been removed.");
				return;
			}

			const snap = await fsGetDocs(
				query(
					collection(firedb, "users"),
					where("email", "==", emailOrUid.toLowerCase().trim()),
				),
			);
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
				Alert.alert(
					"Already shared",
					`${emailOrUid} already has access to ${child.name}.`,
				);
				return;
			}
			const theirEmail = emailOrUid.toLowerCase().trim();
			await updateDoc(doc(firedb, "children", childId), {
				sharedWith:       arrayUnion(theirUid),
				sharedWithEmails: arrayUnion(theirEmail),
				[`sharedWithRoles.${theirUid}`]: role,
			});
			setChildren((p) =>
				p.map((c) =>
					c.id !== childId
						? c
						: {
								...c,
								sharedWith:       [...(c.sharedWith || []), theirUid],
								sharedWithEmails: [...(c.sharedWithEmails || []), theirEmail],
								sharedWithRoles:  { ...(c.sharedWithRoles || {}), [theirUid]: role },
							},
				),
			);
			const roleLabel = role === "parent" ? "Parent" : "Caregiver";
			Alert.alert(
				"Shared! ✓",
				`${emailOrUid} has been added as a ${roleLabel} for ${child?.name || "your child"}. They will see the data next time they open the app.`,
			);
			onSuccess?.();
		} catch (e) {
			console.error("Sharing error:", e);
			Alert.alert(
				"Error",
				e.message || "Could not update sharing. Please try again.",
			);
		}
	};

	const handleGenerateInviteCode = async (childId, role = "caregiver") => {
		const { httpsCallable } = await import("firebase/functions");
		const { functions: fns } = await import("./firebase");
		const fn     = httpsCallable(fns, "generateInviteCode");
		const result = await fn({ childId, role });
		return result.data.code;
	};

	const handleJoinViaCode = async (code) => {
		const { httpsCallable } = await import("firebase/functions");
		const { functions: fns } = await import("./firebase");
		const fn     = httpsCallable(fns, "joinViaInviteCode");
		const result = await fn({ code });
		return result.data; // { childName }
	};

	if (!dataLoaded) return <LoadingScreen />;

	const fabBottom = (insets.bottom > 0 ? insets.bottom : 10) + 64;

	return (
		<SafeAreaView
			style={{ flex: 1, backgroundColor: C.screen }}
			edges={["top"]}>
			<StatusBar
				barStyle={theme === "dark" ? "light-content" : "dark-content"}
				backgroundColor={C.navBg}
			/>

			{/* Header */}
			<View style={s.header}>
				<View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
					<Image
						source={require("./assets/logo.png")}
						style={{ width: 36, height: 36, borderRadius: 10 }}
						resizeMode="contain"
					/>
					<View>
						<Text style={s.appName}>Munch Sprouts</Text>
						<Text style={s.pageSubtitle}>
							{PAGE_TITLES[page] || "Dashboard"}
						</Text>
					</View>
				</View>
				<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
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
							<Circle
								cx="16"
								cy="13"
								r="7"
								fill={C.primaryPurple}
								opacity="0.8"
							/>
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
						<Text
							style={{
								fontSize: 13,
								fontWeight: "700",
								color: C.primaryPurple,
							}}
							numberOfLines={1}>
							{activeChild ? activeChild.name : "Add Baby"}
						</Text>
						<Icon name="chevDown" size={12} color={C.primaryPurple} />
					</TouchableOpacity>
					<TouchableOpacity
						onPress={() => setShowMoreModal(true)}
						style={{
							width: 36,
							height: 36,
							borderRadius: 18,
							backgroundColor: C.bgPurple,
							alignItems: "center",
							justifyContent: "center",
						}}
						activeOpacity={0.75}>
						<Icon name="more" size={20} color={C.primaryPurple} />
					</TouchableOpacity>
				</View>
			</View>

			{/* Page content */}
			<View
				style={{
					flex: 1,
					paddingHorizontal: 16,
					paddingTop: 16,
					backgroundColor: C.screen,
				}}>
				{/* ── Main tabs: kept mounted, just shown/hidden — avoids mount/unmount jitter on Android ── */}
				<View style={{ flex: 1, display: page === "dashboard" ? "flex" : "none" }}>
					<DashboardScreen
						child={activeChild}
						foodLog={childLog}
						bottleLog={childBottleLog}
						weightLog={childWeightLog}
						weightPreference={weightPreference}
						showMilkOnDashboard={showMilkOnDashboard}
						showAllergenOnDashboard={showAllergenOnDashboard}
						recipes={recipes}
						onNavigate={(pg) => {
							if (pg === "childDetail") setChildDetailFrom("dashboard");
							setPage(pg);
						}}
						onNavigateToRecipe={(id) => {
							setJumpToRecipeId(id);
							setPage("meals");
						}}
						onNavigateFiltered={(pg, filter, openKey) => {
							setLogFilter(filter);
							setLogOpenKey(openKey || null);
							setLogAllergenFilter("");
							setPage(pg);
						}}
						refreshing={refreshing}
						onRefresh={onRefresh}
						isPro={isPro}
						onUpgradePro={handleUpgradePro}
					/>
				</View>
				<View style={{ flex: 1, display: page === "log" ? "flex" : "none" }}>
					<LogScreen
						foodLog={childLog}
						childName={activeChild?.name || null}
						bottleLog={childBottleLog}
						initialFilter={logFilter}
						initialOpenKey={logOpenKey}
						initialAllergenFilter={logAllergenFilter}
						milestones={computeMilestones(childLog)}
						userMap={userMap}
						currentUserId={user.uid}
						onEdit={setEditEntry}
						onDelete={deleteFood}
						onToggleFavourite={toggleFav}
						onAddAttempt={handleAddAttempt}
						refreshing={refreshing}
						onRefresh={onRefresh}
					/>
				</View>
				{page === "add" && (
					<KeyboardAvoidingView
						behavior={Platform.OS === "ios" ? "padding" : "height"}
						style={{ flex: 1 }}>
						<ScrollView
							showsVerticalScrollIndicator={false}
							contentContainerStyle={{ paddingBottom: 40 }}>
							<Text style={[s.pageTitle, { marginBottom: 20 }]}>
								Log Food or Drink
							</Text>
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
				<View style={{ flex: 1, display: page === "meals" ? "flex" : "none" }}>
					<MealsHubScreen
						isPro={isPro}
						recipes={recipes}
						favouriteRecipeIds={favouriteRecipeIds}
						onUpgradePro={handleUpgradePro}
						onToggleFav={handleToggleRecipeFav}
						onLogRecipe={handleLogRecipe}
						onRestorePurchases={handleRestorePurchases}
						user={user}
						activeChild={activeChild}
						childFoodLog={childLog}
						jumpToRecipeId={jumpToRecipeId}
						onJumpHandled={() => setJumpToRecipeId(null)}
						resetKey={mealsResetKey}
						smartRecipes={smartRecipes}
						onDeleteSmartRecipe={handleDeleteSmartRecipe}
						onRateSmartRecipe={handleRateSmartRecipe}
					/>
				</View>
				<View style={{ flex: 1, display: page === "bottle" ? "flex" : "none" }}>
					<BottleScreen
						bottleLog={childBottleLog}
						childName={activeChild?.name || null}
						onAdd={addBottle}
						onEdit={editBottle}
						onDelete={deleteBottle}
						quickAdd={bottleQuickAdd}
						onQuickAddConsumed={() => setBottleQuickAdd(false)}
						isPro={isPro}
						onUpgradePro={handleUpgradePro}
					/>
				</View>
				<View style={{ flex: 1, display: page === "allergens" ? "flex" : "none" }}>
					<AllergenScreen
						foodLog={childLog}
						onNavigate={setPage}
						onViewInLog={(allergenValue) => {
							setLogFilter("");
							setLogOpenKey(null);
							setLogAllergenFilter(allergenValue);
							setPage("log");
						}}
						onAddWithPrefill={(allergenValue) => {
							setPrefillFood({
								name: "",
								category: "",
								categories: [],
								feedType: "",
								allergens: allergenValue ? [allergenValue] : [],
							});
							setPage("add");
						}}
						onAllergenCheckIn={handleAllergenCheckIn}
					/>
				</View>
				{page === "children" && (
					<ChildrenScreen
						children={children}
						activeChildId={activeChild?.id}
						onSetActive={setActiveChildId}
						onAdd={addChild}
						onEdit={editChild}
						onDelete={deleteChild}
						isPro={isPro}
						onUpgradePro={handleUpgradePro}
					/>
				)}
				{page === "childDetail" && activeChild && (
					<ChildDetailScreen
						child={activeChild}
						weightLog={childWeightLog}
						bottleLog={childBottleLog}
						foodLog={childLog}
						weightPreference={weightPreference}
						isPro={isPro}
						user={user}
						onUpgradePro={handleUpgradePro}
						onBack={() => setPage(childDetailFrom)}
						onEdit={editChild}
						onUpdateWeight={updateWeightEntry}
						onDeleteWeight={deleteWeightEntry}
					/>
				)}
			</View>

			{/* Bottom Nav */}
			<View
				style={[
					s.bottomNav,
					{ paddingBottom: insets.bottom > 0 ? insets.bottom : 10 },
				]}>
				{NAV.map((n) => {
					const active = page === n.id;
					return (
						<TouchableOpacity
							key={n.id}
							onPress={() => {
								if (n.id === "meals" && page === "meals") {
									// Already on Meals — reset hub to top level
									setMealsResetKey((k) => k + 1);
								}
								setPage(n.id);
							}}
							style={s.navItem}
							activeOpacity={0.8}>
							<View
								style={{
									width: 28,
									height: 28,
									borderRadius: 10,
									backgroundColor: active
										? C.primaryPurple + "18"
										: "transparent",
									alignItems: "center",
									justifyContent: "center",
								}}>
								<Icon
									name={n.icon}
									size={20}
									color={active ? C.primaryPurple : C.mutedText}
								/>
							</View>
							<Text
								style={[
									s.navLabel,
									active && { color: C.primaryPurple, fontWeight: "700" },
								]}>
								{n.label}
							</Text>
						</TouchableOpacity>
					);
				})}
			</View>

			{/* Floating Add Button */}
			{page !== "add" && page !== "meals" && (
				<TouchableOpacity
					onPress={() => {
						if (requireChild()) return;
						page === "bottle" ? setBottleQuickAdd(true) : setShowAddMenu(true);
					}}
					activeOpacity={0.85}
					style={{
						position: "absolute",
						bottom: fabBottom,
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
					<Icon name="plus" size={26} color="#fff" />
				</TouchableOpacity>
			)}

			{/* Modals */}
			<ChildPickerModal
				visible={showChildPicker}
				children={children}
				activeChildId={activeChildId}
				onSelect={(id) => {
					setActiveChildId(id);
					saveDefaultChild(id);
				}}
				onClose={() => setShowChildPicker(false)}
				onManage={() => setPage("children")}
				toast={toast}
			/>

			<AddMenuSheet
				visible={showAddMenu}
				onClose={() => setShowAddMenu(false)}
				onFood={() => {
					setShowAddMenu(false);
					if (requireChild()) return;
					setPage("add");
				}}
				onBottle={() => {
					setShowAddMenu(false);
					if (requireChild()) return;
					setBottleQuickAdd(true);
					setPage("bottle");
				}}
				onWeight={() => {
					setShowAddMenu(false);
					if (requireChild()) return;
					setShowWeightModal(true);
				}}
				insets={insets}
			/>

			<Modal
				visible={showMoreModal}
				animationType="slide"
				presentationStyle="pageSheet"
				onRequestClose={() => setShowMoreModal(false)}>
				<SafeAreaView
					style={{ flex: 1, backgroundColor: C.screen }}
					edges={["top"]}>
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							justifyContent: "space-between",
							paddingHorizontal: 20,
							paddingVertical: 14,
							borderBottomWidth: 1,
							borderBottomColor: C.borderLight,
						}}>
						<Text
							style={{
								fontWeight: "800",
								fontSize: 18,
								color: C.primaryPinkDark,
							}}>
							Profile & Settings
						</Text>
						<TouchableOpacity
							onPress={() => setShowMoreModal(false)}
							style={{
								width: 34,
								height: 34,
								borderRadius: 17,
								backgroundColor: C.bgPurple,
								alignItems: "center",
								justifyContent: "center",
							}}
							activeOpacity={0.75}>
							<Icon name="close" size={16} color={C.primaryPurple} />
						</TouchableOpacity>
					</View>
					<MoreScreen
						user={user}
						userDoc={userDoc}
						isPro={isPro}
						ownedChildren={children}
						defaultChildId={activeChild?.id || null}
						showMilkOnDashboard={showMilkOnDashboard}
						onToggleMilkOnDashboard={toggleMilkOnDashboard}
						showAllergenOnDashboard={showAllergenOnDashboard}
						onToggleAllergenOnDashboard={toggleAllergenOnDashboard}
						weightPreference={weightPreference}
						onSetWeightPreference={setWeightPreferenceUnit}
						bottleRemindersEnabled={bottleRemindersEnabled}
						bottleReminderTimes={bottleReminderTimes}
						onToggleBottleReminders={handleToggleBottleReminders}
						onAddBottleReminderTime={handleAddBottleReminderTime}
						onRemoveBottleReminderTime={handleRemoveBottleReminderTime}
						onLogout={() => {
							setShowMoreModal(false);
							handleLogout();
						}}
						onDeleteAccount={handleDeleteAccount}
						onUpgradePro={handleUpgradePro}
						onRestorePurchases={handleRestorePurchases}
						onManageSharing={handleManageSharing}
						onGenerateCode={handleGenerateInviteCode}
						onJoinViaCode={handleJoinViaCode}
						foodLog={childLog}
						bottleLog={childBottleLog}
						weightLog={childWeightLog}
						childName={activeChild?.name ?? null}
					/>
				</SafeAreaView>
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

			<MilestoneModal
				milestones={milestoneAlert}
				onClose={() => setMilestoneAlert(null)}
			/>

			<WeightModal
				visible={showWeightModal}
				activeChild={activeChild}
				defaultUnit={weightPreference}
				onSave={async (entry) => {
					await addWeightEntry(entry);
					toast(`Weight logged for ${activeChild?.name}`);
				}}
				onClose={() => setShowWeightModal(false)}
			/>

			{/* Toasts */}
			<View style={s.toastContainer} pointerEvents="none">
				{toasts.map((t) => (
					<View
						key={t.id}
						style={[
							s.toast,
							{
								backgroundColor:
									t.type === "warning" ? C.bgWarning : C.statGreenBg,
								borderWidth: 1.5,
								borderColor:
									t.type === "warning" ? C.warningStroke : C.primaryGreenLight,
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

// ── Root ──────────────────────────────────────────────────────────────────────

function Root() {
	const { user, userDoc, userDocLoaded, loading, isPro } = useAuth();
	// Wait for Firebase Auth AND the first Firestore snapshot to settle.
	// userDocLoaded becomes true once onSnapshot resolves (even on error),
	// so we never get stuck on LoadingScreen indefinitely.
	if (loading || (user && !userDocLoaded)) return <LoadingScreen />;
	if (!user) return <AuthScreen />;
	// New users haven't completed onboarding yet — show the wizard first.
	// Existing users (onboardingComplete === undefined) skip straight to the app.
	if (userDoc?.onboardingComplete === false) {
		return <OnboardingScreen user={user} />;
	}
	return <MainApp user={user} userDoc={userDoc} isPro={isPro} />;
}

export default function App() {
	const [theme, setThemeState] = useState("default");
	const C = THEMES[theme] || THEMES.default;

	useEffect(() => {
		let alive = true;
		import("@react-native-async-storage/async-storage").then(
			({ default: AS }) =>
				AS.getItem("appTheme").then((saved) => {
					if (alive && saved && THEMES[saved]) setThemeState(saved);
				}),
		);
		return () => {
			alive = false;
		};
	}, []);

	// ── OTA update check ─────────────────────────────────────────────────────────
	useEffect(() => {
		if (__DEV__) return; // expo-updates doesn't run in development

		const checkForUpdate = async () => {
			try {
				const update = await Updates.checkForUpdateAsync();
				if (update.isAvailable) {
					await Updates.fetchUpdateAsync();
					await Updates.reloadAsync();
				}
			} catch {
				// Non-fatal — network unavailable or already on latest
			}
		};

		// Check immediately on launch
		checkForUpdate();

		// Re-check every time the app comes back to the foreground
		const sub = AppState.addEventListener("change", (state) => {
			if (state === "active") checkForUpdate();
		});

		return () => sub.remove();
	}, []);

	const setTheme = (t) => {
		setThemeState(t);
		import("@react-native-async-storage/async-storage").then(
			({ default: AS }) => AS.setItem("appTheme", t),
		);
	};

	return (
		<ThemeContext.Provider value={{ theme, C, setTheme }}>
			<SafeAreaProvider>
				<Root />
			</SafeAreaProvider>
		</ThemeContext.Provider>
	);
}
