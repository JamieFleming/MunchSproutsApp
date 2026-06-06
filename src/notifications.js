import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

export const DEFAULT_NOTIFICATION_PREFS = {
	enabled: false,
	intervalHours: 4,
	quietStart: "22:00",
	quietEnd: "07:00",
	sound: "default",
};

const MEAL_IDS_KEY = "munchsprouts_mealReminderIds";

const MESSAGES = [
	{ title: "Time to log! 🥦", body: "Don't forget to record your little one's meal" },
	{ title: "Meal time check-in 🍓", body: "Tap to log what your baby tried today" },
	{ title: "How did feeding go? 🥕", body: "Keep your food log up to date" },
	{ title: "Log your baby's meal 🥑", body: "A quick note now saves time later" },
	{ title: "Weaning reminder 🌽", body: "Add today's foods to your log" },
];

function isInQuietHours(hour, quietStart, quietEnd) {
	const startH = parseInt(quietStart.split(":")[0], 10);
	const endH = parseInt(quietEnd.split(":")[0], 10);
	if (startH >= endH) {
		return hour >= startH || hour < endH;
	}
	return hour >= startH && hour < endH;
}

// Request permission and ensure the Android reminders channel exists
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

// Cancel only meal reminder notifications (not bottle reminders)
export async function cancelAllReminders() {
	try {
		const raw = await AsyncStorage.getItem(MEAL_IDS_KEY);
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
		await AsyncStorage.removeItem(MEAL_IDS_KEY);
	} catch { /* silent */ }
}

// Cancel existing meal reminders and reschedule based on prefs
export async function scheduleReminders(prefs) {
	await cancelAllReminders();

	if (!prefs?.enabled) return;

	const intervalHours = prefs.intervalHours || 4;
	const quietStart = prefs.quietStart || "22:00";
	const quietEnd = prefs.quietEnd || "07:00";
	const useSound = prefs.sound !== "silent";

	const candidateHours = [];
	for (let h = 0; h < 24; h += intervalHours) {
		candidateHours.push(h);
	}

	const validHours = candidateHours.filter(
		(h) => !isInQuietHours(h, quietStart, quietEnd),
	);

	const ids = [];
	for (let i = 0; i < validHours.length; i++) {
		const hour = validHours[i];
		const msg = MESSAGES[i % MESSAGES.length];

		try {
			const id = await Notifications.scheduleNotificationAsync({
				content: {
					title: msg.title,
					body: msg.body,
					sound: useSound ? "default" : null,
					...(Platform.OS === "android" && { channelId: "reminders" }),
				},
				trigger: {
					type: Notifications.SchedulableTriggerInputTypes.DAILY,
					hour,
					minute: 0,
				},
			});
			ids.push(id);
		} catch { /* silent */ }
	}

	try {
		await AsyncStorage.setItem(MEAL_IDS_KEY, JSON.stringify(ids));
	} catch { /* silent */ }
}
