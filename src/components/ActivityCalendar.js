import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, Modal, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../ThemeContext";
import { Icon } from "./Icon";
import { activityByDay, localDay, monthCells } from "../activityCalendar";

const KINDS = [
  ["food", "Food", "#d9758c"],
  ["milk", "Milk", "#528cbb"],
  ["weight", "Weight", "#48936c"],
];
export function ActivityCalendar({
  foodLog,
  bottleLog,
  weightLog,
  selectedDate,
  onSelect,
}) {
  const { C } = useTheme();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [month, setMonth] = useState(() => new Date());
  const activity = useMemo(
    () => activityByDay(foodLog, bottleLog, weightLog),
    [foodLog, bottleLog, weightLog],
  );
  const counts = activity[selectedDate] || {};
  const changeMonth = (delta) =>
    setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));
  const button = { padding: 12, minHeight: 44, justifyContent: "center" };
  return (
    <View style={{ marginBottom: 10 }}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Open activity calendar"
        onPress={() => {
          setMonth(
            selectedDate ? new Date(`${selectedDate}T12:00:00`) : new Date(),
          );
          setVisible(true);
        }}
        style={{
          ...button,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          backgroundColor: C.bgPurple,
          borderRadius: 12,
        }}
      >
        <Icon name="calendar" size={18} color={C.primaryPurple} />
        <Text
          style={{
            flex: 1,
            color: C.primaryPinkDark,
            fontFamily: "NunitoSans_700Bold",
          }}
        >
          {selectedDate || "Browse calendar"}
        </Text>
        <Icon name="chevDown" size={14} color={C.primaryPurple} />
      </TouchableOpacity>
      {selectedDate && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingTop: 4,
          }}
        >
          <Text style={{ flex: 1, fontSize: 12, color: C.mutedText }}>
            {counts.food || 0} food · {counts.milk || 0} milk ·{" "}
            {counts.weight || 0} weight entries
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => onSelect(null)}
            style={button}
          >
            <Text style={{ color: C.primaryPurple }}>All dates</Text>
          </TouchableOpacity>
        </View>
      )}
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#00000066",
            justifyContent: "center",
            padding: 16,
            paddingTop: Math.max(16, insets.top),
            paddingBottom: Math.max(16, insets.bottom),
          }}
        >
          <ScrollView
            style={{ flexGrow: 0, backgroundColor: C.white, borderRadius: 22 }}
            contentContainerStyle={{ padding: 16 }}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text
                style={{
                  flex: 1,
                  fontSize: 20,
                  color: C.textCharcoal,
                  fontFamily: "PlusJakartaSans_700Bold",
                }}
              >
                Activity calendar
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Close calendar"
                onPress={() => setVisible(false)}
                style={button}
              >
                <Icon name="close" size={20} color={C.primaryPurple} />
              </TouchableOpacity>
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginVertical: 8,
              }}
            >
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Previous month"
                onPress={() => changeMonth(-1)}
                style={button}
              >
                <Text style={{ color: C.primaryPurple, fontSize: 24 }}>‹</Text>
              </TouchableOpacity>
              <Text
                style={{
                  flex: 1,
                  textAlign: "center",
                  fontSize: 16,
                  color: C.textCharcoal,
                  fontFamily: "NunitoSans_700Bold",
                }}
              >
                {month.toLocaleDateString("en-GB", {
                  month: "long",
                  year: "numeric",
                })}
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Next month"
                onPress={() => changeMonth(1)}
                style={button}
              >
                <Text style={{ color: C.primaryPurple, fontSize: 24 }}>›</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: "row" }}>
              {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => (
                <Text
                  key={i}
                  style={{
                    width: "14.2857%",
                    textAlign: "center",
                    color: C.mutedText,
                    paddingVertical: 8,
                  }}
                >
                  {day}
                </Text>
              ))}
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {monthCells(month.getFullYear(), month.getMonth()).map(
                (day, i) =>
                  day ? (
                    <TouchableOpacity
                      key={day}
                      accessibilityRole="button"
                      accessibilityState={{ selected: day === selectedDate }}
                      accessibilityLabel={`${day}, ${KINDS.map(([kind, label]) => `${activity[day]?.[kind] || 0} ${label}`).join(", ")}`}
                      onPress={() => {
                        onSelect(day);
                        setVisible(false);
                      }}
                      style={{
                        width: "14.2857%",
                        minHeight: 48,
                        alignItems: "center",
                        paddingVertical: 6,
                        borderRadius: 10,
                        backgroundColor:
                          selectedDate === day ? C.bgPurple : "transparent",
                        borderWidth: 1,
                        borderColor:
                          day === localDay() ? C.primaryPurple : "transparent",
                      }}
                    >
                      <Text style={{ color: C.textCharcoal, fontSize: 16 }}>
                        {Number(day.slice(-2))}
                      </Text>
                      <View
                        style={{
                          flexDirection: "row",
                          gap: 3,
                          height: 10,
                          alignItems: "center",
                        }}
                      >
                        {KINDS.map(([kind, , color]) =>
                          activity[day]?.[kind] ? (
                            <View
                              key={kind}
                              style={{
                                width: 5,
                                height: 5,
                                borderRadius: 3,
                                backgroundColor: color,
                              }}
                            />
                          ) : null,
                        )}
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <View
                      key={`blank-${i}`}
                      style={{ width: "14.2857%", minHeight: 48 }}
                    />
                  ),
              )}
            </View>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: 16,
                marginTop: 16,
              }}
            >
              {KINDS.map(([kind, label, color]) => (
                <View
                  key={kind}
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <View
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 4,
                      backgroundColor: color,
                    }}
                  />
                  <Text style={{ color: C.textCharcoal, fontSize: 13 }}>
                    {label}
                  </Text>
                </View>
              ))}
            </View>
            <Text
              style={{
                color: C.mutedText,
                fontSize: 12,
                textAlign: "center",
                marginTop: 12,
              }}
            >
              Choose a date to see its food entries and activity totals.
            </Text>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
