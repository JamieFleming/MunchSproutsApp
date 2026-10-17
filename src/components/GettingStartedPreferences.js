import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  Linking,
  ActivityIndicator,
} from "react-native";
import { doc, updateDoc, deleteField } from "firebase/firestore";
import * as Notifications from "expo-notifications";
import { db } from "../firebase";
import { useTheme } from "../ThemeContext";
import { getExpoPushToken } from "../notificationService";
import { PriorityChoices, FieldHeading } from "./FeedingJourneyFields";

export function GettingStartedPreferences({ user, userDoc }) {
  const { C } = useTheme();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const save = async (data) => {
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
  const enable = async () => {
    setBusy(true);
    setSaved(false);
    try {
      const token = await getExpoPushToken();
      const permission = await Notifications.getPermissionsAsync();
      await updateDoc(doc(db, "users", user.uid), {
        notificationPreference: permission.granted ? "enabled" : "denied",
        pushToken: token || deleteField(),
      });
      setSaved(true);
      if (!permission.granted)
        Alert.alert(
          "Notifications are off",
          "You can allow notifications in your phone settings.",
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
      <View pointerEvents={busy ? "none" : "auto"}>
        <FieldHeading detail="Choose the shortcut on your dashboard. All features remain available.">
          Your starting point
        </FieldHeading>
        <PriorityChoices
          value={userDoc?.onboardingPriority}
          onChange={(value) => save({ onboardingPriority: value })}
        />
        <FieldHeading detail="Your phone controls permission. Meal and bottle reminders have their own settings below.">
          Notifications
        </FieldHeading>
        <Text style={{ color: C.mutedText, fontSize: 13, marginBottom: 10 }}>
          {userDoc?.notificationPreference === "enabled"
            ? "Allowed during setup. Manage device permission in Settings."
            : "Optional — enable whenever you are ready."}
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={enable}
          style={{ paddingVertical: 12 }}
        >
          <Text
            style={{ color: C.primaryPurple, fontFamily: "NunitoSans_700Bold" }}
          >
            Enable notifications
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => Linking.openSettings()}
          style={{ paddingVertical: 12 }}
        >
          <Text
            style={{ color: C.primaryPurple, fontFamily: "NunitoSans_700Bold" }}
          >
            Manage in phone settings →
          </Text>
        </TouchableOpacity>
      </View>
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
