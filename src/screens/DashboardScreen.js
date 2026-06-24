import React, { useMemo, memo, useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, Image, RefreshControl, Linking } from "react-native";
import Svg, { Circle, Path, G } from "react-native-svg";
import { useTheme, useStyles } from "../ThemeContext";
import { Icon, CategoryIcon, ReactionFace, AllergenIcon } from "../components/Icon";
import { groupByFood, calcAgeWeeks, calcAgeMonths, formatDate, normalize, formatTime, toMl, computeAllergenStatus, formatWeight } from "../helpers";
import { ALLERGENS } from "../constants";

function getGreeting() {
	const h = new Date().getHours();
	if (h < 12) return "GOOD MORNING";
	if (h < 17) return "GOOD AFTERNOON";
	return "GOOD EVENING";
}

function SproutAccent({ size = 20 }) {
	return (
		<Svg width={size} height={size} viewBox="0 0 24 24">
			<Path stroke="#7dcf9e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"
				d="M12 22V10" />
			<Path stroke="#7dcf9e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"
				d="M12 16c0-4-3-6-6-6a6 6 0 0 0 6 6z" />
			<Path stroke="#7dcf9e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"
				d="M12 12c0-4 3-6 6-6a6 6 0 0 1-6 6z" />
		</Svg>
	);
}

const MILK_TYPE_COLORS = {
	formula:     { color: "#2a5f8f", bg: "#d4e8f5" },
	breast:      { color: "#7a2d6a", bg: "#f5d4f0" },
	specialised: { color: "#a85a1a", bg: "#fde8cc" },
};

const MILK_LABELS = { formula: "Formula", breast: "Breast Milk", specialised: "Specialised" };

// ── Sub-components ────────────────────────────────────────────────────────────

const MilkGraph = memo(function MilkGraph({ entries }) {
	const { C } = useTheme();
	if (entries.length === 0) return null;
	const BAR_H = 64;
	const maxMl = Math.max(...entries.map((e) => toMl(e.amount, e.unit)));
	return (
		<View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, height: BAR_H + 28 }}>
			{entries.map((e) => {
				const ml = toMl(e.amount, e.unit);
				const tc = MILK_TYPE_COLORS[e.type] || MILK_TYPE_COLORS.formula;
				return (
					<View key={e.id} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end" }}>
						<Text style={{ fontFamily: "NunitoSans_700Bold", fontSize: 9, color: tc.color, marginBottom: 3 }}>{e.amount}{e.unit}</Text>
						<View style={{ width: "100%", height: Math.max(8, Math.round((ml / maxMl) * BAR_H)), backgroundColor: tc.color, borderRadius: 6, opacity: 0.85 }} />
						<Text style={{ fontFamily: "NunitoSans_600SemiBold", fontSize: 9, color: C.mutedText, marginTop: 4 }}>{formatTime(e.time)}</Text>
					</View>
				);
			})}
		</View>
	);
});

const CheckInReminderCard = memo(function CheckInReminderCard({ allergenStatus, onNavigate }) {
	const { C } = useTheme();
	const s = useStyles();
	const checkIns = allergenStatus.filter((a) => a.needsCheckIn);
	if (checkIns.length === 0) return null;
	return (
		<TouchableOpacity onPress={() => onNavigate("allergens")} activeOpacity={0.88} style={[s.card, { borderWidth: 1.5, borderColor: "#d4860a55" }]}>
			<View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
				<View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#fff0cc", alignItems: "center", justifyContent: "center" }}>
					<Icon name="clock" size={18} color="#d4860a" />
				</View>
				<View style={{ flex: 1 }}>
					<Text style={{ fontFamily: "PlusJakartaSans_600SemiBold", fontSize: 15, color: "#a85a1a" }}>48-Hour Reaction Check</Text>
					<Text style={{ fontFamily: "NunitoSans_400Regular", fontSize: 11, color: C.mutedText, marginTop: 1 }}>Did your baby have a delayed reaction?</Text>
				</View>
				<Icon name="chevRight" size={14} color="#d4860a" />
			</View>
			<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
				{checkIns.map((a) => (
					<View key={a.value} style={{ flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "#fff8ec", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: "#d4860a33" }}>
						<AllergenIcon allergen={a.value} size={22} />
						<View>
							<Text style={{ fontFamily: "NunitoSans_700Bold", fontSize: 11, color: "#a85a1a" }}>{a.value}</Text>
							<Text style={{ fontFamily: "NunitoSans_600SemiBold", fontSize: 9, color: "#d4860a" }}>{a.daysSinceFirstIntro ?? a.daysSinceFirst}d ago</Text>
						</View>
					</View>
				))}
			</View>
		</TouchableOpacity>
	);
});

const FavouritesSection = memo(function FavouritesSection({ foodLog, onNavigateFiltered }) {
	const { C } = useTheme();
	const s = useStyles();
	const favItems = useMemo(() =>
		Object.values(groupByFood(foodLog))
			.filter((g) => g.attempts.some((a) => a.favourite))
			.sort((a, b) => a.name.localeCompare(b.name)),
		[foodLog]
	);
	if (favItems.length === 0) return null;
	return (
		<View style={s.card}>
			<View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
				<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
					<Icon name="starFill" size={16} color="#c49a10" />
					<Text style={s.sectionTitle}>Favourites</Text>
				</View>
				<TouchableOpacity onPress={() => onNavigateFiltered("log", "Favourites")}>
					<Text style={{ fontSize: 13, color: C.primaryPurple, fontFamily: "NunitoSans_700Bold" }}>View all</Text>
				</TouchableOpacity>
			</View>
			<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
				{favItems.slice(0, 8).map((g) => {
					const latestFav = g.attempts.filter((a) => a.favourite).at(-1);
					return (
						<TouchableOpacity
							key={g.key}
							onPress={() => onNavigateFiltered("log", "Favourites")}
							style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fef9ec", borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8, width: "48%", borderWidth: 1, borderColor: "#f5e59a" }}
							activeOpacity={0.8}>
							<CategoryIcon category={g.category} size={30} />
							<View style={{ flex: 1 }}>
								<Text style={{ fontFamily: "PlusJakartaSans_600SemiBold", fontSize: 14, color: C.primaryPinkDark }} numberOfLines={1}>{g.name}</Text>
								{latestFav?.reaction && <Text style={{ fontFamily: "NunitoSans_600SemiBold", fontSize: 10, color: "#c49a10" }}>{latestFav.reaction}</Text>}
							</View>
						</TouchableOpacity>
					);
				})}
			</View>
		</View>
	);
});

// ── Screen ────────────────────────────────────────────────────────────────────

const PROMO_EXPIRY = new Date("2026-06-13T23:59:59");
const PROMO_URL    = "https://apps.apple.com/redeem?ctx=offercodes&id=6763142582&code=MUNCHSPROUTS50";

function PromoCountdownBanner() {
	const [timeLeft, setTimeLeft] = useState(null);

	useEffect(() => {
		const calc = () => {
			const diff = PROMO_EXPIRY - Date.now();
			if (diff <= 0) { setTimeLeft(null); return; }
			const d = Math.floor(diff / 86400000);
			const h = Math.floor((diff % 86400000) / 3600000);
			const m = Math.floor((diff % 3600000) / 60000);
			setTimeLeft({ d, h, m });
		};
		calc();
		const id = setInterval(calc, 60000);
		return () => clearInterval(id);
	}, []);

	if (!timeLeft) return null;

	return (
		<TouchableOpacity
			onPress={() => Linking.openURL(PROMO_URL).catch(() => {})}
			activeOpacity={0.88}
			style={{ borderRadius: 20, overflow: "hidden", backgroundColor: "#fff0f6", borderWidth: 1.5, borderColor: "#f9a8d4" }}>

			{/* Decorative blobs */}
			<View style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: "#fce7f3" }} />
			<View style={{ position: "absolute", bottom: -24, left: -24, width: 90, height: 90, borderRadius: 45, backgroundColor: "#ede9fe" }} />

			<View style={{ padding: 16, gap: 12 }}>
				{/* Badge + headline */}
				<View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
					<View style={{ backgroundColor: "#ec4899", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, flexShrink: 0 }}>
						<Text style={{ fontFamily: "NunitoSans_800ExtraBold", fontSize: 11, color: "#fff", letterSpacing: 0.5 }}>LIMITED OFFER</Text>
					</View>
					<Text style={{ fontFamily: "NunitoSans_800ExtraBold", flex: 1, fontSize: 13, color: "#9d174d" }}>Ends Friday 13th June!</Text>
					<Icon name="chevRight" size={14} color="#ec4899" />
				</View>

				{/* Main message */}
				<View style={{ gap: 2 }}>
					<Text style={{ fontFamily: "PlusJakartaSans_700Bold", fontSize: 22, color: "#831843", lineHeight: 28 }}>50% Off Pro — Lifetime Access</Text>
					<Text style={{ fontFamily: "NunitoSans_400Regular", fontSize: 13, color: "#be185d", lineHeight: 19 }}>All recipes, AI meal ideas, smart insights & more — yours forever for just <Text style={{ fontFamily: "NunitoSans_800ExtraBold" }}>£19.99</Text></Text>
				</View>

				{/* Countdown tiles */}
				<View style={{ flexDirection: "row", gap: 8 }}>
					{[
						{ val: timeLeft.d, label: "days" },
						{ val: timeLeft.h, label: "hrs"  },
						{ val: timeLeft.m, label: "mins" },
					].map(({ val, label }) => (
						<View key={label} style={{ flex: 1, backgroundColor: "#fce7f3", borderRadius: 12, paddingVertical: 10, alignItems: "center", borderWidth: 1, borderColor: "#fbcfe8" }}>
							<Text style={{ fontFamily: "PlusJakartaSans_700Bold", fontSize: 24, color: "#db2777", lineHeight: 28 }}>{String(val).padStart(2, "0")}</Text>
							<Text style={{ fontFamily: "NunitoSans_700Bold", fontSize: 10, color: "#be185d", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 1 }}>{label}</Text>
						</View>
					))}
				</View>

				{/* CTA button */}
				<View style={{ backgroundColor: "#ec4899", borderRadius: 12, paddingVertical: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}>
					<Icon name="crown" size={15} color="#fff" />
					<Text style={{ fontFamily: "NunitoSans_800ExtraBold", fontSize: 13, color: "#fff", letterSpacing: 0.3 }}>Claim 50% Off — Use Code MUNCHSPROUTS50</Text>
				</View>
			</View>
		</TouchableOpacity>
	);
}

export function DashboardScreen({
	child, foodLog, bottleLog = [], weightLog = [], weightPreference = "lbs",
	showMilkOnDashboard = true, showAllergenOnDashboard = true,
	recipes = [], onNavigate, onNavigateToRecipe, onNavigateFiltered, refreshing, onRefresh,
	isPro = false, onUpgradePro,
}) {
	const { C } = useTheme();
	const s = useStyles();

	const groups = useMemo(() => groupByFood(foodLog), [foodLog]);
	const keys   = useMemo(() => Object.keys(groups), [groups]);

	const unique     = keys.length;
	const liked      = useMemo(() => keys.filter((k) => groups[k].attempts.some((a) => a.reaction === "Loved" || a.reaction === "Good")).length, [keys, groups]);
	const disliked   = useMemo(() => keys.filter((k) => groups[k].attempts.some((a) => a.reaction === "Rejected")).length, [keys, groups]);
	const neutral    = useMemo(() => keys.filter((k) => groups[k].attempts.some((a) => a.reaction === "Neutral")).length, [keys, groups]);
	const allergic   = useMemo(() => foodLog.filter((f) => f.reaction === "Allergic").length, [foodLog]);
	const liquids    = useMemo(() => keys.filter((k) => groups[k].category === "Liquids").length, [keys, groups]);
	const favourites = useMemo(() => keys.filter((k) => groups[k].attempts.some((a) => a.favourite)).length, [keys, groups]);

	const weeks  = useMemo(() => (child ? calcAgeWeeks(child.dob) : null), [child]);
	const months = useMemo(() => (child ? calcAgeMonths(child.dob) : null), [child]);

	const latestWeight = useMemo(
		() => [...weightLog].sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0] || null,
		[weightLog],
	);

	const allergenStatus = useMemo(() => computeAllergenStatus(foodLog, ALLERGENS), [foodLog]);
	const allergenIntroduced = useMemo(() => allergenStatus.filter((a) => a.status !== "Not Tried").length, [allergenStatus]);
	const allergenTotal      = ALLERGENS.length;
	const allergenPct        = allergenTotal > 0 ? Math.round((allergenIntroduced / allergenTotal) * 100) : 0;
	const nextAllergen       = useMemo(() => allergenStatus.find((a) => a.status === "Not Tried") || null, [allergenStatus]);
	const recent             = useMemo(() => [...foodLog].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5), [foodLog]);

	const featuredRecipe = useMemo(() => {
		const featured = recipes.filter((r) => r.featured);
		return featured.length > 0
			? featured[Math.floor(Date.now() / 86400000) % featured.length]
			: null;
	}, [recipes]);

	const today        = new Date().toISOString().split("T")[0];
	const todayBottles = useMemo(
		() => [...bottleLog].filter((e) => e.date === today).sort((a, b) => (a.time || "").localeCompare(b.time || "")),
		[bottleLog, today],
	);
	const todayTotalMl = useMemo(() => todayBottles.reduce((sum, e) => sum + toMl(e.amount, e.unit), 0), [todayBottles]);
	const lastBottle   = todayBottles.at(-1);

	return (
		<ScrollView
			style={{ flex: 1 }}
			contentContainerStyle={{ gap: 18, paddingBottom: 24 }}
			showsVerticalScrollIndicator={false}
			refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primaryPurple} colors={[C.primaryPurple]} progressBackgroundColor={C.white} />}>

			{/* ── Promo banner ── */}
			{!isPro && <PromoCountdownBanner />}

			{/* ── Child hero ── */}
			{child ? (
				<TouchableOpacity
					onPress={() => onNavigate("childDetail")}
					activeOpacity={0.88}
					style={{ backgroundColor: "#d0c8f8", borderRadius: 24, padding: 22, overflow: "hidden", borderWidth: 1.5, borderColor: C.primaryPurple + "40" }}>

					{/* Decorative blobs */}
					<View style={{ position: "absolute", top: -55, right: -45, width: 210, height: 210, borderRadius: 105, backgroundColor: C.primaryPurple + "10" }} />
					<View style={{ position: "absolute", bottom: -50, right: 30, width: 130, height: 130, borderRadius: 65, backgroundColor: C.primaryPurple + "08" }} />

					{/* Greeting */}
					<Text style={{ fontFamily: "NunitoSans_700Bold", fontSize: 11, color: C.primaryPinkDark + "aa", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6 }}>
						{getGreeting()}
					</Text>

					{/* Top row: name + photo */}
					<View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
						<View style={{ flex: 1 }}>
							{/* Name + sprout */}
							<View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
								<Text style={{ fontFamily: "PlusJakartaSans_700Bold", fontSize: 30, color: C.primaryPinkDark, lineHeight: 36 }}>
									{child.name}'s day
								</Text>
								<SproutAccent size={22} />
							</View>

							{weeks !== null && (
								<View style={{ flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
									<View style={{ backgroundColor: "rgba(255,255,255,0.5)", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 }}>
										<Text style={{ fontFamily: "NunitoSans_600SemiBold", fontSize: 12, color: C.primaryPinkDark }}>{weeks} weeks</Text>
									</View>
									{latestWeight && (
										<View style={{ backgroundColor: "rgba(255,255,255,0.5)", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 }}>
											<Text style={{ fontFamily: "NunitoSans_600SemiBold", fontSize: 12, color: C.primaryPinkDark }}>
												{formatWeight(latestWeight.value_kg, weightPreference)}
											</Text>
										</View>
									)}
									{child.weaningStart && (
										<View style={{ backgroundColor: "rgba(255,255,255,0.5)", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 }}>
											<Text style={{ fontFamily: "NunitoSans_600SemiBold", fontSize: 12, color: C.primaryPinkDark }}>
												{`Weaning · wk ${Math.max(1, Math.ceil((Date.now() - new Date(child.weaningStart)) / 604800000))}`}
											</Text>
										</View>
									)}
								</View>
							)}
						</View>

						<TouchableOpacity onPress={() => onNavigate("children")} activeOpacity={0.8} style={{ position: "relative", marginLeft: 14 }}>
							{child.photoUri ? (
								<View style={{ width: 70, height: 70, borderRadius: 35, overflow: "hidden", borderWidth: 2.5, borderColor: C.primaryPurple + "40" }}>
									<Image source={{ uri: child.photoUri }} style={{ width: 70, height: 70 }} resizeMode="cover" />
								</View>
							) : (
								<Svg width={64} height={64} viewBox="0 0 64 64">
									<Circle cx="32" cy="32" r="30" fill={C.primaryPurple + "18"} />
									<Circle cx="32" cy="28" r="16" fill={C.primaryPurple + "28"} />
									<Circle cx="24" cy="26" r="3"  fill={C.primaryPurple} />
									<Circle cx="40" cy="26" r="3"  fill={C.primaryPurple} />
									<Path d="M26 34 Q32 39 38 34" stroke={C.primaryPurple} strokeWidth="2.5" strokeLinecap="round" fill="none" />
									<Path d="M14 44 Q32 56 50 44" stroke={C.primaryPurple + "30"} strokeWidth="3" strokeLinecap="round" fill="none" />
								</Svg>
							)}
							<View style={{ position: "absolute", bottom: 0, right: 0, width: 22, height: 22, borderRadius: 11, backgroundColor: C.primaryPurple, alignItems: "center", justifyContent: "center" }}>
								<Icon name="edit" size={11} color="#ffffff" />
							</View>
						</TouchableOpacity>
					</View>

					{/* View profile link */}
					<View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.primaryPurple + "20", gap: 4 }}>
						<Text style={{ fontFamily: "NunitoSans_600SemiBold", fontSize: 12, color: C.primaryPinkDark }}>View full profile</Text>
						<Icon name="chevRight" size={12} color={C.primaryPurple} />
					</View>
				</TouchableOpacity>
			) : (
				<View style={[s.card, { alignItems: "center", paddingVertical: 32, paddingHorizontal: 28 }]}>
					<Svg width={80} height={80} viewBox="0 0 80 80">
						<Circle cx="40" cy="40" r="38" fill={C.bgPurple} />
						<Circle cx="40" cy="34" r="16" fill={C.primaryPurple + "28"} />
						<Circle cx="33" cy="32" r="3"  fill={C.primaryPurple} />
						<Circle cx="47" cy="32" r="3"  fill={C.primaryPurple} />
						<Path d="M34 40 Q40 46 46 40" stroke={C.primaryPurple} strokeWidth="2.5" strokeLinecap="round" fill="none" />
						<Path d="M18 56 Q40 68 62 56" stroke={C.primaryPurple + "30"} strokeWidth="3" strokeLinecap="round" fill="none" />
						<Path stroke="#7dcf9e" strokeWidth="1.5" strokeLinecap="round" fill="none" d="M62 20 L62 15 M59 17 L65 17" />
						<Path stroke="#f9a825" strokeWidth="1.5" strokeLinecap="round" fill="none" d="M20 22 L20 17 M17 19 L23 19" />
					</Svg>
					<Text style={{ fontFamily: "PlusJakartaSans_700Bold", color: C.primaryPinkDark, fontSize: 20, marginTop: 16, marginBottom: 6 }}>Add your baby</Text>
					<Text style={{ fontFamily: "NunitoSans_400Regular", color: C.mutedText, fontSize: 14, textAlign: "center", marginBottom: 22, lineHeight: 21 }}>Get started by adding your little one's profile</Text>
					<TouchableOpacity onPress={() => onNavigate("children")} style={[s.btnPrimary, { paddingHorizontal: 28, width: "auto" }]}>
						<Text style={s.btnPrimaryText}>Add your baby</Text>
					</TouchableOpacity>
				</View>
			)}

			{/* ── Stats row 1 ── */}
			<View style={{ flexDirection: "row", gap: 10 }}>
				<TouchableOpacity onPress={() => onNavigateFiltered("log", "")}        style={[s.statCard, { backgroundColor: "#e4ddf8",         flex: 1 }]} activeOpacity={0.8}>
					<Icon name="grid" size={22} color={C.primaryPurple} />
					<Text style={[s.statValue, { color: C.primaryPurple, fontSize: 26 }]}>{unique}</Text>
					<Text style={[s.statLabel, { color: C.primaryPurple, fontSize: 11 }]}>Tried</Text>
				</TouchableOpacity>
				<TouchableOpacity onPress={() => onNavigateFiltered("log", "Loved")}   style={[s.statCard, { backgroundColor: C.statGreenBg,   flex: 1 }]} activeOpacity={0.8}>
					<ReactionFace reaction="Loved" size={26} />
					<Text style={[s.statValue, { color: C.statGreenText, fontSize: 26 }]}>{liked}</Text>
					<Text style={[s.statLabel, { color: C.statGreenText, fontSize: 11 }]}>Liked</Text>
				</TouchableOpacity>
				<TouchableOpacity onPress={() => onNavigateFiltered("log", "Rejected")} style={[s.statCard, { backgroundColor: C.statRedBg,    flex: 1 }]} activeOpacity={0.8}>
					<ReactionFace reaction="Rejected" size={26} />
					<Text style={[s.statValue, { color: C.statRedText, fontSize: 26 }]}>{disliked}</Text>
					<Text style={[s.statLabel, { color: C.statRedText, fontSize: 11 }]}>Nope</Text>
				</TouchableOpacity>
				<TouchableOpacity onPress={() => onNavigateFiltered("log", "Neutral")}  style={[s.statCard, { backgroundColor: C.statNeutralBg, flex: 1 }]} activeOpacity={0.8}>
					<ReactionFace reaction="Neutral" size={26} />
					<Text style={[s.statValue, { color: C.statNeutralText, fontSize: 26 }]}>{neutral}</Text>
					<Text style={[s.statLabel, { color: C.statNeutralText, fontSize: 11 }]}>Meh</Text>
				</TouchableOpacity>
			</View>

			{/* ── Stats row 2 ── */}
			<View style={{ flexDirection: "row", gap: 10 }}>
				<TouchableOpacity onPress={() => onNavigateFiltered("log", "Allergic")}   style={[s.statCard, { backgroundColor: C.statRedBg,     flex: 1 }]} activeOpacity={0.8}>
					<ReactionFace reaction="Allergic" size={26} />
					<Text style={[s.statValue, { color: "#c0392b", fontSize: 26 }]}>{allergic}</Text>
					<Text style={[s.statLabel, { color: "#c0392b", fontSize: 11 }]}>Allergic</Text>
				</TouchableOpacity>
				<TouchableOpacity onPress={() => onNavigateFiltered("log", "Liquids")}    style={[s.statCard, { backgroundColor: C.statBlueBg,    flex: 1 }]} activeOpacity={0.8}>
					<CategoryIcon category="Liquids" size={26} />
					<Text style={[s.statValue, { color: C.statBlueText, fontSize: 26 }]}>{liquids}</Text>
					<Text style={[s.statLabel, { color: C.statBlueText, fontSize: 11 }]}>Liquids</Text>
				</TouchableOpacity>
				<TouchableOpacity onPress={() => onNavigateFiltered("log", "Favourites")} style={[s.statCard, { backgroundColor: C.statNeutralBg, flex: 1 }]} activeOpacity={0.8}>
					<Icon name="starFill" size={22} color="#c49a10" />
					<Text style={[s.statValue, { color: "#c49a10", fontSize: 26 }]}>{favourites}</Text>
					<Text style={[s.statLabel, { color: "#c49a10", fontSize: 11 }]}>Faves</Text>
				</TouchableOpacity>
			</View>

			{/* ── Allergen summary ── */}
			{showAllergenOnDashboard && (
				<TouchableOpacity onPress={() => onNavigate("allergens")} activeOpacity={0.88} style={s.card}>
					<View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
						<View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
							<View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#ece8f9", alignItems: "center", justifyContent: "center" }}>
								<Icon name="shield" size={20} color="#7b5ea7" />
							</View>
							<View>
								<Text style={s.sectionTitle}>Allergen Tracker</Text>
								<Text style={{ fontFamily: "NunitoSans_400Regular", fontSize: 11, color: C.mutedText, marginTop: 1 }}>{allergenTotal - allergenIntroduced} still to introduce</Text>
							</View>
						</View>
						<View style={{ alignItems: "flex-end" }}>
							<Text style={{ fontFamily: "PlusJakartaSans_700Bold", fontSize: 24, color: C.primaryPurple }}>{allergenIntroduced}/{allergenTotal}</Text>
							<Text style={{ fontFamily: "NunitoSans_400Regular", fontSize: 11, color: C.mutedText }}>introduced</Text>
						</View>
					</View>
					<View style={{ backgroundColor: C.borderLight, borderRadius: 999, height: 8, overflow: "hidden", marginBottom: 12 }}>
						<View style={{ backgroundColor: "#3db87a", height: "100%", width: `${allergenPct}%`, borderRadius: 999 }} />
					</View>
					{nextAllergen ? (
						<View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
							<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
								<AllergenIcon allergen={nextAllergen.value} size={32} />
								<View>
									<Text style={{ fontFamily: "NunitoSans_700Bold", fontSize: 10, color: C.mutedText, textTransform: "uppercase", letterSpacing: 0.3 }}>Try next</Text>
									<Text style={{ fontFamily: "NunitoSans_700Bold", fontSize: 13, color: C.primaryPinkDark }}>{nextAllergen.value}</Text>
								</View>
							</View>
							<View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
								<Text style={{ fontFamily: "NunitoSans_700Bold", fontSize: 12, color: C.primaryPurple }}>View Tracker</Text>
								<Icon name="chevRight" size={12} color={C.primaryPurple} />
							</View>
						</View>
					) : (
						<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
							<Text style={{ fontSize: 14 }}>🎉</Text>
							<Text style={{ fontFamily: "NunitoSans_700Bold", fontSize: 13, color: "#2d7a55" }}>All allergens introduced!</Text>
						</View>
					)}
				</TouchableOpacity>
			)}

			{/* ── Allergen check-in reminder ── */}
			{showAllergenOnDashboard && <CheckInReminderCard allergenStatus={allergenStatus} onNavigate={onNavigate} />}

			{/* ── Milk tracking ── */}
			{showMilkOnDashboard && (
				<TouchableOpacity onPress={() => onNavigate("bottle")} activeOpacity={0.92} style={s.card}>
					<View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
						<View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
							<View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#d4e8f5", alignItems: "center", justifyContent: "center" }}>
								<Icon name="bottle" size={20} color="#2a5f8f" />
							</View>
							<View>
								<Text style={s.sectionTitle}>Milk Today</Text>
								{lastBottle && <Text style={{ fontFamily: "NunitoSans_400Regular", fontSize: 11, color: C.mutedText, marginTop: 1 }}>Last feed {formatTime(lastBottle.time)}</Text>}
							</View>
						</View>
						<View style={{ alignItems: "flex-end" }}>
							<Text style={{ fontFamily: "PlusJakartaSans_700Bold", fontSize: 24, color: "#2a5f8f" }}>{todayTotalMl} ml</Text>
							<Text style={{ fontFamily: "NunitoSans_400Regular", fontSize: 11, color: C.mutedText }}>{todayBottles.length} feed{todayBottles.length !== 1 ? "s" : ""}</Text>
						</View>
					</View>
					{todayBottles.length > 0 ? (
						<MilkGraph entries={todayBottles} />
					) : (
						<View style={{ alignItems: "center", paddingVertical: 16, backgroundColor: C.statBlueBg, borderRadius: 14 }}>
							<Icon name="bottle" size={28} color={C.secondaryPurple} />
							<Text style={{ fontFamily: "NunitoSans_600SemiBold", fontSize: 13, color: C.mutedText, marginTop: 6 }}>No bottles logged today</Text>
						</View>
					)}
					{todayBottles.length > 0 && (
						<View style={{ flexDirection: "row", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
							{Object.entries(todayBottles.reduce((acc, e) => { acc[e.type] = (acc[e.type] || 0) + 1; return acc; }, {})).map(([type, count]) => {
								const tc = MILK_TYPE_COLORS[type] || MILK_TYPE_COLORS.formula;
								return (
									<View key={type} style={{ backgroundColor: tc.bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, flexDirection: "row", alignItems: "center", gap: 4 }}>
										<View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tc.color }} />
										<Text style={{ fontFamily: "NunitoSans_700Bold", fontSize: 11, color: tc.color }}>{count}× {MILK_LABELS[type] || type}</Text>
									</View>
								);
							})}
						</View>
					)}
				</TouchableOpacity>
			)}

			{/* ── Featured recipe ── */}
			{featuredRecipe && (
				<TouchableOpacity onPress={() => onNavigateToRecipe?.(featuredRecipe.id)} activeOpacity={0.88} style={{ borderRadius: 20, overflow: "hidden", backgroundColor: C.white, borderWidth: 1.5, borderColor: C.primaryPurple + "50", shadowColor: C.primaryPurple, shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 }}>
					{featuredRecipe.imageUrl ? (
						<Image source={{ uri: featuredRecipe.imageUrl }} style={{ width: "100%", height: 160 }} resizeMode="cover" />
					) : (
						<View style={{ width: "100%", height: 120, backgroundColor: C.bgPurple, alignItems: "center", justifyContent: "center" }}>
							<CategoryIcon category={featuredRecipe.category} size={64} />
						</View>
					)}
					<View style={{ position: "absolute", top: 12, left: 12 }}>
						<View style={{ backgroundColor: "rgba(196,154,16,0.92)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, flexDirection: "row", alignItems: "center", gap: 4 }}>
							<Icon name="starFill" size={10} color="#fff" />
							<Text style={{ fontFamily: "NunitoSans_700Bold", fontSize: 11, color: "#fff" }}>Recipe of the Day</Text>
						</View>
					</View>
					{featuredRecipe.freezable && (
						<View style={{ position: "absolute", top: 12, right: 12, backgroundColor: "rgba(42,95,143,0.9)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
							<Text style={{ fontFamily: "NunitoSans_700Bold", fontSize: 10, color: "#fff" }}>Freezable</Text>
						</View>
					)}
					<View style={{ padding: 16 }}>
						<Text style={{ fontFamily: "PlusJakartaSans_600SemiBold", fontSize: 18, color: C.primaryPinkDark, marginBottom: 8 }}>{featuredRecipe.title}</Text>
						<View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
							{featuredRecipe.ageGroup  && <View style={{ backgroundColor: C.bgGreen,   borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}><Text style={{ fontFamily: "NunitoSans_700Bold", fontSize: 11, color: "#2e7d52" }}>{featuredRecipe.ageGroup}</Text></View>}
							{featuredRecipe.time      && <View style={{ backgroundColor: C.bgPurple, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}><Text style={{ fontFamily: "NunitoSans_700Bold", fontSize: 11, color: C.primaryPurple }}>{featuredRecipe.time}</Text></View>}
							{featuredRecipe.servings  && <View style={{ backgroundColor: C.bgPurple, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}><Text style={{ fontFamily: "NunitoSans_700Bold", fontSize: 11, color: C.primaryPurple }}>{featuredRecipe.servings} servings</Text></View>}
						</View>
						{featuredRecipe.description && <Text style={{ fontFamily: "NunitoSans_400Regular", fontSize: 13, color: C.mutedText, lineHeight: 19, marginBottom: 14 }} numberOfLines={2}>{featuredRecipe.description}</Text>}
						<View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
							<View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
								<Text style={{ fontFamily: "NunitoSans_700Bold", fontSize: 13, color: C.primaryPurple }}>View Recipe</Text>
								<Icon name="chevRight" size={13} color={C.primaryPurple} />
							</View>
							<TouchableOpacity onPress={(e) => { e.stopPropagation?.(); onNavigate("meals"); }} activeOpacity={0.75} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.bgPurple, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
								<Icon name="chef" size={13} color={C.primaryPurple} />
								<Text style={{ fontFamily: "NunitoSans_700Bold", fontSize: 12, color: C.primaryPurple }}>More Recipes</Text>
							</TouchableOpacity>
						</View>
					</View>
				</TouchableOpacity>
			)}

			{/* ── Allergy alert ── */}
			{allergic > 0 && (
				<View style={{ backgroundColor: C.statRedBg, borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", gap: 14, shadowColor: "#c0392b", shadowOpacity: 0.1, shadowRadius: 8, elevation: 2 }}>
					<View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: C.statRedBg, alignItems: "center", justifyContent: "center" }}>
						<Icon name="alert" size={22} color="#c0392b" />
					</View>
					<View style={{ flex: 1 }}>
						<Text style={{ fontFamily: "PlusJakartaSans_600SemiBold", fontSize: 15, color: "#c0392b" }}>Allergic Reactions Logged</Text>
						<Text style={{ fontFamily: "NunitoSans_400Regular", fontSize: 12, color: "#c0392b", marginTop: 2 }}>{allergic} reaction{allergic !== 1 ? "s" : ""} recorded — check food log</Text>
					</View>
				</View>
			)}

			{/* ── Recent foods ── */}
			{recent.length > 0 && (
				<View style={s.card}>
					<View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
						<Text style={s.sectionTitle}>Recent Foods</Text>
						<TouchableOpacity onPress={() => onNavigate("log")}>
							<Text style={{ fontFamily: "NunitoSans_700Bold", fontSize: 13, color: C.primaryPurple }}>View all</Text>
						</TouchableOpacity>
					</View>
					{recent.map((e, i) => (
						<TouchableOpacity
							key={e.id}
							onPress={() => onNavigateFiltered("log", "", normalize(e.name))}
							style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12, borderBottomWidth: i < recent.length - 1 ? 1 : 0, borderBottomColor: C.borderLight }}
							activeOpacity={0.7}>
							<CategoryIcon category={e.category} size={44} />
							<View style={{ flex: 1 }}>
								<Text style={{ fontFamily: "PlusJakartaSans_600SemiBold", fontSize: 16, color: C.primaryPinkDark }}>{e.name}{e.favourite ? " ★" : ""}</Text>
								<Text style={{ fontFamily: "NunitoSans_400Regular", fontSize: 12, color: C.mutedText, marginTop: 2 }}>{formatDate(e.date)}{e.form ? ` · ${e.form}` : ""}</Text>
							</View>
							<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
								<ReactionFace reaction={e.reaction} size={34} />
								<Icon name="chevRight" size={14} color={C.borderLight} />
							</View>
						</TouchableOpacity>
					))}
				</View>
			)}

			{/* ── Favourites ── */}
			<FavouritesSection foodLog={foodLog} onNavigateFiltered={onNavigateFiltered} />

			{/* ── Empty state ── */}
			{foodLog.length === 0 && (
				<View style={[s.card, { alignItems: "center", paddingVertical: 36, paddingHorizontal: 28 }]}>
					{/* Bowl illustration */}
					<Svg width={100} height={100} viewBox="0 0 100 100">
						{/* Background circle */}
						<Circle cx="50" cy="50" r="46" fill={C.bgPurple} />
						{/* Bowl body */}
						<Path fill={C.primaryPurple + "18"} stroke={C.primaryPurple} strokeWidth="2.5" strokeLinecap="round" d="M22 48 Q22 74 50 74 Q78 74 78 48 Z" />
						{/* Bowl rim */}
						<Path stroke={C.primaryPurple} strokeWidth="2.5" strokeLinecap="round" fill="none" d="M18 48 H82" />
						{/* Food blobs in bowl */}
						<Circle cx="40" cy="60" r="7" fill="#7dcf9e" opacity="0.9" />
						<Circle cx="55" cy="58" r="8" fill={C.primaryPurple + "70"} />
						<Circle cx="46" cy="67" r="5" fill="#f9a825" opacity="0.9" />
						{/* Spoon */}
						<Path stroke={C.primaryPurple} strokeWidth="2.5" strokeLinecap="round" fill="none" d="M72 40 L63 32" />
						<Circle cx="70" cy="38" r="6" stroke={C.primaryPurple} strokeWidth="2" fill={C.bgPurple} />
						{/* Steam wisps */}
						<Path stroke={C.primaryPurple + "50"} strokeWidth="2" strokeLinecap="round" fill="none" d="M38 40 Q41 34 38 28" />
						<Path stroke={C.primaryPurple + "50"} strokeWidth="2" strokeLinecap="round" fill="none" d="M50 38 Q53 32 50 26" />
						{/* Sparkles */}
						<Path stroke="#f9a825" strokeWidth="1.5" strokeLinecap="round" fill="none" d="M24 32 L24 26 M21 29 L27 29" />
						<Path stroke="#7dcf9e" strokeWidth="1.5" strokeLinecap="round" fill="none" d="M82 30 L82 24 M79 27 L85 27" />
					</Svg>
					<Text style={{ fontFamily: "PlusJakartaSans_700Bold", fontSize: 22, color: C.primaryPinkDark, marginTop: 20, marginBottom: 8, textAlign: "center" }}>Start your food journey!</Text>
					<Text style={{ fontFamily: "NunitoSans_400Regular", color: C.mutedText, fontSize: 14, textAlign: "center", marginBottom: 24, lineHeight: 22 }}>Log your little one's first taste and start building their weaning diary</Text>
					<TouchableOpacity onPress={() => onNavigate("add")} style={[s.btnPrimary, { paddingHorizontal: 32, width: "auto" }]}>
						<Text style={s.btnPrimaryText}>Log First Food</Text>
					</TouchableOpacity>
				</View>
			)}

			{/* ── Pro upsell banner ── */}
			{!isPro && (
				<TouchableOpacity onPress={onUpgradePro} activeOpacity={0.88}
					style={{ backgroundColor: "#2d1f5e", borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", gap: 14, overflow: "hidden" }}>
					<View style={{ position: "absolute", top: -20, right: -20, width: 90, height: 90, borderRadius: 45, backgroundColor: "rgba(155,127,232,0.15)" }} />
					<View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(245,200,66,0.15)", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
						<Icon name="crown" size={20} color="#f5c842" />
					</View>
					<View style={{ flex: 1 }}>
						<Text style={{ fontFamily: "PlusJakartaSans_600SemiBold", fontSize: 16, color: "#fff" }}>Unlock Munch Sprouts Pro</Text>
						<Text style={{ fontFamily: "NunitoSans_400Regular", fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 2 }}>Recipes, PDF export, milestones & more — from £2.99/mo</Text>
					</View>
					<Icon name="chevRight" size={14} color="rgba(255,255,255,0.4)" />
				</TouchableOpacity>
			)}
		</ScrollView>
	);
}
