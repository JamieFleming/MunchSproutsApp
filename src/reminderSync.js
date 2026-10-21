import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { ALLERGENS } from "./constants";
import { allergenCheckIn } from "./allergenCheckIn";

// Older accounts could enable bottle reminders after skipping onboarding permission.
// Preserve that explicit choice until the new master switch is turned off.
export function notificationsAllowed(preference, bottleEnabled = false) {
  return (
    preference === "enabled" || (preference !== "disabled" && bottleEnabled)
  );
}

export function allergenReminderPlan({
  userId,
  children = [],
  foodLog = [],
  now = Date.now(),
}) {
  const plan = [];
  for (const child of children) {
    const entries = foodLog.filter((entry) => entry.childId === child.id);
    for (const { value: allergen } of ALLERGENS) {
      if (child.knownAllergens?.includes(allergen)) continue;
      const checkIn = allergenCheckIn(
        entries.filter(
          (entry) =>
            Array.isArray(entry.allergens) &&
            entry.allergens.includes(allergen),
        ),
        allergen,
      );
      // Past check-ins stay available in the app; do not bombard users on upgrade.
      if (!checkIn || checkIn.due <= now) continue;
      const key = JSON.stringify([userId, child.id, allergen, checkIn.due]);
      plan.push({
        key,
        content: {
          title: "Allergen check-in",
          body: `It's been 48 hours since ${child.name || "your little one"} tried ${allergen}. Record how they got on.`,
          sound: "default",
          data: {
            reminderKey: key,
            reminderType: "allergen",
            userId,
            childId: child.id,
            screen: "allergens",
            allergen,
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(checkIn.due),
          ...(Platform.OS === "android" && { channelId: "default" }),
        },
      });
    }
  }
  return plan.sort((a, b) => a.trigger.date - b.trigger.date);
}

/** Serialise changes so an old schedule cannot win a race with disable/sign-out. */
export function createReminderSync(api = Notifications) {
  let queue = Promise.resolve();
  let revision = 0;
  return (options = {}) => {
    const current = ++revision;
    const run = async () => {
      if (current !== revision) return;
      if (!options.enabled || !options.userId) {
        await api.cancelAllScheduledNotificationsAsync();
        return;
      }
      const permission = await api.getPermissionsAsync();
      const pending = await api.getAllScheduledNotificationsAsync();
      const owned = (item) =>
        item.content?.data?.reminderType ||
        item.content?.data?.screen === "bottle";
      let desired = [];
      if (permission.granted) {
        if (Platform.OS === "android")
          await api.setNotificationChannelAsync("default", {
            name: "MunchSprouts",
            importance: api.AndroidImportance.HIGH,
            sound: "default",
          });
        if (options.allergensEnabled) desired = allergenReminderPlan(options);
        if (options.bottleEnabled) {
          const seen = new Set();
          for (const time of options.bottleTimes || []) {
            if (
              !Number.isInteger(time.hour) ||
              time.hour < 0 ||
              time.hour > 23 ||
              !Number.isInteger(time.minute) ||
              time.minute < 0 ||
              time.minute > 59
            )
              continue;
            const key = JSON.stringify([
              options.userId,
              "bottle",
              options.childName,
              time.hour,
              time.minute,
            ]);
            if (seen.has(key)) continue;
            seen.add(key);
            desired.push({
              key,
              content: {
                title: "🍼 Bottle Feeding Reminder",
                body: `Time to feed ${options.childName || "your baby"}!`,
                sound: "default",
                data: {
                  reminderKey: key,
                  reminderType: "bottle",
                  userId: options.userId,
                  screen: "bottle",
                },
              },
              trigger: {
                type: api.SchedulableTriggerInputTypes.DAILY,
                hour: time.hour,
                minute: time.minute,
                ...(Platform.OS === "android" && { channelId: "default" }),
              },
            });
          }
        }
      }
      // Leave room below iOS's pending-notification limit, including unrelated reminders.
      desired = desired.slice(
        0,
        Math.max(0, 60 - pending.filter((item) => !owned(item)).length),
      );
      const keys = new Set(desired.map((item) => item.key));
      const existing = new Set();
      for (const item of pending) {
        if (!owned(item)) continue;
        const key = item.content?.data?.reminderKey;
        if (!keys.has(key) || existing.has(key))
          await api.cancelScheduledNotificationAsync(item.identifier);
        else existing.add(key);
      }
      for (const item of desired) {
        if (current !== revision) return;
        if (!existing.has(item.key))
          await api.scheduleNotificationAsync({
            content: item.content,
            trigger: item.trigger,
          });
      }
    };
    queue = queue.catch(() => {}).then(run);
    return queue;
  };
}
export const syncLocalReminders = createReminderSync();
