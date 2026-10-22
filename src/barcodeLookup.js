// Product lookup is an aid to label entry, never evidence that a food is allergen-free.
const ALLERGEN_MAP = {
  gluten: "Gluten",
  wheat: "Gluten",
  barley: "Gluten",
  rye: "Gluten",
  oats: "Gluten",
  milk: "Dairy",
  eggs: "Eggs",
  peanuts: "Peanuts",
  nuts: "Tree Nuts",
  almonds: "Tree Nuts",
  hazelnuts: "Tree Nuts",
  walnuts: "Tree Nuts",
  cashews: "Tree Nuts",
  pecans: "Tree Nuts",
  pistachios: "Tree Nuts",
  macadamia: "Tree Nuts",
  "brazil-nuts": "Tree Nuts",
  fish: "Fish",
  crustaceans: "Shellfish",
  molluscs: "Shellfish",
  soybeans: "Soy",
  sesame: "Sesame",
  "sesame-seeds": "Sesame",
};
const text = (value) =>
  typeof value === "string" ? value.trim().slice(0, 4000) : "";
const tags = (value) =>
  Array.isArray(value)
    ? [...new Set(value.filter((v) => typeof v === "string").slice(0, 50))]
    : [];
export function normaliseBarcode(value) {
  const code = text(value).replace(/\s/g, "");
  if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(code)) return null;
  let sum = 0;
  for (let i = code.length - 2, weight = 3; i >= 0; i--, weight = 4 - weight)
    sum += Number(code[i]) * weight;
  return (10 - (sum % 10)) % 10 === Number(code.at(-1)) ? code : null;
}
export function productFromResponse(response, barcode) {
  const p = response?.product;
  if (
    !p ||
    response?.result?.id === "product_not_found" ||
    response?.status === 0
  )
    return null;
  const name = text(p.product_name_en) || text(p.product_name);
  if (!name) return null;
  const contains = tags(p.allergens_tags);
  const label = (tag) => tag.replace(/^[a-z]{2}:/, "").replace(/-/g, " ");
  // Only map known English taxonomy IDs. Unrecognised allergens remain visible for review.
  const mapped = (tag) =>
    tag.startsWith("en:") ? ALLERGEN_MAP[tag.slice(3)] : undefined;
  return {
    barcode,
    name: name.slice(0, 250),
    brand: text(p.brands).slice(0, 150),
    allergens: [...new Set(contains.map(mapped).filter(Boolean))],
    contains: contains.map(label),
    untracked: contains.filter((tag) => !mapped(tag)).map(label),
    containsText: text(p.allergens),
    traces: tags(p.traces_tags).map(label),
    tracesText: text(p.traces),
    ingredients: text(p.ingredients_text_en) || text(p.ingredients_text),
    sourceUrl: `https://world.openfoodfacts.org/product/${barcode}`,
  };
}
export function applyScannedProduct(form, product) {
  const details = [
    `Scanned product: ${product.name} (${product.barcode}). Source: Open Food Facts — ${product.sourceUrl}`,
    product.untracked.length
      ? `Other listed allergens: ${product.untracked.join(", ")}.`
      : "",
    product.containsText && !product.contains.length
      ? `Allergen label text: ${product.containsText}.`
      : "",
    product.traces.length || product.tracesText
      ? `May contain: ${product.traces.join(", ") || product.tracesText}.`
      : "",
    "Check the current packaging; product information may be incomplete or outdated.",
  ]
    .filter(Boolean)
    .join("\n");
  return {
    ...form,
    name: product.name,
    allergens: [...product.allergens],
    notes: [form.notes, details].filter(Boolean).join("\n\n"),
    // An edited food must not inherit a completed check-in for a different allergen.
    ...(form.id && { isAllergenCheckin: false, allergenCheckIns: [] }),
  };
}
export async function lookupBarcode(value, { signal, fetcher = fetch } = {}) {
  const barcode = normaliseBarcode(value);
  if (!barcode)
    throw new Error("Enter a valid 8, 12, 13 or 14 digit product barcode.");
  const fields =
    "code,product_name,product_name_en,brands,allergens_tags,allergens,traces_tags,traces,ingredients_text,ingredients_text_en";
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener("abort", abort);
  const timeout = setTimeout(abort, 12000);
  try {
    const response = await fetcher(
      `https://world.openfoodfacts.org/api/v3/product/${barcode}.json?fields=${fields}`,
      {
        signal: controller.signal,
        headers: {
          "User-Agent": "MunchSprouts/1.6.2 (https://munchsprouts.co.uk)",
          Accept: "application/json",
        },
      },
    );
    if (response.status === 404) return null;
    if (response.status === 429)
      throw new Error(
        "Too many lookups. Wait a minute, or enter the food manually.",
      );
    if (!response.ok)
      throw new Error(
        "Product lookup is unavailable. Try again or enter the food manually.",
      );
    return productFromResponse(await response.json(), barcode);
  } catch (error) {
    if (signal?.aborted) throw error;
    if (controller.signal.aborted)
      throw new Error(
        "The lookup timed out. Check your connection or enter the food manually.",
      );
    if (error instanceof TypeError || error instanceof SyntaxError)
      throw new Error(
        "Couldn't load this product. Check your connection or enter it manually.",
      );
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}
