import React, { useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useFoodDraft } from "../useFoodDraft";
import { useTheme, useStyles } from "../ThemeContext";
import { Icon, ReactionFace } from "./Icon";
import { PickerModal } from "./PickerModal";
import { DateField } from "./DatePickerModal";
import {
  CATEGORIES,
  FORMS,
  REACTIONS,
  MEAL_TIMES,
  ALLERGENS,
} from "../constants";
import { pickImageAsBase64 } from "../helpers";

const EMPTY_FORM = {
  name: "",
  categories: [],
  category: "",
  categoryOther: "",
  form: "",
  reaction: "",
  notes: "",
  favourite: false,
  ml: "",
  photoUri: "",
  mealTime: "",
  allergens: [],
};
export function localFoodDate(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
export function foodCategories(entry) {
  if (Array.isArray(entry.categories) && entry.categories.length)
    return [...entry.categories];
  return entry.category
    ? Array.isArray(entry.category)
      ? [...entry.category]
      : [entry.category]
    : [];
}

export function FoodForm({
  onSubmit,
  initial = {},
  buttonLabel = "Add to Log",
  isPro = false,
  recentFoods = [],
  draftKey,
}) {
  const { C } = useTheme();
  const s = useStyles();
  const [form, setForm] = useState(() => ({
    ...EMPTY_FORM,
    date: localFoodDate(),
    ...initial,
    categories: foodCategories(initial),
  }));
  const draft = useFoodDraft(
    !initial.id ? draftKey : null,
    form,
    setForm,
    initial,
  );
  const [showDate, setShowDate] = useState(false);
  const [showTexture, setShowTexture] = useState(false);
  const [showAllergens, setShowAllergens] = useState(
    !!initial.allergens?.length || initial.reaction === "Allergic",
  );
  const [showDetails, setShowDetails] = useState(
    !!(initial.notes || initial.photoUri || initial.mealTime),
  );
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const set = (key, value) => setForm((old) => ({ ...old, [key]: value }));
  const toggle = (key, value) =>
    setForm((old) => ({
      ...old,
      [key]: old[key].includes(value)
        ? old[key].filter((item) => item !== value)
        : [...old[key], value],
    }));
  const isLiquids = form.categories.includes("Liquids");
  const recent = [...recentFoods]
    .sort((a, b) =>
      `${b.date || ""} ${b.time || ""}`.localeCompare(
        `${a.date || ""} ${a.time || ""}`,
      ),
    )
    .filter(
      (entry, index, entries) =>
        entry.name?.trim() &&
        entries.findIndex(
          (other) =>
            other.name?.trim().toLowerCase() ===
            entry.name.trim().toLowerCase(),
        ) === index,
    )
    .filter(
      (entry) =>
        !form.name.trim() ||
        entry.name.toLowerCase().includes(form.name.trim().toLowerCase()),
    )
    .slice(0, 5);
  const selectRecentFood = (entry) => {
    const categories = foodCategories(entry);
    // Copy food details only. Today's reaction, amount and memory must be recorded afresh.
    setForm((old) => ({
      ...old,
      name: entry.name,
      categories,
      category: categories[0] || "",
      categoryOther: entry.categoryOther || "",
      form: entry.form || "",
      allergens: [...(entry.allergens || [])],
      reaction: "",
      ml: "",
    }));
    setShowAllergens(true);
  };
  const clearEntry = () =>
    Alert.alert(
      "Clear this entry?",
      "This resets the form. A saved entry will only change when you tap Save.",
      [
        { text: "Keep editing", style: "cancel" },
        {
          text: "Clear fields",
          style: "destructive",
          onPress: () => {
            // Retain identity when editing; autosave removes an empty new-entry draft.
            setForm({
              ...initial,
              ...EMPTY_FORM,
              date: localFoodDate(),
              ...(initial.id && {
                isAllergenCheckin: false,
                allergenCheckIns: [],
              }),
            });
            setShowDate(false);
            setShowTexture(false);
            setShowAllergens(false);
            setShowDetails(false);
          },
        },
      ],
    );
  const save = async () => {
    if (saving.current || !draft.ready) return;
    if (!form.name.trim() || !form.date || !form.categories.length) {
      onSubmit(
        null,
        "Add a food name and choose at least one category. Check the date too.",
      );
      return;
    }
    saving.current = true;
    setBusy(true);
    try {
      const result = await onSubmit({
        ...form,
        name: form.name.trim(),
        category: form.categories[0],
        categoryOther: form.categories.includes("Other")
          ? form.categoryOther.trim()
          : "",
        ml: isLiquids ? form.ml || "" : "",
        allergens: form.allergens || [],
      });
      if (result !== false && !initial.id) {
        const cleared = await draft.clear();
        if (!cleared)
          Alert.alert(
            "Entry saved",
            "Its local draft could not be removed. If it reappears, do not save it again.",
          );
        setForm({ ...EMPTY_FORM, date: localFoodDate() });
        setShowDetails(false);
        setShowAllergens(false);
        setShowDate(false);
      }
    } catch {
      Alert.alert(
        "Your entry is still here",
        "We couldn't save it. Please try again.",
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  const hint = {
    color: C.mutedText,
    fontFamily: "NunitoSans_400Regular",
    fontSize: 12,
    lineHeight: 18,
  };
  const row = {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 12,
  };
  const chip = (
    label,
    selected,
    onPress,
    key = label,
    accessibilityLabel = label,
  ) => (
    <TouchableOpacity
      key={key}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        minHeight: 44,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: selected ? C.primaryPurple : C.borderLight,
        backgroundColor: selected ? C.bgPurple : C.white,
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          fontFamily: "NunitoSans_700Bold",
          color: C.textCharcoal,
          fontSize: 13,
        }}
      >
        {selected ? "✓ " : ""}
        {label}
      </Text>
    </TouchableOpacity>
  );
  return (
    <View style={{ gap: 18 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        {!!draftKey && (
          <Text style={[hint, { flex: 1 }]} accessibilityLiveRegion="polite">
            {!draft.ready
              ? "Checking for an unfinished entry…"
              : draft.status || "Unfinished entries are kept on this phone."}
          </Text>
        )}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Clear entry"
          disabled={busy || !draft.ready}
          onPress={clearEntry}
          style={{
            marginLeft: "auto",
            flexShrink: 0,
            minHeight: 44,
            justifyContent: "center",
            paddingHorizontal: 4,
          }}
        >
          <Text
            style={{ color: C.primaryPurple, fontFamily: "NunitoSans_700Bold" }}
          >
            Clear entry
          </Text>
        </TouchableOpacity>
      </View>
      <View
        pointerEvents={busy || !draft.ready ? "none" : "auto"}
        style={{ gap: 18 }}
      >
        <View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Change food date"
            accessibilityState={{ expanded: showDate }}
            onPress={() => setShowDate(!showDate)}
            style={row}
          >
            <Text
              style={{
                color: C.primaryPinkDark,
                fontSize: 18,
                fontFamily: "NunitoSans_700Bold",
              }}
            >
              {form.date === localFoodDate() ? "Today" : form.date}
            </Text>
            <Text
              style={{
                color: C.primaryPurple,
                fontFamily: "NunitoSans_700Bold",
              }}
            >
              {showDate ? "Done" : "Change date"}
            </Text>
          </TouchableOpacity>
          {showDate && (
            <DateField
              label="Date"
              value={form.date}
              onChange={(value) => set("date", value)}
              minYear={2020}
              maxYear={new Date().getFullYear() + 1}
            />
          )}
        </View>
        <View>
          <Text style={s.label}>What did they try?</Text>
          <TextInput
            accessibilityLabel="Food or drink name"
            value={form.name}
            onChangeText={(value) => set("name", value)}
            placeholder="e.g. Banana or porridge"
            placeholderTextColor={C.mutedText}
            style={[s.input, { backgroundColor: C.white }]}
            autoCorrect={false}
            autoComplete="off"
          />
          {!initial.id && recent.length > 0 && (
            <View style={{ gap: 8, marginTop: 12 }}>
              <Text style={hint}>Log again · tap to reuse food details</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {recent.map((entry) =>
                  chip(
                    entry.name,
                    false,
                    () => selectRecentFood(entry),
                    entry.id || entry.name,
                  ),
                )}
              </View>
            </View>
          )}
        </View>
        <View>
          <Text style={s.label}>Food group</Text>
          <Text style={[hint, { marginBottom: 8 }]}>
            Choose one or more for mixed meals.
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {CATEGORIES.map((category) =>
              chip(
                category.value,
                form.categories.includes(category.value),
                () => toggle("categories", category.value),
              ),
            )}
          </View>
        </View>
        {form.categories.includes("Other") && (
          <View>
            <Text style={s.label}>Food type (optional)</Text>
            <TextInput
              accessibilityLabel="Other food type"
              value={form.categoryOther}
              onChangeText={(value) => set("categoryOther", value)}
              maxLength={100}
              placeholder="e.g. Homemade mixed meal"
              placeholderTextColor={C.mutedText}
              style={s.input}
            />
          </View>
        )}
        {isLiquids && (
          <View>
            <Text style={s.label}>Amount in ml (optional)</Text>
            <TextInput
              accessibilityLabel="Amount in ml"
              value={String(form.ml || "")}
              onChangeText={(value) => set("ml", value.replace(/[^0-9]/g, ""))}
              placeholder="e.g. 120"
              keyboardType="number-pad"
              placeholderTextColor={C.mutedText}
              style={s.input}
            />
          </View>
        )}
        <View>
          <Text style={s.label}>How did it go?</Text>
          <Text style={[hint, { marginBottom: 8 }]}>
            Optional — you can update this later.
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {REACTIONS.map((reaction) => (
              <TouchableOpacity
                key={reaction.value}
                accessibilityRole="button"
                accessibilityLabel={`Reaction: ${reaction.value}`}
                accessibilityState={{
                  selected: form.reaction === reaction.value,
                }}
                onPress={() => {
                  set(
                    "reaction",
                    form.reaction === reaction.value ? "" : reaction.value,
                  );
                  if (reaction.value === "Allergic") setShowAllergens(true);
                }}
                style={{
                  flex: 1,
                  minWidth: 48,
                  alignItems: "center",
                  gap: 5,
                  paddingVertical: 10,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor:
                    form.reaction === reaction.value
                      ? reaction.border
                      : C.borderLight,
                  backgroundColor:
                    form.reaction === reaction.value ? reaction.bg : C.white,
                }}
              >
                <ReactionFace reaction={reaction.value} size={28} />
                <Text
                  style={{
                    fontSize: 10,
                    fontFamily: "NunitoSans_700Bold",
                    color:
                      form.reaction === reaction.value
                        ? reaction.color
                        : C.textCharcoal,
                  }}
                >
                  {reaction.value}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Choose texture"
          onPress={() => setShowTexture(true)}
          style={row}
        >
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Texture</Text>
            <Text
              style={{
                color: form.form ? C.textCharcoal : C.mutedText,
                fontFamily: form.form
                  ? "NunitoSans_700Bold"
                  : "NunitoSans_400Regular",
                fontSize: 17,
                lineHeight: 24,
              }}
            >
              {form.form || "Optional · how was it served?"}
            </Text>
          </View>
          <Icon name="chevDown" size={16} color={C.primaryPurple} />
        </TouchableOpacity>
        <PickerModal
          visible={showTexture}
          title="How was it served?"
          optionFontSize={17}
          options={["Not recorded", ...FORMS]}
          value={form.form || "Not recorded"}
          onSelect={(value) =>
            set("form", value === "Not recorded" ? "" : value)
          }
          onClose={() => setShowTexture(false)}
        />
        <View
          style={{
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: C.borderLight,
          }}
        >
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Check allergens"
            accessibilityState={{ expanded: showAllergens }}
            onPress={() => setShowAllergens(!showAllergens)}
            style={row}
          >
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Allergens</Text>
              <Text
                style={{
                  ...hint,
                  fontSize: form.allergens.length ? 15 : 13,
                  lineHeight: 22,
                  color: form.allergens.length ? C.textCharcoal : C.mutedText,
                }}
              >
                {form.allergens.length
                  ? form.allergens.join(" · ")
                  : "Add any allergens in this food"}
              </Text>
            </View>
            <Text style={{ color: C.primaryPurple }}>
              {showAllergens ? "Close" : "Check"}
            </Text>
          </TouchableOpacity>
          {showAllergens && (
            <View style={{ gap: 8, paddingBottom: 14 }}>
              <Text style={hint}>
                Check the ingredients each time, especially when reusing a food.
                Leaving this blank means no allergens were recorded.
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {ALLERGENS.map((allergen) =>
                  chip(
                    allergen.value,
                    form.allergens.includes(allergen.value),
                    () => toggle("allergens", allergen.value),
                    allergen.value,
                    `Allergen: ${allergen.value}`,
                  ),
                )}
              </View>
            </View>
          )}
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="More food details"
          accessibilityState={{ expanded: showDetails }}
          onPress={() => setShowDetails(!showDetails)}
          style={row}
        >
          <View style={{ flex: 1 }}>
            <Text style={s.label}>
              {showDetails ? "Fewer details" : "More details"}
            </Text>
            <Text style={hint}>Notes, meal time & photo</Text>
          </View>
          <Icon name="chevDown" size={16} color={C.primaryPurple} />
        </TouchableOpacity>
        {showDetails && (
          <View style={{ gap: 18 }}>
            <View>
              <Text style={s.label}>Notes (optional)</Text>
              <TextInput
                accessibilityLabel="Food notes"
                value={form.notes}
                onChangeText={(value) => set("notes", value)}
                placeholder="Anything you'd like to remember…"
                multiline
                style={[s.input, { minHeight: 80, textAlignVertical: "top" }]}
                placeholderTextColor={C.mutedText}
              />
            </View>
            <View>
              <Text style={s.label}>
                Meal time {isPro ? "(optional)" : "· Pro"}
              </Text>
              {isPro ? (
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}
                >
                  {MEAL_TIMES.map((meal) =>
                    chip(meal.value, form.mealTime === meal.value, () =>
                      set(
                        "mealTime",
                        form.mealTime === meal.value ? "" : meal.value,
                      ),
                    ),
                  )}
                </View>
              ) : (
                <Text style={hint}>
                  {form.mealTime
                    ? `${form.mealTime} · saved on this entry. `
                    : ""}
                  Meal-time tracking is available with Pro.
                </Text>
              )}
            </View>
            <View>
              <Text style={s.label}>
                Memory photo {isPro ? "(optional)" : "· Pro"}
              </Text>
              {!!form.photoUri && (
                <Image
                  source={{ uri: form.photoUri }}
                  style={{
                    width: "100%",
                    height: 160,
                    borderRadius: 14,
                    marginBottom: 8,
                  }}
                />
              )}
              {isPro ? (
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                >
                  {chip(
                    form.photoUri ? "Change photo" : "Add photo",
                    false,
                    async () => {
                      try {
                        const uri = await pickImageAsBase64([4, 3]);
                        if (uri) set("photoUri", uri);
                      } catch {
                        Alert.alert(
                          "Could not open photos",
                          "Please try again.",
                        );
                      }
                    },
                  )}
                  {!!form.photoUri &&
                    chip("Remove photo", false, () => set("photoUri", ""))}
                </View>
              ) : (
                <Text style={hint}>Photo memories are available with Pro.</Text>
              )}
            </View>
          </View>
        )}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Favourite"
          accessibilityState={{ selected: form.favourite }}
          onPress={() => set("favourite", !form.favourite)}
          style={[
            s.btnPrimary,
            {
              minHeight: 52,
              flexDirection: "row",
              gap: 8,
              backgroundColor: form.favourite ? "#fff1b8" : "#fff9e5",
              shadowColor: "#a77908",
            },
          ]}
        >
          <Icon
            name={form.favourite ? "starFill" : "star"}
            size={20}
            color="#a77908"
          />
          <Text
            style={[s.btnPrimaryText, { color: "#795a0c", lineHeight: 22 }]}
          >
            Favourite
          </Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={buttonLabel}
        accessibilityState={{ disabled: busy || !draft.ready, busy }}
        disabled={busy || !draft.ready}
        onPress={save}
        style={[s.btnPrimary, { minHeight: 52, opacity: busy ? 0.7 : 1 }]}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={[s.btnPrimaryText, { lineHeight: 22 }]}>
            {buttonLabel}
          </Text>
        )}
      </TouchableOpacity>
      <Text style={[hint, { textAlign: "center" }]}>
        Only a name and food group are needed. Add more whenever you like.
      </Text>
    </View>
  );
}
