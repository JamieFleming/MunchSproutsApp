import React, { useEffect, useState } from "react";
import { Modal, View, Text, ScrollView, TouchableOpacity } from "react-native";
import Constants from "expo-constants";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, useStyles } from "../ThemeContext";
import { Icon } from "./Icon";
import { dismissWhatsNew, shouldShowWhatsNew } from "../whatsNew";

export function WhatsNewModal({ onClose }) {
  const { C } = useTheme();
  const s = useStyles();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={[s.modalOverlay, { paddingTop: insets.top + 16 }]}>
        <View
          style={[
            s.modalSheet,
            { maxHeight: "90%", paddingBottom: Math.max(24, insets.bottom) },
          ]}
        >
          <ScrollView contentContainerStyle={{ gap: 18 }}>
            <Text
              style={{
                color: C.primaryPurple,
                fontFamily: "NunitoSans_700Bold",
                fontSize: 14,
              }}
            >
              WHAT’S NEW · 1.6.2
            </Text>
            <Text accessibilityRole="header" style={s.modalTitle}>
              A little update for your little sprout 🌱
            </Text>
            {[
              [
                "barcode",
                "Scan food barcodes",
                "Look up food names and available allergen information, then review before logging.",
              ],
              [
                "star",
                "Simpler food logging",
                "A cleaner layout keeps the important details easy to reach.",
              ],
              [
                "close",
                "Start fresh easily",
                "Clear your entry with the new button whenever you want to start again.",
              ],
            ].map(([icon, title, description]) => (
              <View key={title} style={{ flexDirection: "row", gap: 12 }}>
                <View
                  style={{
                    backgroundColor: C.bgPurple,
                    borderRadius: 12,
                    padding: 10,
                    alignSelf: "flex-start",
                  }}
                >
                  <Icon name={icon} size={22} color={C.primaryPurple} />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text
                    style={{
                      fontFamily: "NunitoSans_700Bold",
                      fontSize: 17,
                      color: C.textCharcoal,
                    }}
                  >
                    {title}
                  </Text>
                  <Text
                    style={{
                      fontFamily: "NunitoSans_400Regular",
                      fontSize: 15,
                      lineHeight: 22,
                      color: C.textCharcoal,
                    }}
                  >
                    {description}
                  </Text>
                </View>
              </View>
            ))}
            <Text style={{ fontSize: 13, lineHeight: 19, color: C.mutedText }}>
              Product coverage varies. Always check the packaging for
              ingredients and allergens.
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Let’s get munching"
              onPress={onClose}
              style={[s.btnPrimary, { minHeight: 48 }]}
            >
              <Text style={s.btnPrimaryText}>Let’s get munching</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// Mount only after authentication, onboarding and dashboard data have loaded.
export function AutomaticWhatsNew({ user }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let alive = true;
    shouldShowWhatsNew(user, Constants.expoConfig?.version).then((show) => {
      if (alive) setVisible(show);
    });
    return () => {
      alive = false;
    };
  }, [user]);
  if (!visible) return null;
  return (
    <WhatsNewModal
      onClose={() => {
        setVisible(false);
        void dismissWhatsNew(user.uid);
      }}
    />
  );
}
