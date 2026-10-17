import React, { useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useTheme } from "../ThemeContext";
import {
  DASHBOARD_COLOURS,
  DASHBOARD_SECTIONS,
  dashboardSettings,
} from "../dashboardModel";

export function DashboardPreferences({ value, onSave }) {
  const { C } = useTheme();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const saving = useRef(false);
  const settings = dashboardSettings(value);
  const save = async (key, next) => {
    if (saving.current || !onSave) return;
    saving.current = true;
    setBusy(true);
    setSaved(false);
    try {
      await onSave(key, next);
      setSaved(true);
    } catch {
      Alert.alert(
        "Could not save your dashboard",
        "Your previous choices are still saved. Please try again.",
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  return (
    <View
      style={{
        gap: 14,
        backgroundColor: C.white,
        padding: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: C.borderLight,
      }}
    >
      <Text
        style={{
          fontFamily: "PlusJakartaSans_600SemiBold",
          color: C.primaryPinkDark,
          fontSize: 17,
        }}
      >
        Make it yours
      </Text>
      <Text style={{ color: C.mutedText, lineHeight: 19, fontSize: 12 }}>
        Choose what you see here. Everything stays available in the app. These
        choices are saved to your account. Your colour also appears on the child
        header, navigation, buttons and highlights throughout the app.
      </Text>
      <Text style={{ fontFamily: "NunitoSans_700Bold", color: C.textCharcoal }}>
        App accent colour
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {Object.entries(DASHBOARD_COLOURS).map(([key, palette]) => (
          <TouchableOpacity
            key={key}
            accessibilityRole="button"
            accessibilityLabel={palette.label}
            accessibilityState={{
              selected: settings.heroColour === key,
              disabled: busy,
            }}
            disabled={busy}
            onPress={() => save("heroColour", key)}
            style={{
              minHeight: 46,
              padding: 12,
              borderRadius: 14,
              backgroundColor: palette.background,
              borderWidth: 2,
              borderColor:
                settings.heroColour === key
                  ? palette.accent
                  : palette.background,
            }}
          >
            <Text
              style={{ color: palette.ink, fontFamily: "NunitoSans_700Bold" }}
            >
              {settings.heroColour === key ? "✓ " : ""}
              {palette.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {DASHBOARD_SECTIONS.map(([key, label]) => (
        <View
          key={key}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            minHeight: 44,
          }}
        >
          <Text
            style={{
              flex: 1,
              color: C.textCharcoal,
              fontFamily: "NunitoSans_600SemiBold",
              fontSize: 14,
            }}
          >
            {label}
          </Text>
          <Switch
            accessibilityLabel={label}
            value={settings[key]}
            disabled={busy}
            onValueChange={(next) => save(key, next)}
            trackColor={{ true: C.primaryPurple }}
          />
        </View>
      ))}
      {saved && (
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: C.textCharcoal }}
        >
          Saved
        </Text>
      )}
      {busy && <ActivityIndicator color={C.primaryPurple} />}
    </View>
  );
}
