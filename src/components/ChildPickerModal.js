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

export function ChildPickerModal({
  palette = DASHBOARD_COLOURS.lavender,
  visible,
  children,
  activeChildId,
  onSelect,
  onClose,
  onManage,
  toast,
}) {
  const { C } = useTheme();
  const s = useStyles();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={s.pickerOverlay}
        onPress={onClose}
        activeOpacity={1}
      >
        <View
          style={[s.pickerSheet, { maxHeight: "70%" }]}
          onStartShouldSetResponder={() => true}
        >
          <Text style={s.pickerTitle}>Select Child</Text>
          <Text
            style={{
              fontSize: 11,
              color: C.mutedText,
              textAlign: "center",
              marginTop: -8,
              marginBottom: 10,
            }}
          >
            Tap ★ to set a default child
          </Text>
          <ScrollView>
            {children.map((c) => (
              <TouchableOpacity
                key={c.id}
                onPress={() => {
                  onSelect(c.id);
                  onClose();
                }}
                style={[
                  s.pickerItem,
                  c.id === activeChildId && {
                    backgroundColor: palette.background,
                  },
                ]}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    flex: 1,
                  }}
                >
                  {c.photoUri ? (
                    <Image
                      source={{ uri: c.photoUri }}
                      style={{ width: 34, height: 34, borderRadius: 17 }}
                      resizeMode="cover"
                    />
                  ) : (
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 17,
                        backgroundColor: palette.accent + "22",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon name="baby" size={16} color={palette.accent} />
                    </View>
                  )}
                  <Text
                    style={[
                      s.pickerItemText,
                      c.id === activeChildId && {
                        color: palette.accent,
                        fontFamily: "NunitoSans_700Bold",
                      },
                    ]}
                  >
                    {c.name}
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <TouchableOpacity
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    onPress={(e) => {
                      e.stopPropagation();
                      onSelect(c.id);
                      onClose();
                      toast(`${c.name} set as default`);
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 18,
                        color:
                          c.id === activeChildId ? "#d4a017" : C.borderLight,
                      }}
                    >
                      ★
                    </Text>
                  </TouchableOpacity>
                  {c.id === activeChildId && (
                    <Icon name="check" size={16} color={palette.accent} />
                  )}
                </View>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() => {
                onClose();
                onManage();
              }}
              style={[
                s.pickerItem,
                {
                  borderWidth: 1.5,
                  borderColor: C.borderLight,
                  borderRadius: 14,
                  marginTop: 8,
                },
              ]}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: palette.background,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name="plus" size={16} color={palette.accent} />
                </View>
                <Text style={[s.pickerItemText, { color: palette.accent }]}>
                  Manage Children
                </Text>
              </View>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
