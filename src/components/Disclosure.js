import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useTheme } from "../ThemeContext";
import { Icon } from "./Icon";

/** Keep secondary settings/advice out of the way without leaving the page. */
export function Disclosure({
  title,
  children,
  initiallyOpen = false,
  headerStyle,
  foregroundColor,
}) {
  const { C } = useTheme();
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <View style={{ marginBottom: 12 }}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={[
          {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingVertical: 16,
          },
          headerStyle,
        ]}
      >
        <Text
          style={{
            flex: 1,
            fontFamily: "PlusJakartaSans_700Bold",
            fontSize: 16,
            color: foregroundColor || C.primaryPinkDark,
          }}
        >
          {title}
        </Text>
        <Icon
          name={open ? "chevUp" : "chevDown"}
          size={18}
          color={foregroundColor || C.primaryPurple}
        />
      </TouchableOpacity>
      {open && children}
    </View>
  );
}
