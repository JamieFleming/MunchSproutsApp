/**
 * notificationService.js
 *
 * Central place for all push-notification logic.
 * Everything is imported lazily inside functions so this file is safe
 * to import even if the native module isn't registered yet.
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
import AsyncStorage from "@react-native-async-storage/async-storage";

// ── Foreground behaviour ───────────────────────────────────────────────────────
// Show alert + play sound when a notification arrives while the app is open.
Notifications.setNotificationHandler({
	handleNotification: async () => ({
		shouldShowAlert: true,
		shouldPlaySound: true,
		shouldSetBadge: true,
	}),
});

// ── Android default channel ────────────────────────────────────────────────────
async function ensureAndroidChannel() {
	if (Platform.OS !== "android") return;
	await Notifications.setNotificationChannelAsync("default", {
		name:             "MunchSprouts",
		importance:       Notifications.AndroidImportance.HIGH,
		vibrationPattern: [0, 250, 250, 250],
		lightColor:       "#9b7fe8",
		sound:            "default",
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
		const { db }          = await import("./firebase");
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
 * Called when a notification arrives while the app is in the foreground.
 * Returns an unsubscribe function.
 *
 *   const unsub = onNotificationReceived((notification) => {
 *     console.log(notification.request.content);
 *   });
 */
export function onNotificationReceived(handler) {
	const sub = Notifications.addNotificationReceivedListener(handler);
	return () => sub.remove();
}

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

/** Set the app badge to a specific number (iOS). */
export async function setBadge(count) {
	await Notifications.setBadgeCountAsync(count);
}

// ── Local notification (for future use) ───────────────────────────────────────

/**
 * Schedule a local notification.
 *
 * Example — fire in 5 seconds:
 *   scheduleLocalNotification({
 *     title: "Time to log!",
 *     body: "Don't forget to log Oliver's lunch today.",
 *     data: { screen: "log" },
 *     seconds: 5,
 *   });
 */
export async function scheduleLocalNotification({ title, body, data = {}, seconds = 5 }) {
	await Notifications.scheduleNotificationAsync({
		content: { title, body, data, sound: "default" },
		trigger:  { seconds },
	});
}

// ── Bottle feeding reminders ──────────────────────────────────────────────────

const BOTTLE_IDS_KEY = "munchsprouts_bottleReminderIds";

/**
 * Schedule daily bottle feeding reminders.
 * @param {Array<{hour: number, minute: number}>} times - Array of 24h times
 * @param {string} childName - Name to use in the notification body
 */
export async function scheduleBottleReminders(times, childName = "your baby") {
	// Cancel any existing bottle reminders before rescheduling
	await cancelBottleReminders();

	if (!times || times.length === 0) return;

	const ids = [];
	for (const t of times) {
		try {
			const id = await Notifications.scheduleNotificationAsync({
				content: {
					title: "🍼 Bottle Feeding Reminder",
					body: `Time to feed ${childName}!`,
					data: { screen: "bottle" },
					sound: "default",
				},
				trigger: {
					type: Notifications.SchedulableTriggerInputTypes.DAILY,
					hour: t.hour,
					minute: t.minute,
				},
			});
			ids.push(id);
		} catch (e) {
			console.warn("Bottle reminder schedule failed:", e.message);
		}
	}

	try {
		await AsyncStorage.setItem(BOTTLE_IDS_KEY, JSON.stringify(ids));
	} catch { /* silent */ }
}

/**
 * Cancel all scheduled bottle feeding reminders.
 */
export async function cancelBottleReminders() {
	try {
		const raw = await AsyncStorage.getItem(BOTTLE_IDS_KEY);
		if (raw) {
			const ids = JSON.parse(raw);
			await Promise.all(
				ids.map((id) =>
					Notifications.cancelScheduledNotificationAsync(id).catch(() => {}),
				),
			);
		}
	} catch { /* silent */ }
	try {
		await AsyncStorage.removeItem(BOTTLE_IDS_KEY);
	} catch { /* silent */ }
}
