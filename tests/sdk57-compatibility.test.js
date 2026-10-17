const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const babel = require("@babel/core");
function load(file, imports) {
  const code = babel.transformSync(fs.readFileSync(file, "utf8"), {
    configFile: false,
    babelrc: false,
    plugins: ["@babel/plugin-transform-modules-commonjs"],
  }).code;
  const exports = {};
  new Function("require", "exports", code)((name) => {
    if (!(name in imports)) throw new Error(name);
    return imports[name];
  }, exports);
  return exports;
}
test("Android image picker awaits SDK 57 File.copy before returning its cached URI", async () => {
  const copies = [];
  class File {
    constructor(...parts) {
      this.uri = parts.join("/");
    }
    async copy(destination) {
      await Promise.resolve();
      copies.push([this.uri, destination.uri]);
    }
  }
  const helpers = load("src/helpers.js", {
    "react-native": { Platform: { OS: "android" }, Alert: {} },
    "expo-image-picker": {
      requestMediaLibraryPermissionsAsync: async () => ({ granted: true }),
      launchImageLibraryAsync: async () => ({
        assets: [{ uri: "content://photo" }],
      }),
    },
    "expo-file-system": { File, Paths: { cache: "file://cache" } },
    "firebase/storage": {},
    "./firebase": {},
    "./constants": {},
    "./milestones": {},
  });
  const uri = await helpers.pickImageAsBase64();
  assert.equal(copies.length, 1);
  assert.equal(copies[0][0], "content://photo");
  assert.equal(uri, copies[0][1]);
  assert.match(uri, /^file:\/\/cache\/picked_\d+\.jpg$/);
});
test("foreground notifications and one-shot triggers use supported notification APIs", async () => {
  let handler;
  const scheduled = [];
  const service = load("src/notificationService.js", {
    "expo-notifications": {
      setNotificationHandler: (value) => {
        handler = value;
      },
      SchedulableTriggerInputTypes: { TIME_INTERVAL: "timeInterval" },
      scheduleNotificationAsync: async (value) => scheduled.push(value),
    },
    "expo-constants": {},
    "react-native": { Platform: { OS: "ios" } },
    "@react-native-async-storage/async-storage": {},
  });
  assert.deepEqual(await handler.handleNotification(), {
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  });
  await service.scheduleLocalNotification({
    title: "Reminder",
    body: "Time to log",
    seconds: 10,
  });
  assert.deepEqual(scheduled[0].trigger, { type: "timeInterval", seconds: 10 });
});
test("meal reminders attach the Android channel to the trigger and respect quiet hours", async () => {
  const scheduled = [];
  const reminders = load("src/notifications.js", {
    "expo-notifications": {
      SchedulableTriggerInputTypes: { DAILY: "daily" },
      scheduleNotificationAsync: async (value) => {
        scheduled.push(value);
        return "id";
      },
    },
    "react-native": { Platform: { OS: "android" } },
    "@react-native-async-storage/async-storage": {
      getItem: async () => null,
      removeItem: async () => {},
      setItem: async () => {},
    },
  });
  await reminders.scheduleReminders({
    enabled: true,
    intervalHours: 4,
    quietStart: "22:00",
    quietEnd: "07:00",
  });
  assert.deepEqual(
    scheduled.map((value) => value.trigger.hour),
    [8, 12, 16, 20],
  );
  for (const value of scheduled) {
    assert.equal(value.trigger.channelId, "reminders");
    assert.equal(value.content.channelId, undefined);
  }
});

test("bottle reminders request permission after onboarding was skipped and use the Android channel", async () => {
  const events = [],
    scheduled = [];
  let granted = false;
  const service = load("src/notificationService.js", {
    "expo-notifications": {
      setNotificationHandler: () => {},
      AndroidImportance: { HIGH: 4 },
      setNotificationChannelAsync: async (id) => events.push(id),
      getPermissionsAsync: async () => ({ granted }),
      requestPermissionsAsync: async () => {
        events.push("request");
        return { granted };
      },
      SchedulableTriggerInputTypes: { DAILY: "daily" },
      scheduleNotificationAsync: async (value) => {
        scheduled.push(value);
        return "bottle-id";
      },
    },
    "expo-constants": {},
    "react-native": { Platform: { OS: "android" } },
    "@react-native-async-storage/async-storage": {
      getItem: async () => null,
      removeItem: async () => {},
      setItem: async () => {},
    },
  });
  assert.equal(await service.requestBottleReminderPermission(), false);
  assert.deepEqual(events, ["default", "request"]);
  granted = true;
  assert.equal(await service.requestBottleReminderPermission(), true);
  assert.equal(events.filter((e) => e === "request").length, 1);
  await service.scheduleBottleReminders([{ hour: 8, minute: 30 }], "Sprout");
  assert.deepEqual(scheduled[0].trigger, {
    type: "daily",
    channelId: "default",
    hour: 8,
    minute: 30,
  });
});
