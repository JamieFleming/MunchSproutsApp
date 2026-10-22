const { test } = require("node:test");
const assert = require("node:assert/strict");
const harness = require("./support/appHarness.cjs");
function scanner({ granted = true, lookup } = {}) {
  const base = harness();
  const states = [];
  let cursor = 0;
  const react = {
    ...base.react,
    useState(initial) {
      const i = cursor++;
      if (!(i in states))
        states[i] = typeof initial === "function" ? initial() : initial;
      return [
        states[i],
        (next) => {
          states[i] = typeof next === "function" ? next(states[i]) : next;
        },
      ];
    },
    useRef(initial) {
      const i = cursor++;
      if (!(i in states)) states[i] = { current: initial };
      return states[i];
    },
  };
  const h = harness("ios", {
    react,
    "../barcodeLookup": { lookupBarcode: lookup },
    "expo-camera": {
      CameraView: "CameraView",
      useCameraPermissions: () => [
        { granted, canAskAgain: false },
        async () => {},
        async () => {},
      ],
    },
  });
  const C = h.load("src/components/FoodBarcodeScanner.js").FoodBarcodeScanner;
  const used = [];
  let closes = 0;
  const flatten = (n) =>
    Array.isArray(n)
      ? n.flatMap(flatten)
      : n && typeof n === "object"
        ? [n, ...flatten(n.props?.children)]
        : [];
  const nodes = () => {
    cursor = 0;
    return flatten(C({ onClose: () => closes++, onUse: (p) => used.push(p) }));
  };
  return {
    nodes,
    find: (label) => nodes().find((n) => n.props.accessibilityLabel === label),
    used,
    closes: () => closes,
  };
}
const product = {
  name: "Food",
  allergens: ["Fish"],
  contains: ["fish"],
  traces: ["milk"],
  untracked: [],
  barcode: "3017620422003",
};
test("camera events cannot trigger duplicate lookups and review requires packaging confirmation", async () => {
  let calls = 0,
    resolve;
  const h = scanner({
    lookup: () => {
      calls++;
      return new Promise((r) => {
        resolve = r;
      });
    },
  });
  const camera = h.nodes().find((n) => n.type === "CameraView");
  const pending = camera.props.onBarcodeScanned({ data: product.barcode });
  await camera.props.onBarcodeScanned({ data: product.barcode });
  assert.equal(calls, 1);
  assert.equal(
    h.nodes().some((n) => n.type === "CameraView"),
    false,
  );
  resolve(product);
  await pending;
  assert.equal(h.find("Use this food").props.disabled, true);
  h.find("I have checked the packaging").props.onPress();
  assert.equal(h.find("Use this food").props.disabled, false);
  h.find("Use this food").props.onPress();
  assert.deepEqual(h.used, [product]);
});
test("denied camera permission still allows manual barcode lookup", async () => {
  const h = scanner({ granted: false, lookup: async () => product });
  assert.equal(
    h.nodes().some((n) => n.type === "CameraView"),
    false,
  );
  assert.ok(h.find("Open phone settings"));
  h.find("Product barcode").props.onChangeText(product.barcode);
  await h.find("Find product").props.onPress();
  assert.ok(h.find("Use this food"));
});
test("dismissal aborts a pending lookup and does not apply a late result", async () => {
  let signal, resolve;
  const h = scanner({
    lookup: (_, opts) => {
      signal = opts.signal;
      return new Promise((r) => {
        resolve = r;
      });
    },
  });
  const pending = h
    .nodes()
    .find((n) => n.type === "CameraView")
    .props.onBarcodeScanned({ data: product.barcode });
  h.find("Back to food entry").props.onPress();
  assert.equal(signal.aborted, true);
  resolve(product);
  await pending;
  assert.equal(h.closes(), 1);
  assert.deepEqual(h.used, []);
});
