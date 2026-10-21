const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const babel = require("@babel/core");
function evaluate(file, imports = {}) {
  const output = babel.transformSync(fs.readFileSync(file, "utf8"), {
    filename: file,
    configFile: false,
    babelrc: false,
    plugins: [
      "@babel/plugin-transform-react-jsx",
      "@babel/plugin-transform-modules-commonjs",
    ],
  }).code;
  const exports = {};
  new Function("require", "exports", output)((name) => {
    if (name.endsWith(".png")) return "logo";
    if (name in imports) return imports[name];
    throw new Error(`Unexpected import ${name}`);
  }, exports);
  return exports;
}
const model = evaluate("src/onboardingModel.js");
test("child validation rejects missing, impossible and future birthdays", () => {
  const now = new Date("2026-10-17T12:00:00");
  for (const data of [
    {},
    { name: "A", dob: "" },
    { name: "A", dob: "2026-02-30" },
    { name: "A", dob: "2026-10-18" },
    { name: "A", dob: "2026-01-01", weaningStart: "2025-12-01" },
  ])
    assert.ok(model.validateChildProfile(data, now));
  assert.equal(
    model.validateChildProfile(
      { name: "A", dob: "2026-01-01", weaningStart: "2026-06-01" },
      now,
    ),
    null,
  );
});
test("dashboard preferences reflect stage, milk choice, priority and known allergies", () => {
  assert.deepEqual(
    model.dashboardPreferences({
      weaningStage: "not_started",
      trackMilk: false,
    }),
    { showMilk: false, showAllergens: false },
  );
  assert.deepEqual(
    model.dashboardPreferences({
      weaningStage: "not_started",
      trackMilk: false,
      priority: "milk",
      allergyStatus: "yes",
    }),
    { showMilk: true, showAllergens: true },
  );
  assert.equal(
    model.dashboardPreferences({
      weaningStage: "not_started",
      priority: "allergens",
    }).showAllergens,
    true,
  );
});
function harness(props = {}) {
  const hooks = [];
  let cursor = 0;
  let failCommit = false;
  let failUpload = false;
  const writes = [],
    batches = [],
    alerts = [],
    uploads = [],
    permissionCalls = [];
  const React = {
    createElement: (type, props, ...children) => ({
      type,
      props: { ...props, children },
    }),
    useState: (initial) => {
      const index = cursor++;
      if (!(index in hooks))
        hooks[index] = typeof initial === "function" ? initial() : initial;
      return [
        hooks[index],
        (next) => {
          hooks[index] = typeof next === "function" ? next(hooks[index]) : next;
        },
      ];
    },
    useRef: (initial) => {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = { current: initial };
      return hooks[index];
    },
  };
  const native = Object.fromEntries(
    [
      "View",
      "Text",
      "TextInput",
      "TouchableOpacity",
      "ScrollView",
      "KeyboardAvoidingView",
      "Image",
      "ActivityIndicator",
    ].map((key) => [key, key]),
  );
  Object.assign(native, {
    Platform: { OS: "ios" },
    StyleSheet: { create: (v) => v },
    Keyboard: { dismiss() {} },
    Alert: { alert: (...args) => alerts.push(args) },
  });
  const firebase = {
    doc: (...args) => ({
      path: args.slice(1).join("/"),
      id: args.length === 1 ? "stable-child-id" : args.at(-1),
    }),
    collection: (_db, name) => name,
    updateDoc: async (ref, data) => writes.push({ ref, data }),
    deleteField: () => "__DELETE__",
    serverTimestamp: () => "__TIMESTAMP__",
    writeBatch: () => {
      const operations = [];
      return {
        set: (...args) => operations.push(["set", ...args]),
        update: (...args) => operations.push(["update", ...args]),
        commit: async () => {
          batches.push(operations);
          if (failCommit) throw new Error("offline");
        },
      };
    },
  };
  const { OnboardingScreen } = evaluate("src/screens/OnboardingScreen.js", {
    react: React,
    "react-native": native,
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" },
    "firebase/firestore": firebase,
    "firebase/auth": { updateProfile: async () => {} },
    "@react-native-async-storage/async-storage": { multiSet: async () => {} },
    "expo-notifications": {
      getPermissionsAsync: async () => ({ granted: true }),
    },
    "../firebase": { db: {} },
    "../ThemeContext": { useTheme: () => ({ C: {} }) },
    "../components/DatePickerModal": { DateField: "DateField" },
    "../helpers": { pickImageAsBase64: async () => "file://photo.jpg" },
    "../firebaseHooks": {
      uploadPhotoIfBase64: async (uri, path) => {
        uploads.push({ uri, path });
        if (failUpload && uri) throw new Error("Upload failed");
        return uri ? "https://example.test/photo.jpg" : "";
      },
    },
    "../notificationService": {
      getExpoPushToken: async () => {
        permissionCalls.push(true);
        return "token";
      },
    },
    "../components/FeedingJourneyFields": {
      Choice: "Choice",
      FieldHeading: "FieldHeading",
      FeedingJourneyFields: "FeedingJourneyFields",
      PriorityChoices: "PriorityChoices",
    },
    "../onboardingModel": model,
    "./OnboardingCompleteScreen": {
      OnboardingCompleteScreen: "OnboardingCompleteScreen",
    },
  });
  const render = () => {
    cursor = 0;
    return OnboardingScreen({ user: { uid: "parent" }, ...props });
  };
  const flat = (node) =>
    Array.isArray(node)
      ? node.flatMap(flat)
      : node && typeof node === "object"
        ? [node, ...flat(node.props?.children)]
        : [];
  const text = (node) =>
    Array.isArray(node)
      ? node.map(text).join("")
      : node && typeof node === "object"
        ? text(node.props?.children)
        : typeof node === "string"
          ? node
          : "";
  const find = (predicate) => flat(render()).find(predicate);
  const next = () =>
    find(
      (n) =>
        n.type === "TouchableOpacity" &&
        /Continue →|Make it mine →|Let's grow together/.test(text(n)),
    ).props.onPress();
  return {
    render,
    find,
    next,
    writes,
    batches,
    alerts,
    uploads,
    permissionCalls,
    failCommit: (v) => {
      failCommit = v;
    },
    failUpload: (v) => {
      failUpload = v;
    },
  };
}
const complete = {
  parentName: "Jamie",
  parentPhoto: "",
  name: "Sprout",
  dob: "2026-01-01",
  weaningStart: "",
  photoUri: "",
  weaningStage: "starting",
  feedingApproach: "mixed",
  trackMilk: true,
  allergyStatus: "yes",
  knownAllergens: ["Dairy"],
  otherAllergies: "",
  priority: "allergens",
  notifications: "later",
};
test("welcome asks for no personal information and does not request notifications", async () => {
  const h = harness();
  assert.equal(
    h.find((n) => n.type === "TextInput"),
    undefined,
  );
  assert.equal(h.permissionCalls.length, 0);
  await h.next();
  assert.equal(h.writes[0].data.onboardingDraft.step, 1);
});
test("required parent name prevents advancing", async () => {
  const h = harness({ userDoc: { onboardingDraft: { step: 1 } } });
  await h.next();
  assert.equal(h.writes.length, 0);
  assert.equal(h.alerts.length, 1);
});
test("resuming a child draft retains fields and stable child ID", async () => {
  const h = harness({
    userDoc: {
      onboardingDraft: { step: 2, childId: "draft-child", data: complete },
    },
  });
  assert.equal(h.find((n) => n.type === "TextInput").props.value, "Sprout");
  await h.next();
  assert.equal(h.writes[0].data.onboardingDraft.childId, "draft-child");
  assert.equal(h.writes[0].data.onboardingDraft.step, 3);
});
test("photo upload failure keeps the user on the same step without losing the photo", async () => {
  const h = harness({
    userDoc: {
      onboardingDraft: {
        step: 1,
        data: { ...complete, parentPhoto: "file://photo.jpg" },
      },
    },
  });
  h.failUpload(true);
  await h.next();
  assert.equal(h.writes.length, 0);
  assert.equal(h.alerts.length, 1);
  h.failUpload(false);
  await h.next();
  assert.equal(
    h.writes[0].data.onboardingDraft.data.parentPhoto,
    "https://example.test/photo.jpg",
  );
});
test("finish atomically saves child/profile/preferences; retry never creates another child", async () => {
  const h = harness({
    userDoc: {
      onboardingDraft: { step: 4, childId: "draft-child", data: complete },
    },
  });
  h.failCommit(true);
  await h.next();
  h.failCommit(false);
  await h.next();
  assert.equal(h.batches.length, 2);
  for (const batch of h.batches) {
    assert.equal(batch[0][1].path, "children/draft-child");
    assert.deepEqual(batch[0][2].knownAllergens, ["Dairy"]);
    assert.equal(batch[0][2].feedingApproach, "mixed");
    assert.equal(batch[1][2].name, "Jamie");
    assert.equal(batch[1][2].onboardingComplete, true);
    assert.deepEqual(batch[1][2].onboardingWelcome, {
      childName: "Sprout",
      priority: "allergens",
    });
    assert.equal(batch[1][2].onboardingDraft, "__DELETE__");
    assert.equal(batch[1][2].notificationPreference, "later");
    assert.equal(batch[1][2].pushToken, "__DELETE__");
    assert.deepEqual(batch[1][2].dashboardPreferences, {
      showMilk: true,
      showAllergens: true,
    });
  }
  assert.equal(h.permissionCalls.length, 0);
});
test("preview advances without database writes or notification prompts", async () => {
  const h = harness({ preview: true });
  await h.next();
  assert.equal(h.writes.length, 0);
  assert.equal(h.batches.length, 0);
  assert.equal(h.permissionCalls.length, 0);
  assert.ok(h.find((n) => n.type === "TextInput"));
});
test("known allergies never appear as untried foods or check-in reminders", () => {
  const helpers = evaluate("src/helpers.js", {
    "react-native": {},
    "expo-image-picker": {},
    "expo-file-system": {},
    "firebase/storage": {},
    "./firebase": {},
    "./constants": {},
    "./milestones": {},
    "./allergenCheckIn": require("./support/appHarness.cjs")().load(
      "src/allergenCheckIn.js",
    ),
  });
  const values = helpers.computeAllergenStatus(
    [],
    [{ value: "Dairy" }, { value: "Eggs" }],
    ["Dairy"],
  );
  assert.equal(values[0].status, "Known Allergy");
  assert.equal(values[0].needsCheckIn, false);
  assert.equal(values[0].count, 0);
  assert.equal(values[1].status, "Not Tried");
});
test("all five screens complete through their UI callbacks and preserve answers when going back", async () => {
  const h = harness();
  await h.next();
  h.find((n) => n.type === "TextInput").props.onChangeText("Jamie");
  await h.next();
  h.find((n) => n.type === "TextInput").props.onChangeText("Sprout");
  h.find(
    (n) => n.type === "DateField" && n.props.label === "Date of birth",
  ).props.onChange("2026-01-01");
  await h.next();
  const journey = h.find((n) => n.type === "FeedingJourneyFields");
  journey.props.onChange({
    ...journey.props.value,
    weaningStage: "not_started",
    feedingApproach: "unsure",
    trackMilk: true,
    allergyStatus: "no",
  });
  h.find((n) => n.props.accessibilityLabel === "Previous step").props.onPress();
  assert.equal(h.find((n) => n.type === "TextInput").props.value, "Sprout");
  await h.next();
  await h.next();
  h.find((n) => n.type === "PriorityChoices").props.onChange("milk");
  await h.next();
  assert.equal(h.batches.length, 1);
  const child = h.batches[0][0][2],
    parent = h.batches[0][1][2];
  assert.equal(child.name, "Sprout");
  assert.equal(child.weaningStage, "not_started");
  assert.deepEqual(child.knownAllergens, []);
  assert.equal(parent.name, "Jamie");
  assert.equal(parent.onboardingPriority, "milk");
  assert.deepEqual(parent.dashboardPreferences, {
    showMilk: true,
    showAllergens: false,
  });
});
test("completion copy follows each priority and includes the child name", () => {
  const titles = new Set();
  for (const priority of ["food", "milk", "allergens", "recipes"]) {
    const message = model.completionMessage(priority, "Eleia");
    assert.ok(message.body.includes("Eleia"));
    titles.add(message.title);
  }
  assert.equal(titles.size, 4);
  assert.ok(
    model.completionMessage(null, "").body.includes("your little sprout"),
  );
});
test("completion CTA clears only the welcome marker, allowing Root to open the dashboard", async () => {
  const writes = [],
    alerts = [];
  let shouldFail = true;
  const React = {
    createElement: (type, props, ...children) => ({
      type,
      props: { ...props, children },
    }),
    useState: () => [false, () => {}],
    useRef: (value) => ({ current: value }),
  };
  const native = Object.fromEntries(
    [
      "View",
      "Text",
      "Image",
      "TouchableOpacity",
      "ScrollView",
      "ActivityIndicator",
    ].map((key) => [key, key]),
  );
  native.Alert = { alert: (...args) => alerts.push(args) };
  const { OnboardingCompleteScreen } = evaluate(
    "src/screens/OnboardingCompleteScreen.js",
    {
      react: React,
      "react-native": native,
      "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" },
      "firebase/firestore": {
        doc: (_db, collection, uid) => `${collection}/${uid}`,
        deleteField: () => "__DELETE__",
        updateDoc: async (...args) => {
          if (shouldFail) throw new Error("offline");
          writes.push(args);
        },
      },
      "../firebase": { db: {} },
      "../ThemeContext": { useTheme: () => ({ C: {} }) },
      "../onboardingModel": model,
    },
  );
  const flatten = (node) =>
    Array.isArray(node)
      ? node.flatMap(flatten)
      : node && typeof node === "object"
        ? [node, ...flatten(node.props.children)]
        : [];
  const render = (extra = {}) =>
    flatten(
      OnboardingCompleteScreen({
        user: { uid: "parent" },
        priority: "milk",
        childName: "Eleia",
        ...extra,
      }),
    ).find((n) => n.props.accessibilityLabel === "Let's go to my dashboard");
  await render().props.onPress();
  assert.equal(alerts.length, 1);
  assert.equal(writes.length, 0);
  shouldFail = false;
  await render().props.onPress();
  assert.deepEqual(writes, [
    ["users/parent", { onboardingWelcome: "__DELETE__" }],
  ]);
  let finished = false;
  await render({
    onPreviewFinish: () => {
      finished = true;
    },
  }).props.onPress();
  assert.equal(finished, true);
  assert.equal(writes.length, 1);
});
