/**
 * notificationService.js
 *
 * Central place for all push-notification logic.
 * Requires a native build containing expo-notifications.
 *
 * Typical usage in App.js:
 *
 *   useEffect(() => {
 *     if (!user) return;
 *     setupNotifications(user.uid);
 *     const unsub = onNotificationTapped((response) => {
 *       // navigate based on response.notification.request.content.data
 *     });
 *     return unsub;
 *   }, [user?.uid]);
 */

import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";

// ── Foreground behaviour ───────────────────────────────────────────────────────
// Show alert + play sound when a notification arrives while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ── Android default channel ────────────────────────────────────────────────────
async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "MunchSprouts",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#9b7fe8",
    sound: "default",
  });
}

// ── Permission + token ─────────────────────────────────────────────────────────

/**
 * Request notification permission and return the Expo push token string,
 * or null if permission was denied or we're running on a simulator.
 */
export async function getExpoPushToken() {
  await ensureAndroidChannel();

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") return null;

  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data; // e.g. "ExponentPushToken[xxxxxxxxxxxxxx]"
  } catch {
    // Silently fails on simulators or when a project ID isn't available
    return null;
  }
}

// ── Registration helper ────────────────────────────────────────────────────────

/**
 * Full setup: request permission, get token, and save it to Firestore
 * on the user's document so the backend can send targeted notifications.
 * Call this once after the user has signed in.
 */
export async function setupNotifications(userId) {
  try {
    const token = await getExpoPushToken();
    if (!token) return;

    // Save to Firestore — merge so we don't overwrite other user fields
    const { doc, setDoc } = await import("firebase/firestore");
    const { db } = await import("./firebase");
    await setDoc(
      doc(db, "users", userId),
      { pushToken: token, pushTokenUpdatedAt: new Date().toISOString() },
      { merge: true },
    );
  } catch {
    // Non-fatal — app works fine without push tokens
  }
}

// ── Listeners ─────────────────────────────────────────────────────────────────

/**
 * Called when the user taps a notification (foreground OR background).
 * Use `response.notification.request.content.data` to navigate.
 * Returns an unsubscribe function.
 *
 *   const unsub = onNotificationTapped((response) => {
 *     const { screen } = response.notification.request.content.data;
 *     if (screen) setPage(screen);
 *   });
 */
export function onNotificationTapped(handler) {
  const sub = Notifications.addNotificationResponseReceivedListener(handler);
  return () => sub.remove();
}

// ── Badge helpers ─────────────────────────────────────────────────────────────

/** Clear the app badge number (iOS). */
export async function clearBadge() {
  await Notifications.setBadgeCountAsync(0);
}

// Ask when the user explicitly enables bottle reminders, even if they skipped
// notification permission during onboarding. No push token is needed for local reminders.
export async function requestBottleReminderPermission() {
  await ensureAndroidChannel();
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  const permission = await Notifications.requestPermissionsAsync();
  return permission.granted;
}
