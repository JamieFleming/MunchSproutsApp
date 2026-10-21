import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  RefreshControl,
} from "react-native";
import { useTheme, useStyles } from "../ThemeContext";
import { Icon, CategoryIcon } from "../components/Icon";
import { DashboardPreferences } from "../components/DashboardPreferences";
import {
  DASHBOARD_COLOURS,
  dashboardSettings,
  dashboardDay,
  recentDashboardActivity,
} from "../dashboardModel";
import { PRIORITIES } from "../onboardingModel";
import {
  groupByFood,
  calcAgeWeeks,
  formatDate,
  formatTime,
  toMl,
  computeAllergenStatus,
  formatWeight,
  normalize,
} from "../helpers";
import { ALLERGENS } from "../constants";

// Small accents reuse the same SVG family as the food log.
const SECTION_ACCENTS = {
  "Recent activity": {
    icon: "clock",
    background: "#fbe9db",
    colour: "#8c5c38",
  },
  "Milk today": { icon: "bottle", background: "#dfeefa", colour: "#38698e" },
  "Allergen tracker": {
    icon: "shield",
    background: "#e8e0fa",
    colour: "#7655aa",
  },
  "Their food journey": {
    icon: "utensils",
    background: "#e0f1e8",
    colour: "#3d7055",
  },
  "A little inspiration": {
    icon: "chef",
    background: "#f9e1e9",
    colour: "#a65376",
  },
};
function DashboardAccent({ title }) {
  const accent = SECTION_ACCENTS[title];
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{
        width: 34,
        height: 34,
        borderRadius: 12,
        backgroundColor: accent.background,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <Icon name={accent.icon} size={19} color={accent.colour} />
    </View>
  );
}

export function DashboardScreen({
  child,
  foodLog = [],
  bottleLog = [],
  weightLog = [],
  weightPreference = "lbs",
  showMilkOnDashboard = true,
  showAllergenOnDashboard = true,
  preferences = {},
  onSavePreference,
  recipes = [],
  onNavigate,
  onNavigateToRecipe,
  onNavigateFiltered,
  refreshing,
  onRefresh,
  priority,
}) {
  const { C } = useTheme();
  const s = useStyles();
  const [customising, setCustomising] = useState(false);
  const settings = dashboardSettings({
    showMilk: showMilkOnDashboard,
    showAllergens: showAllergenOnDashboard,
    ...preferences,
  });
  const palette = DASHBOARD_COLOURS[settings.heroColour];
  const today = dashboardDay();
  const foodsToday = foodLog.filter(
    (entry) => entry.date === today && !entry.isAllergenCheckin,
  );
  const bottlesToday = bottleLog
    .filter((entry) => entry.date === today)
    .sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  const lastBottle = bottlesToday.at(-1);
  const milkTotal = Math.round(
    bottlesToday.reduce(
      (sum, entry) => sum + toMl(entry.amount, entry.unit),
      0,
    ),
  );
  const groups = Object.values(groupByFood(foodLog));
  const favourites = groups.filter((group) =>
    group.attempts.some((entry) => entry.favourite),
  ).length;
  const latestWeight = [...weightLog].sort((a, b) =>
    (b.date || "").localeCompare(a.date || ""),
  )[0];
  const allergens = computeAllergenStatus(
    foodLog,
    ALLERGENS,
    child?.knownAllergens || [],
  );
  const introduced = allergens.filter(
    (allergen) => allergen.status !== "Not Tried" && !allergen.isKnownAllergy,
  ).length;
  const checkIns = allergens.filter((allergen) => allergen.needsCheckIn);
  const known = [
    ...(child?.knownAllergens || []),
    child?.otherAllergies,
  ].filter(Boolean);
  const activity = recentDashboardActivity(
    foodLog,
    bottleLog,
    settings.showMilk,
  );
  const featured = recipes.filter((recipe) => recipe.featured);
  const recipe = featured.length
    ? featured[Math.floor(Date.now() / 86400000) % featured.length]
    : null;
  const start =
    PRIORITIES.find((item) => item.value === priority) || PRIORITIES[0];
  const weeks = child?.dob ? calcAgeWeeks(child.dob) : null;
  const muted = {
    color: C.mutedText,
    fontFamily: "NunitoSans_400Regular",
    fontSize: 13,
    lineHeight: 20,
  };
  const link = {
    color: C.primaryPurple,
    fontFamily: "NunitoSans_700Bold",
    fontSize: 13,
  };
  const row = {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  };
  const action = (label, page, primary = false) => (
    <TouchableOpacity
      key={label}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => onNavigate(child ? page : "children")}
      style={{
        flex: 1,
        minHeight: 48,
        borderRadius: 14,
        padding: 12,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: primary ? palette.accent : "rgba(255,255,255,0.75)",
      }}
    >
      <Text
        style={{
          color: primary ? "#fff" : palette.ink,
          fontFamily: "NunitoSans_800ExtraBold",
          fontSize: 14,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
  const heading = (title, page, label = "View all") => (
    <View style={[row, { marginBottom: 12 }]}>
      <View
        style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 9 }}
      >
        <DashboardAccent title={title} />
        <Text style={[s.sectionTitle, { flex: 1, fontSize: 16 }]}>{title}</Text>
      </View>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${title}`}
        onPress={() => onNavigate(page)}
        style={{ paddingVertical: 8 }}
      >
        <Text style={link}>{label} →</Text>
      </TouchableOpacity>
    </View>
  );
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ gap: 16, paddingBottom: 24 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={C.primaryPurple}
        />
      }
    >
      <View style={row}>
        <Text style={[muted, { flex: 1 }]}>
          Little moments, all in one place 🌱
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Customise dashboard"
          accessibilityState={{ expanded: customising }}
          onPress={() => setCustomising(!customising)}
          style={{ paddingVertical: 12 }}
        >
          <Text style={link}>{customising ? "Done" : "Customise"}</Text>
        </TouchableOpacity>
      </View>
      {customising && (
        <DashboardPreferences value={settings} onSave={onSavePreference} />
      )}
      <View
        testID="child-day-card"
        style={{
          backgroundColor: palette.background,
          borderRadius: 24,
          padding: 20,
          gap: 16,
        }}
      >
        {child ? (
          <>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="View child profile"
              onPress={() => onNavigate("childDetail")}
              style={row}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: palette.ink,
                    fontFamily: "NunitoSans_600SemiBold",
                    fontSize: 12,
                  }}
                >
                  {formatDate(today)}
                </Text>
                <Text
                  style={{
                    color: palette.ink,
                    fontFamily: "PlusJakartaSans_700Bold",
                    fontSize: 27,
                    marginTop: 4,
                  }}
                >
                  {child.name}'s day
                </Text>
                <Text
                  style={{ color: palette.ink, fontSize: 12, marginTop: 5 }}
                >
                  {weeks !== null ? `${weeks} weeks · ` : ""}View profile →
                </Text>
              </View>
              {child.photoUri ? (
                <Image
                  source={{ uri: child.photoUri }}
                  style={{ width: 56, height: 56, borderRadius: 28 }}
                />
              ) : (
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: "#ffffff88",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name="baby" size={26} color={palette.accent} />
                </View>
              )}
            </TouchableOpacity>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Open food log"
                onPress={() => onNavigate("log")}
                style={{
                  flex: 1,
                  minWidth: 110,
                  backgroundColor: "#ffffff80",
                  borderRadius: 16,
                  padding: 12,
                  gap: 4,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <CategoryIcon category="Fruits" size={32} />
                  <Text
                    style={{
                      color: palette.ink,
                      fontFamily: "NunitoSans_800ExtraBold",
                      fontSize: 34,
                    }}
                  >
                    {foodsToday.length}
                  </Text>
                </View>
                <Text style={{ color: palette.ink, fontSize: 12 }}>
                  food entries today
                </Text>
              </TouchableOpacity>
              {settings.showMilk && (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Open milk log"
                  onPress={() => onNavigate("bottle")}
                  style={{
                    flex: 1,
                    minWidth: 110,
                    backgroundColor: "#ffffff80",
                    borderRadius: 16,
                    padding: 12,
                    gap: 4,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <View
                      accessible={false}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 10,
                        backgroundColor: "#dfeefa",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon name="bottle" size={18} color="#38698e" />
                    </View>
                    <Text
                      style={{
                        color: palette.ink,
                        fontFamily: "NunitoSans_800ExtraBold",
                        fontSize: 34,
                      }}
                    >
                      {bottlesToday.length}
                    </Text>
                  </View>
                  <Text style={{ color: palette.ink, fontSize: 12 }}>
                    milk feeds today
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            {settings.showWeight && latestWeight && (
              <Text style={{ color: palette.ink, fontSize: 12 }}>
                Latest weight ·{" "}
                {formatWeight(latestWeight.value_kg, weightPreference)} ·{" "}
                {formatDate(latestWeight.date)}
              </Text>
            )}
            <View style={{ flexDirection: "row", gap: 10 }}>
              {priority === "milk" ? (
                <>
                  {action("Log milk", "bottle", true)}
                  {action("Log food", "add")}
                </>
              ) : (
                <>
                  {action("Log food", "add", true)}
                  {action("Log milk", "bottle")}
                </>
              )}
            </View>
            {(priority === "allergens" || priority === "recipes") && (
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => onNavigate(start.page)}
                style={{ paddingVertical: 4 }}
              >
                <Text
                  style={{
                    color: palette.ink,
                    fontFamily: "NunitoSans_700Bold",
                  }}
                >
                  {start.action} →
                </Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <>
            <Text
              style={{
                color: palette.ink,
                fontFamily: "PlusJakartaSans_700Bold",
                fontSize: 23,
              }}
            >
              Welcome, little sprout 🌱
            </Text>
            <Text style={{ color: palette.ink, lineHeight: 21 }}>
              Add your child's profile to make this space their own.
            </Text>
            {action("Add your child", "children", true)}
          </>
        )}
      </View>
      {child && settings.showAllergens && checkIns.length > 0 && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Open allergen check-ins"
          onPress={() => onNavigate("allergens")}
          style={[s.card, { borderColor: C.warningStroke }]}
        >
          <Text style={s.sectionTitle}>A little check-in</Text>
          <Text style={[muted, { marginTop: 6 }]}>
            Record any delayed reactions for{" "}
            {checkIns.map((item) => item.value).join(", ")}.
          </Text>
          <Text style={[link, { marginTop: 10 }]}>Open allergen tracker →</Text>
        </TouchableOpacity>
      )}
      {child && settings.showRecent && (
        <View style={s.card} testID="dashboard-recent">
          {heading("Recent activity", "log")}
          {activity.length ? (
            activity.map((entry) => (
              <TouchableOpacity
                key={`${entry.kind}-${entry.id}`}
                accessibilityRole="button"
                onPress={() =>
                  entry.kind === "milk"
                    ? onNavigate("bottle")
                    : onNavigateFiltered("log", "", normalize(entry.name))
                }
                style={[
                  row,
                  {
                    paddingVertical: 10,
                    borderTopWidth: 1,
                    borderColor: C.borderLight,
                  },
                ]}
              >
                <View
                  accessible={false}
                  importantForAccessibility="no-hide-descendants"
                >
                  {entry.kind === "milk" ? (
                    <DashboardAccent title="Milk today" />
                  ) : (
                    <CategoryIcon
                      category={entry.categories?.[0] || entry.category}
                      size={34}
                    />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: C.textCharcoal,
                      fontFamily: "NunitoSans_700Bold",
                      fontSize: 14,
                    }}
                  >
                    {entry.kind === "milk"
                      ? `Milk feed · ${entry.amount || 0} ${entry.unit || "ml"}`
                      : entry.name}
                  </Text>
                  <Text style={muted}>
                    {entry.date === today ? "Today" : formatDate(entry.date)}
                    {entry.time ? ` · ${formatTime(entry.time)}` : ""}
                    {entry.kind === "food" && entry.reaction
                      ? ` · ${entry.reaction}`
                      : ""}
                  </Text>
                </View>
                <Icon name="chevRight" size={12} color={C.mutedText} />
              </TouchableOpacity>
            ))
          ) : (
            <Text style={muted}>
              Your first little moments will appear here. Use the buttons above
              whenever you're ready.
            </Text>
          )}
        </View>
      )}
      {child && settings.showMilk && (
        <View style={s.card} testID="dashboard-milk">
          {heading("Milk today", "bottle", "Open log")}
          <Text
            style={{
              color: C.textCharcoal,
              fontFamily: "PlusJakartaSans_700Bold",
              fontSize: 24,
            }}
          >
            {milkTotal} ml <Text style={muted}>recorded</Text>
          </Text>
          <Text style={[muted, { marginTop: 5 }]}>
            {lastBottle
              ? `${bottlesToday.length} feeds${lastBottle.time ? ` · Last feed ${formatTime(lastBottle.time)}` : ""}`
              : "No milk feeds logged today."}
          </Text>
        </View>
      )}
      {child && settings.showAllergens && (
        <View style={s.card} testID="dashboard-allergens">
          {heading("Allergen tracker", "allergens", "Open tracker")}
          <Text style={muted}>
            {introduced} of {ALLERGENS.length} allergens recorded as introduced
          </Text>
          {known.length > 0 && (
            <Text
              style={{
                color: C.textCharcoal,
                fontFamily: "NunitoSans_700Bold",
                marginTop: 10,
                lineHeight: 20,
              }}
            >
              Known allergies · {known.join(", ")}
            </Text>
          )}
          <Text style={[muted, { marginTop: 6 }]}>
            Introductions, reactions and check-ins in one place.
          </Text>
        </View>
      )}
      {child && settings.showProgress && (
        <View style={s.card} testID="dashboard-progress">
          {heading("Their food journey", "childDetail", "View progress")}
          <View style={row}>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => onNavigateFiltered("log", "")}
            >
              <Text
                style={{
                  color: C.textCharcoal,
                  fontSize: 24,
                  fontFamily: "PlusJakartaSans_700Bold",
                }}
              >
                {groups.length}
              </Text>
              <Text style={muted}>different foods</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => onNavigateFiltered("log", "Favourites")}
            >
              <Text
                style={{
                  color: C.textCharcoal,
                  fontSize: 24,
                  fontFamily: "PlusJakartaSans_700Bold",
                }}
              >
                {favourites}
              </Text>
              <Text style={muted}>favourites</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {child && settings.showRecipes && (
        <View style={s.card} testID="dashboard-recipes">
          {heading("A little inspiration", "meals", "Browse recipes")}
          {recipe ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`View recipe: ${recipe.title}`}
              onPress={() => onNavigateToRecipe?.(recipe.id)}
              style={row}
            >
              {recipe.imageUrl && (
                <Image
                  source={{ uri: recipe.imageUrl }}
                  style={{ width: 64, height: 64, borderRadius: 14 }}
                />
              )}
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: C.textCharcoal,
                    fontFamily: "NunitoSans_800ExtraBold",
                    fontSize: 16,
                  }}
                >
                  {recipe.title}
                </Text>
                <Text style={muted}>
                  {[recipe.ageGroup, recipe.time].filter(Boolean).join(" · ")}
                </Text>
              </View>
              <Icon name="chevRight" size={14} color={C.primaryPurple} />
            </TouchableOpacity>
          ) : (
            <Text style={muted}>
              Find something lovely to try next in Recipes.
            </Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}
