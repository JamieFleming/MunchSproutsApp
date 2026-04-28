import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { REACTIONS, MONTHS } from "./constants";

export function calcAgeWeeks(dob) {
	if (!dob) return null;
	return Math.floor((Date.now() - new Date(dob)) / (7 * 24 * 60 * 60 * 1000));
}

export function calcAgeMonths(dob) {
	if (!dob) return null;
	const b = new Date(dob),
		n = new Date();
	return (
		(n.getFullYear() - b.getFullYear()) * 12 + (n.getMonth() - b.getMonth())
	);
}

export function formatDate(d) {
	if (!d) return "";
	return new Date(d).toLocaleDateString("en-GB", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

export function normalize(s) {
	return s.toLowerCase().trim();
}

export function groupByFood(log) {
	const g = {};
	log.forEach((e) => {
		const k = normalize(e.name);
		if (!g[k])
			g[k] = {
				key: k,
				name: e.name,
				category: e.category || (e.categories?.[0] ?? ""),
				attempts: [],
			};
		g[k].attempts.push(e);
	});
	Object.values(g).forEach((food) => {
		food.attempts.sort((a, b) => {
			const da = new Date((a.date || "1970-01-01") + "T" + (a.time || "00:00"));
			const db2 = new Date((b.date || "1970-01-01") + "T" + (b.time || "00:00"));
			return da - db2;
		});
	});
	return g;
}

export function reactionCfg(r) {
	return REACTIONS.find((x) => x.value === r) || REACTIONS[2];
}

export function getDaysInMonth(m, y) {
	return new Date(y, m, 0).getDate();
}

export function buildYears(from, to) {
	const y = [];
	for (let i = to; i >= from; i--) y.push(String(i));
	return y;
}

export function buildDays(m, y) {
	const n = getDaysInMonth(m, y),
		d = [];
	for (let i = 1; i <= n; i++) d.push(String(i).padStart(2, "0"));
	return d;
}

export async function pickImageAsBase64(aspect = [4, 3]) {
	const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();

	if (!perm.granted) {
		Alert.alert(
			"Permission needed",
			"Please allow access to your photo library in Settings.",
		);
		return null;
	}

	const result = await ImagePicker.launchImageLibraryAsync({
		mediaTypes: ["images"],
		allowsEditing: true,
		aspect,
		quality: 0.3,
		base64: true,
		exif: false,
	});

	if (result.canceled || !result.assets?.[0]) return null;

	const asset = result.assets[0];
	if (!asset.base64) return null;

	const ext = asset.uri.split(".").pop()?.toLowerCase() || "jpg";
	const mimeType = ext === "png" ? "image/png" : "image/jpeg";
	return `data:${mimeType};base64,${asset.base64}`;
}
