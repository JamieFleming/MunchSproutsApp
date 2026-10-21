import React from "react";
import { View, Text, TouchableOpacity, Modal } from "react-native";
import { useTheme } from "../ThemeContext";

import { Icon } from "./Icon";

export function MilestoneModal({ milestones, onClose }) {
  const { C } = useTheme();
  const isAllergenCelebration = (milestones || []).some((m) => m.isAllergen);
  const headerEmoji =
    isAllergenCelebration &&
    milestones?.length === 1 &&
    milestones[0].allergenEmoji
      ? milestones[0].allergenEmoji
      : "🎉";
  const headerBg =
    isAllergenCelebration && milestones?.length === 1
      ? milestones[0].bg
      : C.bgPurple;
  const title = isAllergenCelebration
    ? "New Allergen Introduced!"
    : "Milestone Unlocked!";
  const subtitle = isAllergenCelebration
    ? "Amazing work introducing a new allergen safely!"
    : "You're doing amazing — keep exploring new foods!";

  return (
    <Modal
      visible={!!milestones}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(90,45,122,0.5)",
          justifyContent: "center",
          alignItems: "center",
          padding: 32,
        }}
      >
        <View
          style={{
            backgroundColor: C.white,
            borderRadius: 28,
            padding: 28,
            width: "100%",
            alignItems: "center",
            shadowColor: "#5a2d7a",
            shadowOpacity: 0.25,
            shadowRadius: 24,
            elevation: 12,
          }}
        >
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: headerBg,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <Text style={{ fontSize: 36 }}>{headerEmoji}</Text>
          </View>
          <Text
            style={{
              fontSize: 20,
              fontFamily: "PlusJakartaSans_700Bold",
              color: C.primaryPinkDark,
              marginBottom: 6,
              textAlign: "center",
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: C.mutedText,
              marginBottom: 20,
              textAlign: "center",
            }}
          >
            {subtitle}
          </Text>
          <View style={{ width: "100%", gap: 10, marginBottom: 24 }}>
            {(milestones || []).map((m) => (
              <View
                key={m.type}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  backgroundColor: m.bg,
                  borderRadius: 16,
                  padding: 14,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: `${m.color}22`,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {m.isAllergen && m.allergenEmoji ? (
                    <Text style={{ fontSize: 20 }}>{m.allergenEmoji}</Text>
                  ) : (
                    <Icon name={m.icon} size={20} color={m.color} />
                  )}
                </View>
                <Text
                  style={{
                    fontFamily: "NunitoSans_800ExtraBold",
                    fontSize: 15,
                    color: m.color,
                    flex: 1,
                  }}
                >
                  {m.label}
                </Text>
              </View>
            ))}
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={{
              backgroundColor: C.primaryPurple,
              borderRadius: 16,
              paddingVertical: 14,
              paddingHorizontal: 40,
              alignSelf: "stretch",
              alignItems: "center",
            }}
            activeOpacity={0.85}
          >
            <Text
              style={{
                color: C.white,
                fontFamily: "NunitoSans_800ExtraBold",
                fontSize: 15,
              }}
            >
              Woohoo! 🌟
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
