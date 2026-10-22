import { AutomaticWhatsNew } from "./src/components/WhatsNewModal";
import { dismissWhatsNew } from "./src/whatsNew";
import { hasAllergenCheckIn } from "./src/allergenCheckIn";
import { localDay } from "./src/activityCalendar";
import { syncLocalReminders, notificationsAllowed } from "./src/reminderSync";
import { ChildPickerModal } from "./src/components/ChildPickerModal";
import { AddMenuSheet } from "./src/components/AddMenuSheet";
import { MilestoneModal } from "./src/components/MilestoneModal";
import { ChildDropdown } from "./src/components/ChildDropdown";
import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { useFonts } from "expo-font";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from "@expo-google-fonts/plus-jakarta-sans";
import {
  NunitoSans_400Regular,
  NunitoSans_600SemiBold,
  NunitoSans_700Bold,
  NunitoSans_800ExtraBold,
} from "@expo-google-fonts/nunito-sans";
import {
  collection,
  onSnapshot,
  doc,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import { db as firestoreDb } from "./src/firebase";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Alert,
  StatusBar,
  Image,
  Linking,
  AppState,
} from "react-native";
import * as Notifications from "expo-notifications";
import * as Updates from "expo-updates";
import {
  SafeAreaView,
  useSafeAreaInsets,
  SafeAreaProvider,
} from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
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
  restoreLogEntry,
  addWeightEntry as fbAddWeightEntry,
  updateWeightEntry as fbUpdateWeightEntry,
  deleteWeightEntry as fbDeleteWeightEntry,
} from "./src/firebaseHooks";
import AuthScreen from "./src/screens/AuthScreen";
import Purchases from "react-native-purchases";
import { useProSubscription } from "./src/useProSubscription";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ThemeContext, useTheme, useStyles } from "./src/ThemeContext";
import { THEMES } from "./src/constants";
import { applyAppAccent } from "./src/appAccent";
import {
  normalize,
  applyWeeklyFeaturedRotation,
  computeMilestones,
  uploadChildPhoto,
  isLocalUri,
} from "./src/helpers";

import { LoadingScreen } from "./src/screens/LoadingScreen";
import {
  dashboardPreferencePatch,
  dashboardSettings,
  DASHBOARD_COLOURS,
} from "./src/dashboardModel";
import { DashboardScreen } from "./src/screens/DashboardScreen";
import { LogScreen } from "./src/screens/LogScreen";
import { MoreScreen } from "./src/screens/MoreScreen";
import { AllergenScreen } from "./src/screens/AllergenScreen";
import { ChildrenScreen } from "./src/screens/ChildrenScreen";
import { BottleScreen } from "./src/screens/BottleScreen";
import { ChildDetailScreen } from "./src/screens/ChildDetailScreen";
import { MealsHubScreen } from "./src/screens/MealsHubScreen";
import { OnboardingCompleteScreen } from "./src/screens/OnboardingCompleteScreen";
import { OnboardingScreen } from "./src/screens/OnboardingScreen";
import {
  setupNotifications,
  onNotificationTapped,
  clearBadge,
  requestBottleReminderPermission,
} from "./src/notificationService";
import { Icon } from "./src/components/Icon";
import { AddFoodModal } from "./src/components/AddFoodModal";
import { EditModal } from "./src/components/EditModal";
import { LogRecipeModal } from "./src/components/LogRecipeModal";
import { foodDraftKey } from "./src/foodDraftStore";
import { UndoBanner } from "./src/components/UndoBanner";
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

// ── Main App ──────────────────────────────────────────────────────────────────

const NAV = [
  { id: "dashboard", icon: "home", label: "Home" },
  { id: "log", icon: "list", label: "Foods" },
  { id: "bottle", icon: "bottle", label: "Bottles" },
  { id: "meals", icon: "chef", label: "Meals" },
  { id: "allergens", icon: "shield", label: "Allergens" },
];

const PAGE_TITLES = {
  dashboard: "Dashboard",
  log: "Food Log",
  add: "Log Food",
  bottle: "Bottle Log",
  meals: "Meals",
  allergens: "Allergens",
  children: "Children",
};

function MainApp(props) {
  const parentTheme = useTheme();
  const colour = props.userDoc?.dashboardPreferences?.heroColour;
  const C = useMemo(
    () =>
      applyAppAccent(parentTheme.C, parentTheme.theme, { heroColour: colour }),
    [parentTheme.C, parentTheme.theme, colour],
  );
  return (
    <ThemeContext.Provider value={{ ...parentTheme, C }}>
      <MainAppContent {...props} />
    </ThemeContext.Provider>
  );
}

function MainAppContent({ user, userDoc }) {
  const appPalette =
    DASHBOARD_COLOURS[
      dashboardSettings(userDoc?.dashboardPreferences).heroColour
    ];
  const { C, theme } = useTheme();
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const { isPro, purchase, restore, getOfferings } = useProSubscription(
    user.uid,
  );
  const [showMilkOnDashboard, setShowMilkOnDashboard] = useState(
    userDoc?.dashboardPreferences?.showMilk ?? true,
  );
  const [showAllergenOnDashboard, setShowAllergenOnDashboard] = useState(
    userDoc?.dashboardPreferences?.showAllergens ?? true,
  );

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
      .then(
        ([
          savedMilkDash,
          savedAllergenDash,
          savedWeightUnit,
          savedBottleRemindersEnabled,
          savedBottleReminderTimes,
        ]) => {
          if (!alive) return;
          setShowMilkOnDashboard(
            userDoc?.dashboardPreferences?.showMilk ??
              savedMilkDash !== "false",
          );
          setShowAllergenOnDashboard(
            userDoc?.dashboardPreferences?.showAllergens ??
              savedAllergenDash !== "false",
          );
          if (savedWeightUnit === "kg" || savedWeightUnit === "lbs") {
            setWeightPreference(savedWeightUnit);
          }
          if (savedBottleRemindersEnabled === "true")
            setBottleRemindersEnabled(true);
          if (savedBottleReminderTimes) {
            try {
              const times = JSON.parse(savedBottleReminderTimes);
              if (Array.isArray(times)) setBottleReminderTimes(times);
            } catch {
              /* silent */
            }
          }
        },
      )
      .catch(() => {})
      .finally(() => {
        if (alive) setPreferencesLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [user]);

  useEffect(() => {
    if (typeof userDoc?.dashboardPreferences?.showMilk === "boolean")
      setShowMilkOnDashboard(userDoc.dashboardPreferences.showMilk);
    if (typeof userDoc?.dashboardPreferences?.showAllergens === "boolean")
      setShowAllergenOnDashboard(userDoc.dashboardPreferences.showAllergens);
  }, [
    userDoc?.dashboardPreferences?.showMilk,
    userDoc?.dashboardPreferences?.showAllergens,
  ]);

  const [page, setPage] = useState("dashboard");
  const [mealsResetKey, setMealsResetKey] = useState(0);
  const [jumpToRecipeId, setJumpToRecipeId] = useState(null);
  const [foodLog, setFoodLog] = useState([]);
  const [children, setChildren] = useState([]);
  const [activeChildId, setActiveChildId] = useState(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  // A failed load may unblock the screen, but must not erase existing reminders.
  const [hasDataSnapshot, setHasDataSnapshot] = useState(false);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [editEntry, setEditEntry] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [undoDelete, setUndoDelete] = useState(null);
  const [showChildPicker, setShowChildPicker] = useState(false);
  const [showLogRecipeModal, setShowLogRecipeModal] = useState(false);
  const [logRecipeTarget, setLogRecipeTarget] = useState(null);
  const [logFilter, setLogFilter] = useState("");
  const [logOpenKey, setLogOpenKey] = useState(null);
  const [logAllergenFilter, setLogAllergenFilter] = useState("");
  const [prefillFood, setPrefillFood] = useState(null);
  const [showFoodModal, setShowFoodModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [userMap, setUserMap] = useState({});
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showMoreModal, setShowMoreModal] = useState(false);
  const [showChildDropdown, setShowChildDropdown] = useState(false);
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
  const saveDefaultChild = (id) => {
    AsyncStorage.setItem(STORAGE_KEY, id).catch(() => {});
    updateDoc(doc(firestoreDb, "users", user.uid), {
      defaultChildId: id,
    }).catch(() => {});
  };

  // ── Push notifications ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    // Register device and save token to Firestore
    if (userDoc?.notificationPreference === "enabled") {
      setupNotifications(user.uid);
    }

    // Clear badge whenever the app is opened
    clearBadge().catch(() => {});
  }, [user?.uid, userDoc?.notificationPreference]);

  const lastNotificationTap = useRef(null);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    const handleTap = (response) => {
      if (!alive || !response) return;
      const request = response.notification?.request;
      const data = request?.content?.data || {};
      if (data.userId && data.userId !== user.uid) return;
      // Cold-start taps may arrive before the child records have loaded.
      if (data.screen === "allergens" && !dataLoaded) return;
      const tapKey = JSON.stringify([
        request?.identifier,
        response.notification?.date,
      ]);
      if (lastNotificationTap.current === tapKey) return;
      lastNotificationTap.current = tapKey;
      if (data.url) Linking.openURL(data.url).catch(() => {});
      if (
        data.screen === "allergens" &&
        children.some((child) => child.id === data.childId)
      ) {
        setActiveChildId(data.childId);
        setPage("allergens");
      } else if (data.screen === "bottle") setPage("bottle");
      Notifications.clearLastNotificationResponseAsync().catch(() => {});
    };
    const unsub = onNotificationTapped(handleTap);
    Notifications.getLastNotificationResponseAsync()
      .then(handleTap)
      .catch(() => {});
    return () => {
      alive = false;
      unsub();
    };
  }, [user?.uid, children, dataLoaded]);

  const loadData = useCallback(async () => {
    const [log, kids, recs, favIds, bottles, weights, savedId] =
      await Promise.all([
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
      const preferredId = userDoc?.defaultChildId || savedId;
      const preferred = preferredId && kids.find((k) => k.id === preferredId);
      setActiveChildId(preferred ? preferred.id : kids[0].id);
    }
    setUserMap(buildUserMap(user.uid, user.email, kids));
    setHasDataSnapshot(true);
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
      await updateDoc(doc(firestoreDb, "users", user.uid, "smartRecipes", id), {
        rating,
      });
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
    () =>
      activeChild
        ? foodLog.filter((f) => f.childId === activeChild.id)
        : foodLog,
    [activeChild, foodLog],
  );
  const childBottleLog = useMemo(
    () =>
      activeChild
        ? bottleLog.filter((b) => b.childId === activeChild.id)
        : bottleLog,
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

  useEffect(() => {
    if (!hasDataSnapshot || !preferencesLoaded) return;
    const reconcile = () =>
      syncLocalReminders({
        userId: user?.uid,
        enabled: notificationsAllowed(
          userDoc?.notificationPreference,
          bottleRemindersEnabled,
        ),
        allergensEnabled: !!userDoc?.allergenRemindersEnabled,
        children,
        foodLog,
        bottleEnabled: bottleRemindersEnabled,
        bottleTimes: bottleReminderTimes,
        childName: activeChild?.name,
      }).catch(() =>
        toast(
          "Could not update reminders. Check notification settings and try again.",
          "error",
        ),
      );
    reconcile();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") reconcile();
    });
    return () => sub.remove();
  }, [
    hasDataSnapshot,
    preferencesLoaded,
    user?.uid,
    userDoc?.notificationPreference,
    userDoc?.allergenRemindersEnabled,
    children,
    foodLog,
    bottleRemindersEnabled,
    bottleReminderTimes,
    activeChild?.name,
    toast,
  ]);

  // MainApp unmounts on sign-out; clear private reminders before another account uses this device.
  useEffect(
    () => () => {
      syncLocalReminders({ enabled: false }).catch(() => {});
    },
    [user?.uid],
  );

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
    openFoodModal({
      name: group.name,
      category: group.category,
      categories: latest.categories || (group.category ? [group.category] : []),
      categoryOther: latest.categoryOther || "",
      form: latest.form || "",
      feedType: latest.feedType || "",
      allergens: latest.allergens || [],
    });
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
            !hasAllergenCheckIn(e, allergenValue),
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

      const confirmed = [
        ...new Set([...(original.allergenCheckIns || []), allergenValue]),
      ];
      const updates = {
        reaction: "Good",
        allergenCheckIns: confirmed,
        isAllergenCheckin: original.allergens.every((value) =>
          confirmed.includes(value),
        ),
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
      return false;
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
      return false;
    }
    const existing = childLog.filter(
      (f) => normalize(f.name) === normalize(form.name),
    );
    const entry = {
      loggedAt: new Date().toISOString(),
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
      return true;
    } catch {
      Alert.alert("Error", "Could not save entry.");
      return false;
    }
  };

  const editFood = async (updated, err) => {
    if (!updated) {
      Alert.alert("Missing Info", err || "Please fill required fields.");
      return false;
    }
    try {
      await updateFoodEntry(updated.id, updated);
      setFoodLog((p) =>
        p.map((f) => (f.id === updated.id ? { ...f, ...updated } : f)),
      );
      setEditEntry(null);
      toast("Entry updated");
      return true;
    } catch {
      Alert.alert("Error", "Could not update entry.");
      return false;
    }
  };

  const deleteFood = async (id) => {
    const original = foodLog.find((entry) => entry.id === id);
    try {
      await deleteFoodEntry(id);
      setFoodLog((p) => p.filter((f) => f.id !== id));
      if (original)
        setUndoDelete({
          id: `food-${id}`,
          label: "Food entry",
          restore: async () => {
            await restoreLogEntry("foodLog", original, user.uid);
            setFoodLog((entries) =>
              entries.some((entry) => entry.id === original.id)
                ? entries
                : [...entries, original],
            );
          },
        });
      if (!original) toast("Entry deleted");
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
    } catch {
      Alert.alert(
        "Not saved",
        "Could not update your favourite. Please try again.",
      );
    }
  };

  // ── Bottle log ──

  const addBottle = async (entry) => {
    if (!activeChild) {
      Alert.alert("No child selected", "Please select a child first.");
      return false;
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
      toast("Milk feed saved");
      return true;
    } catch {
      Alert.alert(
        "Not saved",
        "Your milk entry is still here. Please try again.",
      );
      return false;
    }
  };

  const editBottle = async (updated) => {
    try {
      await updateBottleEntry(updated.id, updated);
      setBottleLog((p) =>
        p.map((b) => (b.id === updated.id ? { ...b, ...updated } : b)),
      );
      toast("Milk feed updated");
      return true;
    } catch {
      Alert.alert(
        "Not saved",
        "Your changes are still here. Please try again.",
      );
      return false;
    }
  };

  const deleteBottle = async (id) => {
    const original = bottleLog.find((entry) => entry.id === id);
    try {
      await deleteBottleEntry(id);
      setBottleLog((p) => p.filter((b) => b.id !== id));
      if (original)
        setUndoDelete({
          id: `milk-${id}`,
          label: "Milk entry",
          restore: async () => {
            await restoreLogEntry("bottleLog", original, user.uid);
            setBottleLog((entries) =>
              entries.some((entry) => entry.id === original.id)
                ? entries
                : [...entries, original],
            );
          },
        });
      if (!original) toast("Entry deleted");
    } catch {
      Alert.alert("Error", "Could not delete entry.");
    }
  };

  // ── Children ──

  const addChild = async (child) => {
    try {
      const {
        initialWeight,
        initialWeightOz,
        initialWeightUnit,
        ...childData
      } = child;
      if (childData.photoUri && isLocalUri(childData.photoUri))
        childData.photoUri = await uploadChildPhoto(
          childData.photoUri,
          user.uid,
          `${user.uid}_${Date.now()}`,
        );
      const pounds = parseFloat(initialWeight) || 0,
        ounces = parseFloat(initialWeightOz) || 0;
      const kg =
        initialWeightUnit === "lbs" ? (pounds + ounces / 16) / 2.20462 : pounds;
      const now = new Date();
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const weight =
        kg > 0 ? { value_kg: Math.round(kg * 1000) / 1000, date } : null;
      const newId = await fbAddChild(user.uid, childData, weight);
      setChildren((p) => [...p, { id: newId, ...childData, userId: user.uid }]);
      if (!activeChildId) {
        setActiveChildId(newId);
        saveDefaultChild(newId);
      }
      if (weight)
        setWeightLog((p) => [
          ...p,
          {
            id: `${newId}_initial`,
            childId: newId,
            userId: user.uid,
            ...weight,
          },
        ]);
      toast(`${child.name} added`);
      return true;
    } catch (error) {
      Alert.alert(
        "Not saved",
        error.message || "Could not add child. Please try again.",
      );
      return false;
    }
  };

  const editChild = async (updated) => {
    try {
      let toSave = { ...updated };

      // Upload photo to Firebase Storage before saving to Firestore
      if (toSave.photoUri && isLocalUri(toSave.photoUri)) {
        toSave.photoUri = await uploadChildPhoto(
          toSave.photoUri,
          user.uid,
          toSave.id,
        );
      }

      await fbUpdateChild(toSave.id, toSave);
      setChildren((p) => p.map((c) => (c.id === toSave.id ? toSave : c)));
      toast("Updated");
      return true;
    } catch {
      Alert.alert(
        "Not saved",
        "Could not update child or upload the photo. Your changes are still here.",
      );
      return false;
    }
  };

  const deleteChild = async (id) => {
    try {
      await fbDeleteChild(id, user.uid);
      setChildren((p) => p.filter((c) => c.id !== id));
      setFoodLog((p) => p.filter((f) => f.childId !== id));
      setBottleLog((p) => p.filter((f) => f.childId !== id));
      setWeightLog((p) => p.filter((f) => f.childId !== id));
      if (activeChildId === id)
        setActiveChildId(children.find((c) => c.id !== id)?.id || null);
      toast("Child removed");
    } catch (error) {
      Alert.alert(
        "Deletion incomplete",
        "Please retry to finish removing this child and their data.",
      );
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
      loggedAt: new Date().toISOString(),
      childId: activeChild.id,
      date: localDay(),
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
      toast("Weight saved");
      return true;
    } catch {
      Alert.alert(
        "Not saved",
        "Your weight entry is still here. Please try again.",
      );
      return false;
    }
  };

  const updateWeightEntry = async (id, fields) => {
    try {
      await fbUpdateWeightEntry(id, fields);
      setWeightLog((p) =>
        p.map((w) => (w.id === id ? { ...w, ...fields } : w)),
      );
      toast("Weight updated");
      return true;
    } catch {
      Alert.alert(
        "Not saved",
        "Your changes are still here. Please try again.",
      );
      return false;
    }
  };

  const deleteWeightEntry = async (id) => {
    const original = weightLog.find((entry) => entry.id === id);
    try {
      await fbDeleteWeightEntry(id);
      setWeightLog((p) => p.filter((w) => w.id !== id));
      if (original)
        setUndoDelete({
          id: `weight-${id}`,
          label: "Weight entry",
          restore: async () => {
            await restoreLogEntry("weightLog", original, user.uid);
            setWeightLog((entries) =>
              entries.some((entry) => entry.id === original.id)
                ? entries
                : [...entries, original],
            );
          },
        });
    } catch {
      Alert.alert("Error", "Could not delete weight entry.");
    }
  };

  const setWeightPreferenceUnit = async (unit) => {
    try {
      await AsyncStorage.setItem(`weightUnit_${user.uid}`, unit);
      setWeightPreference(unit);
      toast("Weight unit saved");
    } catch {
      Alert.alert(
        "Not saved",
        "Could not save your weight unit. Please try again.",
      );
    }
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

  const openFoodModal = (initial = null) => {
    if (requireChild()) return;
    setPrefillFood(initial);
    setPage("log");
    setShowFoodModal(true);
  };
  const closeFoodModal = () => {
    setShowFoodModal(false);
    setPrefillFood(null);
    setPage("log");
  };

  // ── Bottle reminder notifications ──

  const handleToggleBottleReminders = async (enabled) => {
    if (
      enabled &&
      !notificationsAllowed(
        userDoc?.notificationPreference,
        bottleRemindersEnabled,
      )
    )
      return;
    if (enabled) {
      try {
        if (!(await requestBottleReminderPermission())) {
          Alert.alert(
            "Notifications are off",
            "Allow notifications in your phone settings to receive bottle reminders.",
          );
          return;
        }
      } catch {
        Alert.alert("Could not enable reminders", "Please try again.");
        return;
      }
    }
    setBottleRemindersEnabled(enabled);
    AsyncStorage.setItem(
      `bottleRemindersEnabled_${user.uid}`,
      String(enabled),
    ).catch(() => {});
  };

  const handleAddBottleReminderTime = (time) => {
    const newTimes = [...bottleReminderTimes, time].sort(
      (a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute),
    );
    setBottleReminderTimes(newTimes);
    AsyncStorage.setItem(
      `bottleReminderTimes_${user.uid}`,
      JSON.stringify(newTimes),
    ).catch(() => {});
  };

  const handleRemoveBottleReminderTime = (index) => {
    const newTimes = bottleReminderTimes.filter((_, i) => i !== index);
    setBottleReminderTimes(newTimes);
    AsyncStorage.setItem(
      `bottleReminderTimes_${user.uid}`,
      JSON.stringify(newTimes),
    ).catch(() => {});
  };

  // ── Settings ──

  const saveDashboardPreference = async (key, value) => {
    await updateDoc(
      doc(firestoreDb, "users", user.uid),
      dashboardPreferencePatch(key, value),
    );
    if (key === "showMilk") {
      setShowMilkOnDashboard(value);
      AsyncStorage.setItem(`showMilkDash_${user.uid}`, String(value)).catch(
        () => {},
      );
    }
    if (key === "showAllergens") {
      setShowAllergenOnDashboard(value);
      AsyncStorage.setItem(`showAllergenDash_${user.uid}`, String(value)).catch(
        () => {},
      );
    }
  };

  const handleLogout = () =>
    Alert.alert(
      "Sign out?",
      "Are you sure you want to sign out of MunchSprouts?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            try {
              await logOut();
            } catch {
              Alert.alert("Could not sign out", "Please try again.");
            }
          },
        },
      ],
    );

  const handleDeleteAccount = async () => {
    try {
      await deleteAccount(user.uid);
      // The helper signs out locally after server cleanup completes.
    } catch (e) {
      if (
        e.code === "auth/requires-recent-login" ||
        e.message?.includes("RECENT_LOGIN_REQUIRED")
      ) {
        // Firebase requires a fresh sign-in for account deletion.
        // Sign the user out automatically so they land on the auth screen,
        // then they can sign back in and delete from Settings.
        await logOut();
        Alert.alert(
          "Please sign in again",
          "For security, account deletion requires a recent sign-in. You have been signed out — please sign back in and try again.",
        );
      } else {
        Alert.alert(
          "Error",
          e.message || "Could not delete account. Please try again.",
        );
      }
    }
  };

  const purchaseProPlan = async (planType) => {
    const offerings = await getOfferings();
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
    if (!pkg) {
      Alert.alert(
        "Plan unavailable",
        "This plan is currently unavailable. Please try again later.",
      );
      return;
    }
    const customerInfo = await purchase(pkg);
    if (!customerInfo) return;
    if (customerInfo.entitlements.active["pro"]) {
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
        Alert.alert(
          "Purchase failed",
          msg || "Something went wrong. Please try again.",
        );
      }
    }
  };

  const handleRestorePurchases = async () => {
    try {
      const customerInfo = await restore();
      if (!customerInfo) return;
      if (customerInfo.entitlements.active["pro"]) {
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
    try {
      const { httpsCallable } = require("firebase/functions");
      const { functions } = require("./src/firebase");
      await httpsCallable(
        functions,
        "manageSharing",
      )({
        childId,
        role,
        remove: isRemove,
        ...(isRemove ? { targetUid: emailOrUid } : { email: emailOrUid }),
      });
      setChildren(await fetchChildren(user.uid));
      Alert.alert(
        isRemove ? "Removed" : "Shared",
        isRemove
          ? "Access has been removed."
          : "Family access has been updated.",
      );
      onSuccess?.();
    } catch (error) {
      Alert.alert(
        "Could not update sharing",
        error.message || "Please try again.",
      );
    }
  };

  const handleGenerateInviteCode = async (childId, role = "caregiver") => {
    const { httpsCallable } = await import("firebase/functions");
    const { functions: fns } = await import("./src/firebase");
    const fn = httpsCallable(fns, "generateInviteCode");
    const result = await fn({ childId, role });
    return result.data.code;
  };

  const handleJoinViaCode = async (code) => {
    const { httpsCallable } = await import("firebase/functions");
    const { functions: fns } = await import("./src/firebase");
    const fn = httpsCallable(fns, "joinViaInviteCode");
    const result = await fn({ code });
    return result.data; // { childName }
  };

  if (!dataLoaded) return <LoadingScreen />;

  const fabBottom = (insets.bottom > 0 ? insets.bottom : 10) + 64;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: C.screen }}
      edges={["top"]}
    >
      <StatusBar
        barStyle={theme === "dark" ? "light-content" : "dark-content"}
        backgroundColor={C.navBg}
      />

      {/* Header */}
      <View style={s.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Image
            source={require("./assets/logo.png")}
            style={{ width: 34, height: 34, borderRadius: 8 }}
            resizeMode="contain"
          />
          <View>
            <Text style={s.appName}>Munch Sprouts</Text>
            <Text style={s.pageSubtitle}>
              {PAGE_TITLES[page] || "Dashboard"}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => setShowChildDropdown(true)}
          style={{
            backgroundColor: appPalette.background,
            borderRadius: 999,
            paddingHorizontal: 14,
            paddingVertical: 8,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            shadowColor: appPalette.accent,
            shadowOpacity: 0.3,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 3 },
            elevation: 4,
          }}
          activeOpacity={0.85}
        >
          {activeChild?.photoUri ? (
            <Image
              source={{ uri: activeChild.photoUri }}
              accessible={false}
              style={{ width: 24, height: 24, borderRadius: 12 }}
            />
          ) : (
            <Icon name="baby" size={14} color={appPalette.ink} />
          )}
          <Text
            style={{
              fontFamily: "NunitoSans_700Bold",
              fontSize: 13,
              color: appPalette.ink,
            }}
            numberOfLines={1}
          >
            {activeChild ? activeChild.name : "Add Baby"}
          </Text>
          <Icon
            name={showChildDropdown ? "chevUp" : "chevDown"}
            size={11}
            color={appPalette.ink}
          />
        </TouchableOpacity>
      </View>

      <ChildDropdown
        palette={appPalette}
        visible={showChildDropdown}
        children={children}
        activeChildId={activeChildId}
        onSelect={(id) => {
          setActiveChildId(id);
          saveDefaultChild(id);
        }}
        onSettings={() => setShowMoreModal(true)}
        onManage={() => setPage("children")}
        onClose={() => setShowChildDropdown(false)}
        // Let the dropdown dismiss before presenting the native confirmation.
        onSignOut={() => setTimeout(handleLogout, 300)}
        topOffset={insets.top + 66}
      />

      {/* Page content */}
      <View
        style={{
          flex: 1,
          paddingHorizontal: 16,
          paddingTop: 16,
          backgroundColor: C.screen,
        }}
      >
        {/* ── Main tabs: kept mounted, just shown/hidden — avoids mount/unmount jitter on Android ── */}
        <View
          style={{ flex: 1, display: page === "dashboard" ? "flex" : "none" }}
        >
          <DashboardScreen
            preferences={{
              ...userDoc?.dashboardPreferences,
              showMilk: showMilkOnDashboard,
              showAllergens: showAllergenOnDashboard,
            }}
            onSavePreference={saveDashboardPreference}
            priority={userDoc?.onboardingPriority}
            child={activeChild}
            foodLog={childLog}
            bottleLog={childBottleLog}
            weightLog={childWeightLog}
            weightPreference={weightPreference}
            showMilkOnDashboard={showMilkOnDashboard}
            showAllergenOnDashboard={showAllergenOnDashboard}
            recipes={recipes}
            onNavigate={(pg) => {
              if (pg === "add") {
                openFoodModal();
                return;
              }
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
            key={activeChild?.id || "no-child"}
            foodLog={childLog}
            childName={activeChild?.name || null}
            bottleLog={childBottleLog}
            weightLog={childWeightLog}
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
            onAddFood={() => openFoodModal()}
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        </View>
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
        <View
          style={{ flex: 1, display: page === "allergens" ? "flex" : "none" }}
        >
          <AllergenScreen
            isActive={page === "allergens"}
            child={activeChild}
            foodLog={childLog}
            onNavigate={setPage}
            onViewInLog={(allergenValue) => {
              setLogFilter("");
              setLogOpenKey(null);
              setLogAllergenFilter(allergenValue);
              setPage("log");
            }}
            onAddWithPrefill={(allergenValue) => {
              openFoodModal({
                name: "",
                category: "",
                categories: [],
                feedType: "",
                allergens: allergenValue ? [allergenValue] : [],
              });
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
            onViewMilkLog={() => setPage("bottle")}
          />
        )}
      </View>

      {/* Bottom Nav */}
      <View
        style={[
          s.bottomNav,
          {
            paddingBottom: insets.bottom > 0 ? insets.bottom : 10,
            borderColor: appPalette.accent + "60",
            shadowColor: appPalette.accent,
          },
        ]}
      >
        {NAV.map((n) => {
          const active = page === n.id;
          return (
            <TouchableOpacity
              key={n.id}
              onPress={() => {
                if (n.id === "meals" && page === "meals") {
                  setMealsResetKey((k) => k + 1);
                }
                setPage(n.id);
              }}
              style={s.navItem}
              activeOpacity={0.75}
            >
              <View
                style={{
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 3,
                  paddingHorizontal: active ? 16 : 0,
                  paddingVertical: 6,
                  borderRadius: 20,
                  backgroundColor: active
                    ? appPalette.background
                    : "transparent",
                  width: active ? undefined : 44,
                }}
              >
                <Icon
                  name={n.icon}
                  size={22}
                  color={active ? appPalette.accent : C.mutedText}
                />
                <Text
                  style={{
                    fontFamily: active
                      ? "NunitoSans_700Bold"
                      : "NunitoSans_600SemiBold",
                    fontSize: 10,
                    color: active ? appPalette.accent : C.mutedText,
                  }}
                >
                  {n.label}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Floating Add Button */}
      {page !== "meals" && (
        <TouchableOpacity
          onPress={() => {
            if (requireChild()) return;
            page === "bottle" ? setBottleQuickAdd(true) : setShowAddMenu(true);
          }}
          activeOpacity={0.85}
          style={{
            position: "absolute",
            bottom: fabBottom,
            right: 18,
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: appPalette.accent,
            borderWidth: 2,
            borderColor: appPalette.accent,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: appPalette.accent,
            shadowOpacity: 0.4,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 5 },
            elevation: 10,
          }}
        >
          <Svg width={22} height={22} viewBox="0 0 24 24">
            <Path
              stroke="#ffffff"
              strokeWidth={2.5}
              strokeLinecap="round"
              fill="none"
              d="M12 5v14M5 12h14"
            />
          </Svg>
        </TouchableOpacity>
      )}

      <AutomaticWhatsNew user={user} />
      {/* Modals */}
      {showFoodModal && (
        <AddFoodModal
          key={foodDraftKey(user.uid, activeChild?.id)}
          draftKey={foodDraftKey(user.uid, activeChild?.id)}
          initial={prefillFood}
          isPro={isPro}
          recentFoods={childLog}
          onSubmit={addFood}
          onClose={closeFoodModal}
        />
      )}
      <ChildPickerModal
        palette={appPalette}
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
        palette={appPalette}
        visible={showAddMenu}
        onClose={() => setShowAddMenu(false)}
        onFood={() => {
          setShowAddMenu(false);
          openFoodModal();
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
        fabBottom={fabBottom}
      />

      <Modal
        visible={showMoreModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowMoreModal(false)}
      >
        <SafeAreaView
          style={{ flex: 1, backgroundColor: C.screen }}
          edges={["top"]}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 20,
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderBottomColor: C.borderLight,
            }}
          >
            <Text
              style={{
                fontFamily: "PlusJakartaSans_700Bold",
                fontSize: 18,
                color: C.primaryPinkDark,
              }}
            >
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
              activeOpacity={0.75}
            >
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
            onSaveDashboardPreference={saveDashboardPreference}
            showAllergenOnDashboard={showAllergenOnDashboard}
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
        onSave={addWeightEntry}
        onClose={() => setShowWeightModal(false)}
      />

      {undoDelete && (
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            bottom: fabBottom + 68,
            left: 16,
            right: 16,
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <UndoBanner
            palette={appPalette}
            key={undoDelete.id}
            label={undoDelete.label}
            onDismiss={() => setUndoDelete(null)}
            onUndo={async () => {
              const pending = undoDelete;
              await pending.restore();
              setUndoDelete((current) =>
                current === pending ? null : current,
              );
              toast("Entry restored");
            }}
          />
        </View>
      )}
      {/* Toasts */}
      <View style={s.toastContainer} pointerEvents="none">
        {toasts.map((t) => (
          <View
            key={t.id}
            style={[
              s.toast,
              {
                backgroundColor:
                  t.type !== "success" ? C.bgWarning : C.statGreenBg,
                borderWidth: 1.5,
                borderColor:
                  t.type !== "success" ? C.warningStroke : C.primaryGreenLight,
              },
            ]}
          >
            <Text
              style={{
                color: t.type !== "success" ? C.warningStroke : C.statGreenText,
                fontFamily: "NunitoSans_700Bold",
                fontSize: 13,
              }}
            >
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
  const { user, userDoc, userDocLoaded, loading } = useAuth();
  const onboardingActive =
    userDoc?.onboardingComplete === false || !!userDoc?.onboardingWelcome;
  useEffect(() => {
    if (user?.uid && userDocLoaded && onboardingActive)
      void dismissWhatsNew(user.uid);
  }, [user?.uid, userDocLoaded, onboardingActive]);
  // Wait for Firebase Auth AND the first Firestore snapshot to settle.
  // userDocLoaded becomes true once onSnapshot resolves (even on error),
  // so we never get stuck on LoadingScreen indefinitely.
  if (loading || (user && !userDocLoaded)) return <LoadingScreen />;
  if (!user) return <AuthScreen />;
  // New users haven't completed onboarding yet — show the wizard first.
  // Existing users (onboardingComplete === undefined) skip straight to the app.
  if (userDoc?.onboardingComplete === false) {
    return <OnboardingScreen user={user} userDoc={userDoc} />;
  }
  if (userDoc?.onboardingWelcome) {
    return (
      <OnboardingCompleteScreen
        user={user}
        priority={userDoc.onboardingWelcome.priority}
        childName={userDoc.onboardingWelcome.childName}
      />
    );
  }
  return <MainApp key={user.uid} user={user} userDoc={userDoc} />;
}

export default function App() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    NunitoSans_400Regular,
    NunitoSans_600SemiBold,
    NunitoSans_700Bold,
    NunitoSans_800ExtraBold,
  });

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

  if (!fontsLoaded) return null;

  return (
    <ThemeContext.Provider value={{ theme, C, setTheme }}>
      <SafeAreaProvider>
        <Root />
      </SafeAreaProvider>
    </ThemeContext.Provider>
  );
}
