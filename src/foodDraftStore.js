// Ordered per-key writes prevent a slow autosave from resurrecting a cleared draft.
const queues = new Map();
export function foodDraftKey(userId, childId) {
  return userId && childId
    ? `foodDraft_v1_${encodeURIComponent(userId)}_${encodeURIComponent(childId)}`
    : null;
}
export function sanitiseFoodDraft(value) {
  if (!value || typeof value !== "object") return null;
  const draft = {};
  for (const key of [
    "date",
    "name",
    "category",
    "categoryOther",
    "form",
    "reaction",
    "notes",
    "ml",
    "photoUri",
    "mealTime",
  ]) {
    if (typeof value[key] === "string") draft[key] = value[key];
  }
  for (const key of ["categories", "allergens"])
    if (Array.isArray(value[key]))
      draft[key] = value[key].filter((item) => typeof item === "string");
  if (typeof value.favourite === "boolean") draft.favourite = value.favourite;
  return draft;
}
export function hasFoodDraft(value) {
  return !!(
    value?.name?.trim() ||
    value?.notes?.trim() ||
    value?.categoryOther?.trim() ||
    value?.photoUri ||
    value?.categories?.length ||
    value?.allergens?.length ||
    value?.form ||
    value?.reaction ||
    value?.ml ||
    value?.mealTime ||
    value?.favourite
  );
}
export function createFoodDraftStore(storage, key) {
  const enqueue = (operation) => {
    const next = (queues.get(key) || Promise.resolve())
      .catch(() => {})
      .then(operation);
    queues.set(key, next);
    next
      .finally(() => {
        if (queues.get(key) === next) queues.delete(key);
      })
      .catch(() => {});
    return next;
  };
  return {
    read: () =>
      enqueue(async () => {
        const raw = await storage.getItem(key);
        if (!raw) return null;
        try {
          const saved = JSON.parse(raw);
          return saved.version === 1 ? sanitiseFoodDraft(saved.form) : null;
        } catch {
          return null;
        }
      }),
    write: (form) => {
      const value = sanitiseFoodDraft(form);
      return enqueue(() =>
        hasFoodDraft(value)
          ? storage.setItem(key, JSON.stringify({ version: 1, form: value }))
          : storage.removeItem(key),
      );
    },
    clear: () => enqueue(() => storage.removeItem(key)),
  };
}
