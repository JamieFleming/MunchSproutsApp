import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  Alert,
  Linking,
  ActivityIndicator,
  AppState,
} from "react-native";
import { doc, updateDoc, deleteField } from "firebase/firestore";
import * as Notifications from "expo-notifications";
import { db } from "../firebase";
import { Icon } from "./Icon";
import { useTheme } from "../ThemeContext";
import { getExpoPushToken } from "../notificationService";
import { syncLocalReminders, notificationsAllowed } from "../reminderSync";

export function GettingStartedPreferences({
  user,
  userDoc,
  children,
  bottleRemindersEnabled = false,
}) {
  const { C } = useTheme();
  const [busy, setBusy] = useState(false);
  const [permission, setPermission] = useState(null);
  const [saved, setSaved] = useState(false);
  const enabled = notificationsAllowed(
    userDoc?.notificationPreference,
    bottleRemindersEnabled,
  );
  useEffect(() => {
    let alive = true;
    const refresh = () =>
      Notifications.getPermissionsAsync()
        .then((result) => {
          if (alive) setPermission(result.granted);
        })
        .catch(() => {});
    refresh();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  const save = async (data) => {
    if (busy) return;
    setBusy(true);
    setSaved(false);
    try {
      await updateDoc(doc(db, "users", user.uid), data);
      setSaved(true);
    } catch {
      Alert.alert("Could not save", "Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };
  const toggle = async (value) => {
    if (busy) return;
    setBusy(true);
    setSaved(false);
    try {
      const token = value ? await getExpoPushToken() : null;
      const result = await Notifications.getPermissionsAsync();
      setPermission(result.granted);
      await updateDoc(doc(db, "users", user.uid), {
        notificationPreference: value
          ? result.granted
            ? "enabled"
            : "denied"
          : "disabled",
        pushToken: token || deleteField(),
      });
      if (!value || !result.granted)
        await syncLocalReminders({ enabled: false });
      setSaved(true);
      if (value && !result.granted)
        Alert.alert(
          "Notifications are off",
          "Allow notifications in your phone settings, then enable them here.",
          [
            { text: "Not now", style: "cancel" },
            { text: "Open settings", onPress: () => Linking.openSettings() },
          ],
        );
    } catch {
      Alert.alert("Could not update notifications", "Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <View
      style={{
        padding: 16,
        backgroundColor: C.white,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: C.borderLight,
        marginBottom: 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Text
          style={{
            flex: 1,
            color: C.primaryPinkDark,
            fontSize: 16,
            fontFamily: "NunitoSans_800ExtraBold",
          }}
        >
          Allow notifications
        </Text>
        <Switch
          accessibilityLabel="Allow notifications"
          disabled={busy}
          value={enabled}
          onValueChange={toggle}
          trackColor={{ false: C.borderLight, true: C.primaryPurple }}
        />
      </View>
      <Text
        style={{
          color: C.mutedText,
          fontSize: 13,
          lineHeight: 19,
          marginTop: 8,
        }}
      >
        {permission === false
          ? "Notifications are blocked in your phone settings."
          : "Choose the reminders that help you. Turning this off pauses all reminders on this phone."}
      </Text>
      <TouchableOpacity
        accessibilityRole="button"
        onPress={() => Linking.openSettings()}
        style={{ paddingVertical: 14 }}
      >
        <Text
          style={{ color: C.primaryPurple, fontFamily: "NunitoSans_700Bold" }}
        >
          Manage in phone settings →
        </Text>
      </TouchableOpacity>
      <View
        pointerEvents={
          !enabled || permission === false || busy ? "none" : "auto"
        }
        style={{ opacity: enabled && permission !== false ? 1 : 0.5 }}
      >
        {children}
        <View
          style={{
            backgroundColor: C.white,
            borderRadius: 16,
            padding: 16,
            marginBottom: 10,
            borderWidth: 1,
            borderColor: C.borderLight,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: C.bgPurple,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="shield" size={18} color={C.primaryPurple} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: C.primaryPinkDark,
                  fontSize: 14,
                  fontFamily: "NunitoSans_700Bold",
                }}
              >
                Allergen check-ins
              </Text>
              <Text
                style={{
                  color: C.mutedText,
                  fontSize: 12,
                  lineHeight: 18,
                  marginTop: 4,
                }}
              >
                Check in 48 hours after a first allergen entry
              </Text>
            </View>
            <Switch
              accessibilityLabel="Allergen check-in reminders"
              disabled={!enabled || permission === false || busy}
              value={!!userDoc?.allergenRemindersEnabled}
              onValueChange={(value) =>
                save({ allergenRemindersEnabled: value })
              }
              trackColor={{ false: C.borderLight, true: C.primaryPurple }}
            />
          </View>
          <Text
            style={{
              color: C.mutedText,
              fontSize: 12,
              lineHeight: 18,
              marginTop: 12,
            }}
          >
            Record any changes; this does not confirm an allergy or safety.
          </Text>
        </View>
      </View>
      {saved && (
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: C.mutedText, fontSize: 12 }}
        >
          Saved
        </Text>
      )}
      {busy && <ActivityIndicator color={C.primaryPurple} />}
    </View>
  );
}
