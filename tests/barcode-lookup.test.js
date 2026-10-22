const { test } = require("node:test");
const assert = require("node:assert/strict");
const harness = require("./support/appHarness.cjs");
const {
  normaliseBarcode,
  productFromResponse,
  applyScannedProduct,
  lookupBarcode,
} = harness().load("src/barcodeLookup.js");
const barcode = "3017620422003";
const response = {
  product: {
    product_name: "Mixed baby meal",
    brands: "Example",
    allergens_tags: ["en:fish", "en:milk", "en:celery"],
    traces_tags: ["en:peanuts"],
    ingredients_text: "Fish, milk, celery",
  },
};
test("barcodes retain leading zeros and reject malformed codes and invalid check digits", () => {
  for (const code of [barcode, "012345678905", "96385074", "03017620422003"])
    assert.equal(normaliseBarcode(code), code);
  for (const code of [
    "",
    "3017620422004",
    "https://example.test/3017620422003",
    "123",
    "123456789012345",
  ])
    assert.equal(normaliseBarcode(code), null);
});
test("contains and traces remain separate; unsupported allergens remain visible", () => {
  const product = productFromResponse(response, barcode);
  assert.deepEqual(product.allergens, ["Fish", "Dairy"]);
  assert.deepEqual(product.traces, ["peanuts"]);
  assert.deepEqual(product.untracked, ["celery"]);
  const form = applyScannedProduct(
    {
      id: "entry",
      name: "Old food",
      notes: "Parent's note",
      allergens: ["Eggs"],
      categories: ["Vegetables"],
      isAllergenCheckin: true,
    },
    product,
  );
  assert.equal(form.name, "Mixed baby meal");
  assert.deepEqual(form.allergens, ["Fish", "Dairy"]);
  assert.match(form.notes, /Parent's note/);
  assert.match(form.notes, /May contain: peanuts/);
  assert.match(form.notes, /Other listed allergens: celery/);
  assert.equal(form.isAllergenCheckin, false);
  assert.deepEqual(form.categories, ["Vegetables"]);
});
test("missing allergen data remains unknown and raw warnings are preserved", () => {
  const p = productFromResponse(
    {
      product: {
        product_name: "Food",
        allergens: "See label",
        traces: "Mustard",
      },
    },
    barcode,
  );
  assert.deepEqual(p.contains, []);
  assert.deepEqual(p.allergens, []);
  const form = applyScannedProduct({}, p);
  assert.match(form.notes, /Allergen label text: See label/);
  assert.match(form.notes, /May contain: Mustard/);
  assert.equal(productFromResponse({ product: {} }, barcode), null);
  assert.equal(productFromResponse({ status: 0 }, barcode), null);
});
test("lookup requests only product information and handles missing products/rate limits", async () => {
  let url;
  const result = await lookupBarcode(barcode, {
    fetcher: async (u, opts) => {
      url = u;
      assert.ok(opts.headers["User-Agent"]);
      return { ok: true, json: async () => response };
    },
  });
  assert.equal(result.name, "Mixed baby meal");
  assert.match(url, /api\/v3\/product\/3017620422003/);
  assert.doesNotMatch(url, /nutriments|calories/);
  assert.equal(
    await lookupBarcode(barcode, { fetcher: async () => ({ status: 404 }) }),
    null,
  );
  await assert.rejects(
    lookupBarcode(barcode, { fetcher: async () => ({ status: 429 }) }),
    /Wait a minute/,
  );
  await assert.rejects(
    lookupBarcode(barcode, {
      fetcher: async () => {
        throw new TypeError("offline");
      },
    }),
    /Check your connection/,
  );
  await assert.rejects(
    lookupBarcode("bad", { fetcher: () => assert.fail("must not fetch") }),
    /valid/,
  );
});
test("cancelling lookup aborts the network request", async () => {
  const controller = new AbortController();
  const pending = lookupBarcode(barcode, {
    signal: controller.signal,
    fetcher: async (_, { signal }) =>
      new Promise((resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("cancelled")));
      }),
  });
  controller.abort();
  await assert.rejects(pending, /cancelled/);
});
