import React from "react";
import { View, Text, TouchableOpacity, Modal, Image } from "react-native";
import { useTheme } from "../ThemeContext";
import { DASHBOARD_COLOURS } from "../dashboardModel";
import { Icon } from "./Icon";

export function ChildDropdown({
  palette = DASHBOARD_COLOURS.lavender,
  visible,
  children,
  activeChildId,
  onSelect,
  onSettings,
  onManage,
  onClose,
  onSignOut,
  topOffset,
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
          accessibilityLabel="Close child menu"
        />
        <View
          style={{
            position: "absolute",
            top: topOffset,
            right: 16,
            backgroundColor: C.white,
            borderRadius: 18,
            minWidth: 210,
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
          {children.map((child, i) => (
            <TouchableOpacity
              key={child.id}
              accessibilityRole="button"
              accessibilityLabel={`Select ${child.name}`}
              accessibilityState={{ selected: child.id === activeChildId }}
              onPress={() => {
                onSelect(child.id);
                onClose();
              }}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 13,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                backgroundColor:
                  child.id === activeChildId
                    ? palette.background
                    : "transparent",
                borderBottomWidth: i < children.length - 1 ? 1 : 0,
                borderBottomColor: C.borderLight,
              }}
              activeOpacity={0.7}
            >
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor:
                    child.id === activeChildId
                      ? palette.accent
                      : palette.background,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {child.photoUri ? (
                  <Image
                    source={{ uri: child.photoUri }}
                    accessible={false}
                    style={{ width: 30, height: 30, borderRadius: 15 }}
                  />
                ) : (
                  <Icon
                    name="baby"
                    size={15}
                    color={
                      child.id === activeChildId ? "#ffffff" : palette.accent
                    }
                  />
                )}
              </View>
              <Text
                style={{
                  fontFamily: "NunitoSans_600SemiBold",
                  fontSize: 14,
                  color:
                    child.id === activeChildId ? palette.ink : C.textCharcoal,
                  flex: 1,
                }}
              >
                {child.name}
              </Text>
              {child.id === activeChildId && (
                <Icon name="check" size={13} color={palette.accent} />
              )}
            </TouchableOpacity>
          ))}
          <View style={{ height: 1, backgroundColor: C.borderLight }} />
          <TouchableOpacity
            onPress={() => {
              onManage();
              onClose();
            }}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
            activeOpacity={0.7}
          >
            <Icon name="users" size={14} color={C.primaryGreen} />
            <Text
              style={{
                fontFamily: "NunitoSans_600SemiBold",
                fontSize: 13,
                color: C.primaryGreen,
              }}
            >
              Manage children
            </Text>
          </TouchableOpacity>
          <View style={{ height: 1, backgroundColor: C.borderLight }} />
          <TouchableOpacity
            onPress={() => {
              onSettings();
              onClose();
            }}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
            activeOpacity={0.7}
          >
            <Icon name="settings" size={14} color={C.mutedText} />
            <Text
              style={{
                fontFamily: "NunitoSans_600SemiBold",
                fontSize: 13,
                color: C.mutedText,
              }}
            >
              Settings
            </Text>
          </TouchableOpacity>
          <View style={{ height: 1, backgroundColor: C.borderLight }} />
          <TouchableOpacity
            onPress={() => {
              onClose();
              onSignOut?.();
            }}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
            activeOpacity={0.7}
          >
            <Icon name="logout" size={14} color="#c0392b" />
            <Text
              style={{
                fontFamily: "NunitoSans_600SemiBold",
                fontSize: 13,
                color: "#c0392b",
              }}
            >
              Sign out
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
