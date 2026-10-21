const { test } = require("node:test");
const assert = require("node:assert/strict");
const harness = require("./support/appHarness.cjs");
const h = harness("ios", {
  "expo-notifications": {
    SchedulableTriggerInputTypes: { DATE: "date", DAILY: "daily" },
  },
});
const calendar = h.load("src/activityCalendar.js");
const { allergenCheckIn, exposureTime, hasAllergenCheckIn } = h.load(
  "src/allergenCheckIn.js",
);
const { allergenReminderPlan, createReminderSync, notificationsAllowed } =
  h.load("src/reminderSync.js");
const base = {
  userId: "parent",
  enabled: true,
  allergensEnabled: true,
  now: new Date("2026-10-21T12:00:00").getTime(),
  children: [{ id: "child", name: "Sprout" }],
  foodLog: [
    {
      id: "food",
      childId: "child",
      date: "2026-10-20",
      time: "16:30",
      allergens: ["Dairy"],
      reaction: "Good",
    },
  ],
};
test("calendar counts food, milk and weight independently on local dates", () => {
  assert.deepEqual(
    calendar.activityByDay(
      [{ date: "2026-10-20" }, { date: "2026-10-20" }],
      [{ date: "2026-10-20" }, {}],
      [{ date: "2026-10-21" }],
    ),
    {
      "2026-10-20": { food: 2, milk: 1, weight: 0 },
      "2026-10-21": { food: 0, milk: 0, weight: 1 },
    },
  );
  assert.equal(calendar.localDay(new Date(2026, 9, 21, 0, 1)), "2026-10-21");
  const february = calendar.monthCells(2028, 1).filter(Boolean);
  assert.equal(february.length, 29);
  assert.equal(february[28], "2028-02-29");
  assert.equal(calendar.monthCells(2026, 10)[6], "2026-11-01");
});
test("allergen reminder is exactly 48 hours after the first entry, not midnight two days later", () => {
  const plan = allergenReminderPlan(base);
  assert.equal(plan.length, 1);
  assert.equal(
    plan[0].trigger.date.getTime(),
    exposureTime(base.foodLog[0]) + 48 * 3600000,
  );
  assert.equal(plan[0].content.data.childId, "child");
  assert.equal(plan[0].content.data.screen, "allergens");
  const logged = {
    date: "2026-10-20",
    loggedAt: new Date(2026, 9, 20, 20, 15).toISOString(),
  };
  assert.equal(exposureTime(logged), new Date(logged.loggedAt).getTime());
  assert.equal(
    exposureTime({ date: "2026-10-19" }),
    new Date("2026-10-19T12:00:00").getTime(),
  );
  const repeated = allergenReminderPlan({
    ...base,
    foodLog: [
      ...base.foodLog,
      { ...base.foodLog[0], id: "second", date: "2026-10-21" },
    ],
  });
  assert.equal(repeated.length, 1);
  assert.equal(repeated[0].key, plan[0].key);
});
test("known allergies, reactions, completed check-ins and overdue entries are not scheduled", () => {
  assert.equal(
    allergenReminderPlan({
      ...base,
      children: [{ id: "child", knownAllergens: ["Dairy"] }],
    }).length,
    0,
  );
  for (const patch of [
    { reaction: "Allergic" },
    { isAllergenCheckin: true },
    { date: "2026-01-01" },
  ])
    assert.equal(
      allergenReminderPlan({
        ...base,
        foodLog: [{ ...base.foodLog[0], ...patch }],
      }).length,
      0,
    );
  assert.equal(allergenReminderPlan({ ...base, children: [] }).length, 0);
  assert.equal(allergenReminderPlan({ ...base, foodLog: [] }).length, 0);
});
test("checking in on one allergen in a mixed meal leaves the other check-in pending", () => {
  const entry = {
    ...base.foodLog[0],
    allergens: ["Dairy", "Eggs"],
    allergenCheckIns: ["Dairy"],
    isAllergenCheckin: false,
  };
  assert.equal(hasAllergenCheckIn(entry, "Dairy"), true);
  assert.equal(hasAllergenCheckIn(entry, "Eggs"), false);
  assert.equal(allergenCheckIn([entry], "Dairy"), null);
  assert.ok(allergenCheckIn([entry], "Eggs"));
  assert.deepEqual(
    allergenReminderPlan({ ...base, foodLog: [entry] }).map(
      (item) => item.content.data.allergen,
    ),
    ["Eggs"],
  );
});
function fakeNotifications() {
  let pending = [];
  let id = 0;
  const api = {
    granted: true,
    SchedulableTriggerInputTypes: { DAILY: "daily" },
    getPermissionsAsync: async () => ({ granted: api.granted }),
    getAllScheduledNotificationsAsync: async () => [...pending],
    cancelAllScheduledNotificationsAsync: async () => {
      pending = [];
    },
    cancelScheduledNotificationAsync: async (identifier) => {
      pending = pending.filter((item) => item.identifier !== identifier);
    },
    scheduleNotificationAsync: async (item) => {
      const identifier = String(++id);
      pending.push({ ...item, identifier });
      return identifier;
    },
  };
  return api;
}
test("reconciliation is idempotent, updates edits and cancels deleted/disabled reminders", async () => {
  const api = fakeNotifications();
  const sync = createReminderSync(api);
  await sync(base);
  const first = await api.getAllScheduledNotificationsAsync();
  await sync(base);
  assert.deepEqual(await api.getAllScheduledNotificationsAsync(), first);
  await sync({ ...base, foodLog: [{ ...base.foodLog[0], time: "18:00" }] });
  const changed = await api.getAllScheduledNotificationsAsync();
  assert.equal(changed.length, 1);
  assert.notEqual(changed[0].identifier, first[0].identifier);
  await sync({ ...base, foodLog: [] });
  assert.equal((await api.getAllScheduledNotificationsAsync()).length, 0);
  await sync(base);
  await sync({ ...base, enabled: false });
  assert.equal((await api.getAllScheduledNotificationsAsync()).length, 0);
  await sync(base);
  api.granted = false;
  await sync(base);
  assert.equal((await api.getAllScheduledNotificationsAsync()).length, 0);
});
test("bottle reminders coexist, deduplicate times and are removed on sign-out", async () => {
  const api = fakeNotifications();
  const sync = createReminderSync(api);
  const options = {
    ...base,
    bottleEnabled: true,
    bottleTimes: [
      { hour: 8, minute: 30 },
      { hour: 8, minute: 30 },
      { hour: 25, minute: 0 },
    ],
    childName: "Sprout",
  };
  await sync(options);
  assert.equal((await api.getAllScheduledNotificationsAsync()).length, 2);
  await sync({ ...options, allergensEnabled: false });
  const pending = await api.getAllScheduledNotificationsAsync();
  assert.equal(pending.length, 1);
  assert.equal(pending[0].trigger.type, "daily");
  await sync({});
  assert.equal((await api.getAllScheduledNotificationsAsync()).length, 0);
});
test("disabling during an in-flight schedule wins the race", async () => {
  const api = fakeNotifications();
  const original = api.scheduleNotificationAsync;
  let release, started;
  const began = new Promise((resolve) => {
    started = resolve;
  });
  api.scheduleNotificationAsync = async (item) => {
    started();
    await new Promise((resolve) => {
      release = resolve;
    });
    return original(item);
  };
  const sync = createReminderSync(api);
  const enabling = sync(base);
  await began;
  const disabling = sync({ enabled: false });
  release();
  await Promise.all([enabling, disabling]);
  assert.equal((await api.getAllScheduledNotificationsAsync()).length, 0);
});

test("master preference preserves legacy bottle reminders but explicit off always wins", () => {
  assert.equal(notificationsAllowed(undefined, true), true);
  assert.equal(notificationsAllowed("later", true), true);
  assert.equal(notificationsAllowed("disabled", true), false);
  assert.equal(notificationsAllowed("enabled", false), true);
  assert.equal(notificationsAllowed("later", false), false);
});

test("notification switches save user preferences and master off cancels local reminders", async () => {
  const writes = [];
  let cancelled = 0;
  const local = harness("ios", {
    "firebase/firestore": {
      doc: (_db, collection, id) => `${collection}/${id}`,
      updateDoc: async (path, patch) => writes.push({ path, patch }),
      deleteField: () => "DELETE",
    },
    "expo-notifications": {
      setNotificationHandler: () => {},
      getPermissionsAsync: async () => ({ granted: true, status: "granted" }),
      getExpoPushTokenAsync: async () => ({ data: "push-token" }),
      cancelAllScheduledNotificationsAsync: async () => {
        cancelled++;
      },
    },
  });
  const { GettingStartedPreferences } = local.load(
    "src/components/GettingStartedPreferences.js",
  );
  const nodes = local.render({
    type: GettingStartedPreferences,
    props: {
      user: { uid: "parent" },
      userDoc: { notificationPreference: "enabled" },
    },
  });
  const toggle = nodes.find(
    (node) => node.props?.accessibilityLabel === "Allow notifications",
  );
  await toggle.props.onValueChange(false);
  assert.equal(writes[0].path, "users/parent");
  assert.deepEqual(writes[0].patch, {
    notificationPreference: "disabled",
    pushToken: "DELETE",
  });
  assert.equal(cancelled, 1);
  await toggle.props.onValueChange(true);
  assert.deepEqual(writes[1].patch, {
    notificationPreference: "enabled",
    pushToken: "push-token",
  });
  await nodes
    .find(
      (node) =>
        node.props?.accessibilityLabel === "Allergen check-in reminders",
    )
    .props.onValueChange(true);
  assert.deepEqual(writes[2].patch, { allergenRemindersEnabled: true });
  assert.equal(
    nodes.some((node) => node === "Your starting point"),
    false,
  );
});

test("Android allergen and bottle reminders attach the notification channel to their triggers", async () => {
  const android = harness("android", {
    "expo-notifications": {
      SchedulableTriggerInputTypes: { DATE: "date", DAILY: "daily" },
    },
  }).load("src/reminderSync.js");
  const api = fakeNotifications();
  const channels = [];
  api.AndroidImportance = { HIGH: 4 };
  api.setNotificationChannelAsync = async (name) => channels.push(name);
  await android.createReminderSync(api)({
    ...base,
    bottleEnabled: true,
    bottleTimes: [{ hour: 8, minute: 30 }],
  });
  const pending = await api.getAllScheduledNotificationsAsync();
  assert.deepEqual(channels, ["default"]);
  assert.equal(pending.length, 2);
  for (const item of pending) {
    assert.equal(item.trigger.channelId, "default");
    assert.equal(item.content.channelId, undefined);
  }
});
