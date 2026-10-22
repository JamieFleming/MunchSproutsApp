import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  AppState,
  Alert,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useTheme, useStyles } from "../ThemeContext";
import { lookupBarcode } from "../barcodeLookup";

/** Render inside the existing food sheet, avoiding stacked native modals on iOS. */
export function FoodBarcodeScanner({ onClose, onUse }) {
  const { C } = useTheme();
  const s = useStyles();
  const [permission, requestPermission, refreshPermission] =
    useCameraPermissions();
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("scan");
  const [error, setError] = useState("");
  const [cameraError, setCameraError] = useState(false);
  const [active, setActive] = useState(AppState.currentState === "active");
  const [product, setProduct] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const request = useRef(null);
  const locked = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const sub = AppState.addEventListener("change", (state) => {
      setActive(state === "active");
      if (state === "active") refreshPermission().catch(() => {});
    });
    return () => {
      mounted.current = false;
      request.current?.abort();
      sub.remove();
    };
  }, [refreshPermission]);
  const search = async (value) => {
    if (locked.current) return;
    locked.current = true;
    const controller = new AbortController();
    request.current = controller;
    setCode(value);
    setError("");
    setStatus("loading");
    setProduct(null);
    setConfirmed(false);
    try {
      const result = await lookupBarcode(value, { signal: controller.signal });
      if (!mounted.current || controller.signal.aborted) return;
      setProduct(result);
      setStatus(result ? "review" : "error");
      if (!result)
        setError(
          "This product isn't in the database yet. You can scan another or enter the food manually.",
        );
    } catch (e) {
      if (mounted.current && !controller.signal.aborted) {
        setError(e.message);
        setStatus("error");
      }
    } finally {
      if (request.current === controller) locked.current = false;
    }
  };
  const close = () => {
    request.current?.abort();
    onClose();
  };
  const button = (label, action, disabled = false, primary = false) => (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      accessibilityState={{ disabled }}
      onPress={action}
      style={{
        minHeight: 48,
        padding: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: C.primaryPurple,
        backgroundColor: primary ? C.primaryPurple : C.white,
        opacity: disabled ? 0.45 : 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text
        style={{
          fontFamily: "NunitoSans_700Bold",
          fontSize: 16,
          color: primary ? "#fff" : C.primaryPurple,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
  const body = {
    fontFamily: "NunitoSans_400Regular",
    fontSize: 15,
    lineHeight: 22,
    color: C.textCharcoal,
  };
  return (
    <View style={{ gap: 14 }}>
      <Text style={s.modalTitle}>Scan a food barcode</Text>
      <Text style={body}>
        Find the product name and suggested allergens. Nothing is added to your
        log until you save the food.
      </Text>
      {status === "scan" && (
        <>
          {permission?.granted && active && !cameraError ? (
            <CameraView
              style={{ height: 230, borderRadius: 16, overflow: "hidden" }}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ["ean13", "ean8", "upc_a", "itf14"],
              }}
              onBarcodeScanned={({ data }) => search(data)}
              onMountError={() => setCameraError(true)}
            />
          ) : (
            <View
              style={{
                padding: 18,
                backgroundColor: C.bgPurple,
                borderRadius: 16,
                gap: 12,
              }}
            >
              <Text style={body}>
                {cameraError
                  ? "The camera couldn't open. You can type the barcode below."
                  : "Allow camera access to scan, or type the barcode below."}
              </Text>
              {!permission?.granted &&
                button(
                  permission?.canAskAgain === false
                    ? "Open phone settings"
                    : "Allow camera",
                  async () => {
                    try {
                      if (permission?.canAskAgain === false)
                        await Linking.openSettings();
                      else await requestPermission();
                    } catch {
                      Alert.alert(
                        "Camera unavailable",
                        "You can still enter the barcode manually.",
                      );
                    }
                  },
                )}
            </View>
          )}
          <Text style={body}>
            Point at the barcode on the packaging, keeping all the bars in view.
          </Text>
        </>
      )}
      {status === "loading" ? (
        <View
          accessibilityLiveRegion="polite"
          style={{ padding: 24, alignItems: "center", gap: 8 }}
        >
          <ActivityIndicator color={C.primaryPurple} />
          <Text style={body}>Looking up your food…</Text>
        </View>
      ) : (
        status !== "review" && (
          <>
            <TextInput
              accessibilityLabel="Product barcode"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              placeholder="Type barcode digits"
              placeholderTextColor={C.mutedText}
              style={s.input}
              maxLength={18}
            />
            {button("Find product", () => search(code), !code.trim(), true)}
          </>
        )
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={body}>
          {error}
        </Text>
      )}
      {product && (
        <View
          style={{
            gap: 12,
            padding: 16,
            backgroundColor: C.bgPurple,
            borderRadius: 16,
          }}
        >
          <Text
            style={[
              body,
              { fontFamily: "NunitoSans_800ExtraBold", fontSize: 19 },
            ]}
          >
            {product.name}
          </Text>
          {!!product.brand && <Text style={body}>{product.brand}</Text>}
          <Text style={body}>
            Listed allergens:{" "}
            {product.contains.join(", ") ||
              product.containsText ||
              "Information unavailable — check the packaging."}
          </Text>
          <Text style={body}>
            May contain:{" "}
            {product.traces.join(", ") ||
              product.tracesText ||
              "Not supplied by the database — check the packaging."}
          </Text>
          {!!product.untracked.length && (
            <Text style={body}>
              These allergens do not have a tracking category in MunchSprouts
              and will be kept in your notes: {product.untracked.join(", ")}.
            </Text>
          )}
          {!!product.ingredients && (
            <Text style={body}>Ingredients: {product.ingredients}</Text>
          )}
          <Text style={body}>
            Check the current packaging. Database information can be incomplete
            or outdated. “May contain” warnings are kept in notes and aren't
            logged as allergen introductions.
          </Text>
          <TouchableOpacity
            accessibilityRole="checkbox"
            accessibilityLabel="I have checked the packaging"
            accessibilityState={{ checked: confirmed }}
            onPress={() => setConfirmed(!confirmed)}
            style={{ paddingVertical: 12 }}
          >
            <Text style={[body, { fontFamily: "NunitoSans_700Bold" }]}>
              {confirmed ? "☑" : "☐"} I have checked the packaging
            </Text>
          </TouchableOpacity>
          {button("Use this food", () => onUse(product), !confirmed, true)}
          <Text style={body}>
            This replaces the food name and allergen selections. You can edit
            them before saving.
          </Text>
        </View>
      )}
      {status !== "scan" &&
        status !== "loading" &&
        button("Scan another", () => {
          setStatus("scan");
          setError("");
          setProduct(null);
          setCode("");
          setConfirmed(false);
        })}
      {button("Back to food entry", close)}
      <TouchableOpacity
        accessibilityRole="link"
        onPress={() =>
          Linking.openURL(
            product?.sourceUrl || "https://world.openfoodfacts.org",
          ).catch(() =>
            Alert.alert("Couldn't open the source", "Please try again later."),
          )
        }
        style={{ minHeight: 44, justifyContent: "center" }}
      >
        <Text
          style={[
            body,
            { color: C.primaryPurple, textDecorationLine: "underline" },
          ]}
        >
          Product data: Open Food Facts (ODbL)
        </Text>
      </TouchableOpacity>
    </View>
  );
}
