import { useRef, useState } from "react";
import { Alert } from "react-native";

// A parent may return false after displaying its own error. Never close on failure.
export function useSaveAction({
  errorTitle = "Your changes are still here",
  errorMessage = "We could not save. Check your connection and try again.",
} = {}) {
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const runSave = async (action, onSuccess) => {
    if (inFlight.current) return false;
    inFlight.current = true;
    setSaving(true);
    try {
      const result = await action();
      if (result === false) return false;
      onSuccess?.();
      return true;
    } catch {
      Alert.alert(errorTitle, errorMessage);
      return false;
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };
  return { saving, runSave };
}
