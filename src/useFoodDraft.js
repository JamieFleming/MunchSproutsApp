import { useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createFoodDraftStore, hasFoodDraft } from "./foodDraftStore";

export function useFoodDraft(key, form, setForm, initial) {
  const store = useMemo(
    () => (key ? createFoodDraftStore(AsyncStorage, key) : null),
    [key],
  );
  const [ready, setReady] = useState(!key);
  const [status, setStatus] = useState("");
  const finished = useRef(false);
  const firstForm = useRef(initial);
  useEffect(() => {
    let alive = true;
    if (!store) return;
    store
      .read()
      .then((saved) => {
        if (!alive) return;
        // Explicit repeat/allergen prefills take precedence over an older draft.
        if (hasFoodDraft(saved) && !hasFoodDraft(firstForm.current)) {
          setForm((current) => ({ ...current, ...saved }));
          setStatus("Your unfinished entry has been restored.");
        }
      })
      .catch(() => {
        if (alive)
          setStatus(
            "Draft storage is unavailable. Keep this screen open until you save.",
          );
      })
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, [store]);
  useEffect(() => {
    if (!ready || !store || finished.current) return;
    let alive = true;
    store.write(form).catch(() => {
      if (alive)
        setStatus(
          "Could not keep a draft on this phone. Please save before leaving.",
        );
    });
    return () => {
      alive = false;
    };
  }, [form, ready, store]);
  const clear = async () => {
    finished.current = true;
    try {
      await store?.clear();
      setStatus("");
      return true;
    } catch {
      setStatus("Entry saved, but its local draft could not be cleared.");
      return false;
    }
  };
  return { ready, status, clear };
}
