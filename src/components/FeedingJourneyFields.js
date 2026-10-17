import React from "react";
import { View, Text, TouchableOpacity, TextInput } from "react-native";
import { useTheme } from "../ThemeContext";
import { ALLERGENS } from "../constants";
import {
  JOURNEY_STAGES,
  FEEDING_APPROACHES,
  PRIORITIES,
} from "../onboardingModel";

export function Choice({
  selected,
  label,
  detail,
  emoji,
  onPress,
  checkbox = false,
}) {
  const { C } = useTheme();
  return (
    <TouchableOpacity
      accessibilityRole={checkbox ? "checkbox" : "radio"}
      accessibilityState={checkbox ? { checked: selected } : { selected }}
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 14,
        minHeight: 54,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: selected ? C.primaryPurple : C.borderLight,
        backgroundColor: selected ? C.bgPurple : C.white,
        marginBottom: 8,
      }}
    >
      {emoji && <Text style={{ fontSize: 25 }}>{emoji}</Text>}
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: C.textCharcoal,
            fontFamily: "NunitoSans_700Bold",
            fontSize: 15,
          }}
        >
          {label}
        </Text>
        {!!detail && (
          <Text
            style={{
              color: C.mutedText,
              fontFamily: "NunitoSans_400Regular",
              fontSize: 12,
              marginTop: 3,
              lineHeight: 17,
            }}
          >
            {detail}
          </Text>
        )}
      </View>
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: checkbox ? 6 : 11,
          borderWidth: 1.5,
          borderColor: selected ? C.primaryPurple : C.borderLight,
          backgroundColor: selected ? C.primaryPurple : C.white,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {selected && <Text style={{ color: "#fff", fontSize: 13 }}>✓</Text>}
      </View>
    </TouchableOpacity>
  );
}
export function FieldHeading({ children, detail }) {
  const { C } = useTheme();
  return (
    <View style={{ marginTop: 16, marginBottom: 10 }}>
      <Text
        style={{
          fontFamily: "NunitoSans_800ExtraBold",
          fontSize: 16,
          color: C.primaryPinkDark,
        }}
      >
        {children}
      </Text>
      {!!detail && (
        <Text
          style={{
            fontFamily: "NunitoSans_400Regular",
            color: C.mutedText,
            fontSize: 13,
            lineHeight: 19,
            marginTop: 4,
          }}
        >
          {detail}
        </Text>
      )}
    </View>
  );
}
export function PriorityChoices({ value, onChange }) {
  return (
    <View>
      {PRIORITIES.map((p) => (
        <Choice
          key={p.value}
          {...p}
          selected={value === p.value}
          onPress={() => onChange(p.value)}
        />
      ))}
    </View>
  );
}
export function FeedingJourneyFields({ value, onChange, includeMilk = true }) {
  const { C } = useTheme();
  const set = (key, next) => onChange({ ...value, [key]: next });
  return (
    <View>
      <FieldHeading>Where are you in your journey?</FieldHeading>
      {JOURNEY_STAGES.map((p) => (
        <Choice
          key={p.value}
          {...p}
          selected={value.weaningStage === p.value}
          onPress={() => set("weaningStage", p.value)}
        />
      ))}
      <FieldHeading detail="Choose what feels right for now. You can change this later.">
        How is food offered?
      </FieldHeading>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {FEEDING_APPROACHES.map((p) => (
          <View key={p.value} style={{ width: "48%" }}>
            <Choice
              {...p}
              selected={value.feedingApproach === p.value}
              onPress={() => set("feedingApproach", p.value)}
            />
          </View>
        ))}
      </View>
      {includeMilk && (
        <>
          <FieldHeading>Would you like to track milk feeds?</FieldHeading>
          <Choice
            label="Yes, show milk on my dashboard"
            emoji="🍼"
            selected={value.trackMilk === true}
            onPress={() => set("trackMilk", true)}
          />
          <Choice
            label="Not for now"
            selected={value.trackMilk === false}
            onPress={() => set("trackMilk", false)}
          />
        </>
      )}
      <FieldHeading detail="These are saved on your child's profile, separately from reactions you log.">
        Any known food allergies?
      </FieldHeading>
      {[
        ["no", "No known allergies"],
        ["yes", "Yes"],
        ["unsure", "Not sure yet"],
      ].map(([id, label]) => (
        <Choice
          key={id}
          label={label}
          selected={value.allergyStatus === id}
          onPress={() =>
            onChange({
              ...value,
              allergyStatus: id,
              knownAllergens: id === "yes" ? value.knownAllergens || [] : [],
              otherAllergies: id === "yes" ? value.otherAllergies || "" : "",
            })
          }
        />
      ))}
      {value.allergyStatus === "yes" && (
        <View
          style={{
            padding: 14,
            backgroundColor: C.bgPurple,
            borderRadius: 18,
            marginTop: 6,
          }}
        >
          <FieldHeading>Select all that apply</FieldHeading>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {ALLERGENS.map((a) => (
              <View key={a.value} style={{ width: "48%" }}>
                <Choice
                  checkbox
                  label={a.value}
                  emoji={a.emoji}
                  selected={(value.knownAllergens || []).includes(a.value)}
                  onPress={() =>
                    set(
                      "knownAllergens",
                      (value.knownAllergens || []).includes(a.value)
                        ? value.knownAllergens.filter((v) => v !== a.value)
                        : [...(value.knownAllergens || []), a.value],
                    )
                  }
                />
              </View>
            ))}
          </View>
          <Text style={{ color: C.mutedText, fontSize: 13, marginVertical: 8 }}>
            Other allergies or details (optional)
          </Text>
          <TextInput
            accessibilityLabel="Other allergies or details"
            placeholder="Anything else you'd like to note"
            placeholderTextColor={C.mutedText}
            value={value.otherAllergies || ""}
            onChangeText={(v) => set("otherAllergies", v)}
            multiline
            maxLength={500}
            style={{
              backgroundColor: C.white,
              color: C.textCharcoal,
              borderRadius: 12,
              padding: 14,
              minHeight: 70,
              fontFamily: "NunitoSans_400Regular",
            }}
          />
        </View>
      )}
    </View>
  );
}
