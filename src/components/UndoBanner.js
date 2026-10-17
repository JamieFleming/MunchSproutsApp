import React, { useEffect, useRef } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useTheme } from "../ThemeContext";
import { useSaveAction } from "../useSaveAction";

export function UndoBanner({ label, onUndo, onDismiss, palette }) {
  const { C } = useTheme();
  const { saving, runSave } = useSaveAction({
    errorTitle: "Could not restore this entry",
    errorMessage:
      "Check your connection and try Undo again before the notice disappears.",
  });
  const dismissRef = useRef(onDismiss);
  const timer = useRef(null);
  dismissRef.current = onDismiss;
  useEffect(() => {
    if (!saving) timer.current = setTimeout(() => dismissRef.current(), 6000);
    return () => clearTimeout(timer.current);
  }, [saving]);
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        backgroundColor: palette?.background || C.bgPurple,
        borderColor: palette?.accent || C.primaryPurple,
        borderWidth: 1,
        borderRadius: 999,
        width: "100%",
        maxWidth: 400,
        shadowColor: "#000",
        shadowOpacity: 0.14,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 12,
        paddingHorizontal: 14,
        paddingVertical: 8,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      <Text
        style={{
          flex: 1,
          color: palette?.ink || C.textCharcoal,
          fontFamily: "NunitoSans_700Bold",
        }}
      >
        {label} deleted
      </Text>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Undo deletion"
        disabled={saving}
        onPress={() => {
          clearTimeout(timer.current);
          runSave(onUndo);
        }}
        style={{ paddingVertical: 12 }}
      >
        <Text
          style={{
            color: palette?.ink || C.primaryPurpleDark,
            fontFamily: "NunitoSans_800ExtraBold",
          }}
        >
          {saving ? "Restoring…" : "Undo"}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Dismiss undo"
        disabled={saving}
        onPress={onDismiss}
        style={{ padding: 12 }}
      >
        <Text style={{ color: palette?.ink || C.textCharcoal }}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}
