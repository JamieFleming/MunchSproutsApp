import React, { useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, useStyles } from "../ThemeContext";
import { Icon } from "./Icon";
import { FoodForm } from "./FoodForm";

/** A fresh form mounts per opening; its scoped draft survives dismissal. */
export function AddFoodModal({
  onClose,
  onSubmit,
  initial,
  draftKey,
  isPro,
  recentFoods,
}) {
  const { C } = useTheme();
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const close = () => {
    if (!saving.current) onClose();
  };
  const submit = async (...args) => {
    if (saving.current) return false;
    saving.current = true;
    setBusy(true);
    try {
      const saved = await onSubmit(...args);
      if (saved !== false) onClose();
      return saved;
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[s.modalOverlay, { paddingTop: insets.top + 12 }]}
      >
        <View
          style={[
            s.modalSheet,
            { paddingBottom: Math.max(20, insets.bottom), maxHeight: "95%" },
          ]}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              marginBottom: 14,
            }}
          >
            <Text style={[s.modalTitle, { flex: 1 }]}>Log Food or Drink</Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Close food entry"
              disabled={busy}
              onPress={close}
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: C.bgPurple,
                alignItems: "center",
                justifyContent: "center",
                opacity: busy ? 0.5 : 1,
              }}
            >
              <Icon name="close" size={20} color={C.primaryPurple} />
            </TouchableOpacity>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            <FoodForm
              initial={initial || {}}
              draftKey={draftKey}
              isPro={isPro}
              recentFoods={recentFoods}
              onSubmit={submit}
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
