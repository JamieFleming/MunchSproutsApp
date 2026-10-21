import React from "react";
import { View, Text, TouchableOpacity, Modal } from "react-native";
import { useTheme } from "../ThemeContext";
import { DASHBOARD_COLOURS } from "../dashboardModel";
import { Icon } from "./Icon";

export function AddMenuSheet({
  palette = DASHBOARD_COLOURS.lavender,
  visible,
  onClose,
  onFood,
  onBottle,
  onWeight,
  fabBottom,
}) {
  const { C } = useTheme();
  if (!visible) return null;
  return (
    <Modal
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={{ flex: 1, backgroundColor: "rgba(24, 18, 40, 0.28)" }}>
        <TouchableOpacity
          style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }}
          onPress={onClose}
          activeOpacity={1}
          accessibilityRole="button"
          accessibilityLabel="Close add menu"
        />
        <View
          style={{
            position: "absolute",
            bottom: fabBottom + 72,
            right: 16,
            backgroundColor: C.white,
            borderRadius: 18,
            minWidth: 230,
            maxWidth: "90%",
            shadowColor: "#2e2440",
            shadowOpacity: 0.18,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 6 },
            elevation: 12,
            borderWidth: 1,
            borderColor: C.borderLight,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              paddingHorizontal: 16,
              paddingVertical: 12,
              backgroundColor: palette.background,
              borderBottomWidth: 1,
              borderBottomColor: C.borderLight,
            }}
          >
            <Text
              style={{
                color: palette.ink,
                fontSize: 15,
                fontFamily: "NunitoSans_800ExtraBold",
              }}
            >
              What would you like to log?
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Add food"
            onPress={onFood}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 14,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              borderBottomWidth: 1,
              borderBottomColor: C.borderLight,
            }}
            activeOpacity={0.7}
          >
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                backgroundColor: palette.background,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="utensils" size={16} color={palette.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: "NunitoSans_700Bold",
                  fontSize: 14,
                  color: C.primaryPinkDark,
                }}
              >
                Food or Drink
              </Text>
              <Text style={{ fontSize: 11, color: C.mutedText, marginTop: 1 }}>
                Log a meal or snack
              </Text>
            </View>
            <Icon name="chevRight" size={12} color={C.mutedText} />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Add milk"
            onPress={onBottle}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 14,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              borderBottomWidth: 1,
              borderBottomColor: C.borderLight,
            }}
            activeOpacity={0.7}
          >
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                backgroundColor: "#d4e8f5",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="bottle" size={16} color="#2a5f8f" />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: "NunitoSans_700Bold",
                  fontSize: 14,
                  color: "#1a3f5f",
                }}
              >
                Bottle Feed
              </Text>
              <Text style={{ fontSize: 11, color: C.mutedText, marginTop: 1 }}>
                Formula or breast milk
              </Text>
            </View>
            <Icon name="chevRight" size={12} color={C.mutedText} />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Add weight"
            onPress={onWeight}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 14,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
            activeOpacity={0.7}
          >
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                backgroundColor: "#e6f7ef",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="scale" size={16} color="#2d7a55" />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: "NunitoSans_700Bold",
                  fontSize: 14,
                  color: "#1a4d35",
                }}
              >
                Weight
              </Text>
              <Text style={{ fontSize: 11, color: C.mutedText, marginTop: 1 }}>
                Record baby's weight
              </Text>
            </View>
            <Icon name="chevRight" size={12} color={C.mutedText} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
