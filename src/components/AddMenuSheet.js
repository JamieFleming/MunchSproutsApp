import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  Image,
  Platform,
} from "react-native";
import { useTheme, useStyles } from "../ThemeContext";
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
      <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1}>
        <View
          style={{
            position: "absolute",
            bottom: fabBottom + 72,
            right: 16,
            backgroundColor: C.white,
            borderRadius: 18,
            minWidth: 230,
            shadowColor: "#2e2440",
            shadowOpacity: 0.18,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 6 },
            elevation: 12,
            borderWidth: 1,
            borderColor: C.borderLight,
            overflow: "hidden",
          }}
          onStartShouldSetResponder={() => true}
        >
          <TouchableOpacity
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
      </TouchableOpacity>
    </Modal>
  );
}
