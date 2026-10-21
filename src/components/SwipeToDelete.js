import React, { useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  PanResponder,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../ThemeContext";
import { Icon } from "./Icon";

export function confirmEntryDeletion(label, onDelete) {
  Alert.alert(
    "Delete entry?",
    `Delete this ${label}?`,
    [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: onDelete },
    ],
    { cancelable: true },
  );
}

export function SwipeToDelete({
  children,
  label = "entry",
  onDelete,
  onFavourite,
  favourite = false,
  onRepeat,
}) {
  const { C } = useTheme();
  const offset = useRef(new Animated.Value(0)).current;
  const position = useRef(0);
  const start = useRef(0);
  const [open, setOpen] = useState(false);
  const width =
    76 * (1 + Number(Boolean(onFavourite)) + Number(Boolean(onRepeat)));
  const latest = useRef({ width });
  latest.current = { width };
  const settle = (value) => {
    position.current = value;
    setOpen(value !== 0);
    Animated.spring(offset, {
      toValue: value,
      useNativeDriver: true,
      speed: 30,
      bounciness: 0,
    }).start();
  };
  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dx) > 14 &&
          Math.abs(g.dx) > Math.abs(g.dy) * 1.5 &&
          (g.dx < 0 || position.current < 0),
        onPanResponderGrant: () => {
          offset.stopAnimation();
          start.current = position.current;
        },
        onPanResponderMove: (_, g) =>
          offset.setValue(
            Math.max(-latest.current.width, Math.min(0, start.current + g.dx)),
          ),
        onPanResponderRelease: (_, g) => {
          const target = start.current === 0 ? g.dx < -40 : g.dx < 40;
          settle(target ? -latest.current.width : 0);
        },
        onPanResponderTerminate: () => settle(0),
        onPanResponderTerminationRequest: () => true,
      }),
    [offset],
  );
  const action = (title, icon, backgroundColor, callback, color = "#fff") => (
    <TouchableOpacity
      key={title}
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={() => {
        settle(0);
        callback();
      }}
      style={{
        width: 76,
        backgroundColor,
        justifyContent: "center",
        alignItems: "center",
        gap: 6,
        paddingVertical: 12,
      }}
    >
      <Icon name={icon} size={20} color={color} />
      <Text style={{ color, fontFamily: "NunitoSans_700Bold", fontSize: 11 }}>
        {title}
      </Text>
    </TouchableOpacity>
  );
  return (
    <View style={{ overflow: "hidden" }}>
      <View
        pointerEvents={open ? "auto" : "none"}
        accessibilityElementsHidden={!open}
        importantForAccessibility={open ? "auto" : "no-hide-descendants"}
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width,
          flexDirection: "row",
        }}
      >
        {onFavourite &&
          action(
            favourite ? "Unfavourite" : "Favourite",
            favourite ? "starFill" : "star",
            "#fff1b8",
            onFavourite,
            "#795a0c",
          )}
        {onRepeat &&
          action("Repeat", "plus", C.primaryPurple, onRepeat, C.white)}
        {action("Delete", "trash", "#b83232", () =>
          confirmEntryDeletion(label, onDelete),
        )}
      </View>
      <Animated.View
        {...responder.panHandlers}
        style={{
          backgroundColor: C.white,
          transform: [{ translateX: offset }],
        }}
      >
        {children}
      </Animated.View>
    </View>
  );
}
