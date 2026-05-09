import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export const DEFAULT_NOTIFICATION_PREFS = {
	enabled: false,
	intervalHours: 4,
	quietStart: "22:00",
	quietEnd: "07:00",
	sound: "default",
};

// Notification messages — rotated so they don't feel stale
const MESSAGES = [
	{ title: "Time to log! 🥦", body: "Don't forget to record your little one's meal" },
	{ title: "Meal time check-in 🍓", body: "Tap to log what your baby tried today" },
	{ title: "How did feeding go? 🥕", body: "Keep your food log up to date" },
	{ title: "Log your baby's meal 🥑", body: "A quick note now saves time later" },
	{ title: "Weaning reminder 🌽", body: "Add today's foods to your log" },
];

// Returns true if the given hour falls within quiet hours (inclusive of start, exclusive of end)
function isInQuietHours(hour, quietStart, quietEnd) {
	const startH = parseInt(quietStart.split(":")[0], 10);
	const endH = parseInt(quietEnd.split(":")[0], 10);

	if (startH >= endH) {
		// Overnight window e.g. 22:00 → 07:00
		return hour >= startH || hour < endH;
	} else {
		// Same-day window e.g. 10:00 → 14:00
		return hour >= startH && hour < endH;
	}
}

// Set global notification handler — call once on app start
export function initNotificationHandler() {
	Notifications.setNotificationHandler({
		handleNotification: async () => ({
			shouldShowAlert: true,
			shouldPlaySound: true,
			shouldSetBadge: false,
		}),
	});
}

// Request permission — returns true if granted
export async function requestNotificationPermission() {
	if (Platform.OS === "android") {
		await Notifications.setNotificationChannelAsync("reminders", {
			name: "Meal Reminders",
			importance: Notifications.AndroidImportance.DEFAULT,
			sound: "default",
		});
	}

	const { status: existing } = await Notifications.getPermissionsAsync();
	if (existing === "granted") return true;

	const { status } = await Notifications.requestPermissionsAsync();
	return status === "granted";
}

// Cancel all pending reminder notifications and reschedule based on prefs
export async function scheduleReminders(prefs) {
	await Notifications.cancelAllScheduledNotificationsAsync();

	if (!prefs?.enabled) return;

	const intervalHours = prefs.intervalHours || 4;
	const quietStart = prefs.quietStart || "22:00";
	const quietEnd = prefs.quietEnd || "07:00";
	const useSound = prefs.sound !== "silent";

	// Override the handler sound based on pref
	Notifications.setNotificationHandler({
		handleNotification: async () => ({
			shouldShowAlert: true,
			shouldPlaySound: useSound,
			shouldSetBadge: false,
		}),
	});

	// Build list of hours in a 24-hour day at the given interval
	const candidateHours = [];
	for (let h = 0; h < 24; h += intervalHours) {
		candidateHours.push(h);
	}

	// Filter out quiet hours
	const validHours = candidateHours.filter(
		(h) => !isInQuietHours(h, quietStart, quietEnd),
	);

	// Schedule one daily notification per valid hour
	for (let i = 0; i < validHours.length; i++) {
		const hour = validHours[i];
		const msg = MESSAGES[i % MESSAGES.length];

		await Notifications.scheduleNotificationAsync({
			content: {
				title: msg.title,
				body: msg.body,
				sound: useSound ? "default" : null,
			},
			trigger: {
				type: "daily",
				hour,
				minute: 0,
				repeats: true,
			},
		});
	}
}

export async function cancelAllReminders() {
	await Notifications.cancelAllScheduledNotificationsAsync();
}
