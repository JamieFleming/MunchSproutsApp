import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, ScrollView, Image, RefreshControl } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useTheme, useStyles } from "../ThemeContext";
import { Icon, CategoryIcon, ReactionFace, AllergenIcon } from "../components/Icon";
import { groupByFood, calcAgeWeeks, calcAgeMonths, formatDate, normalize, formatTime, toMl, computeAllergenStatus, formatWeight } from "../helpers";
import { ALLERGENS } from "../constants";

const MILK_TYPE_COLORS = {
	formula:     { color: "#2a5f8f", bg: "#d4e8f5" },
	breast:      { color: "#7a2d6a", bg: "#f5d4f0" },
	specialised: { color: "#a85a1a", bg: "#fde8cc" },
};

const MILK_LABELS = { formula: "Formula", breast: "Breast Milk", specialised: "Specialised" };

// ── Sub-components ────────────────────────────────────────────────────────────

function MilkGraph({ entries }) {
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
						<Text style={{ fontSize: 9, fontWeight: "700", color: tc.color, marginBottom: 3 }}>{e.amount}{e.unit}</Text>
						<View style={{ width: "100%", height: Math.max(8, Math.round((ml / maxMl) * BAR_H)), backgroundColor: tc.color, borderRadius: 6, opacity: 0.85 }} />
						<Text style={{ fontSize: 9, color: C.mutedText, marginTop: 4, fontWeight: "600" }}>{formatTime(e.time)}</Text>
					</View>
				);
			})}
		</View>
	);
}

function CheckInReminderCard({ allergenStatus, onNavigate }) {
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
					<Text style={{ fontWeight: "800", fontSize: 14, color: "#a85a1a" }}>48-Hour Reaction Check</Text>
					<Text style={{ fontSize: 11, color: C.mutedText, marginTop: 1 }}>Did your baby have a delayed reaction?</Text>
				</View>
				<Icon name="chevRight" size={14} color="#d4860a" />
			</View>
			<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
				{checkIns.map((a) => (
					<View key={a.value} style={{ flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "#fff8ec", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: "#d4860a33" }}>
						<AllergenIcon allergen={a.value} size={22} />
						<View>
							<Text style={{ fontSize: 11, fontWeight: "700", color: "#a85a1a" }}>{a.value}</Text>
							<Text style={{ fontSize: 9, color: "#d4860a", fontWeight: "600" }}>{a.daysSinceFirstIntro ?? a.daysSinceFirst}d ago</Text>
						</View>
					</View>
				))}
			</View>
		</TouchableOpacity>
	);
}

function FavouritesSection({ foodLog, onNavigateFiltered }) {
	const { C } = useTheme();
	const s = useStyles();
	const favItems = Object.values(groupByFood(foodLog))
		.filter((g) => g.attempts.some((a) => a.favourite))
		.sort((a, b) => a.name.localeCompare(b.name));
	if (favItems.length === 0) return null;
	return (
		<View style={s.card}>
			<View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
				<Text style={s.sectionTitle}>Favourites</Text>
				<TouchableOpacity onPress={() => onNavigateFiltered("log", "Favourites")}>
					<Text style={{ fontSize: 13, color: C.primaryPurple, fontWeight: "700" }}>View all</Text>
				</TouchableOpacity>
			</View>
			<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
				{favItems.slice(0, 8).map((g) => {
					const latestFav = g.attempts.filter((a) => a.favourite).at(-1);
					return (
						<TouchableOpacity
							key={g.key}
							onPress={() => onNavigateFiltered("log", "Favourites")}
							style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.statNeutralBg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, width: "100%" }}
							activeOpacity={0.8}>
							<CategoryIcon category={g.category} size={28} />
							<View>
								<Text style={{ fontWeight: "700", fontSize: 13, color: "#7a5a00" }}>{g.name}</Text>
								{latestFav?.reaction && <Text style={{ fontSize: 10, color: "#c49a10", fontWeight: "600" }}>{latestFav.reaction}</Text>}
							</View>
						</TouchableOpacity>
					);
				})}
			</View>
		</View>
	);
}

// ── Screen ────────────────────────────────────────────────────────────────────

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

			{/* ── Child hero ── */}
			{child ? (
				<TouchableOpacity
					onPress={() => onNavigate("childDetail")}
					activeOpacity={0.88}
					style={{ backgroundColor: C.primaryPurple, borderRadius: 24, padding: 22, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.18)" }}>
					{/* Top row: name + photo */}
					<View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
						<View style={{ flex: 1 }}>
							<Text style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", fontWeight: "600", marginBottom: 4 }}>Tracking for</Text>
							<Text style={{ fontSize: 30, fontWeight: "800", color: "#ffffff" }}>{child.name}</Text>
							{weeks !== null && (
								<View style={{ flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
									<View style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}>
										<Text style={{ fontSize: 12, color: "#ffffff", fontWeight: "700" }}>{weeks} weeks</Text>
									</View>
									<View style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}>
										<Text style={{ fontSize: 12, color: "#ffffff", fontWeight: "700" }}>{months} months</Text>
									</View>
									{latestWeight && (
										<View style={{ backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}>
											<Text style={{ fontSize: 12, color: "#ffffff", fontWeight: "700" }}>
												{formatWeight(latestWeight.value_kg, weightPreference)}
											</Text>
										</View>
									)}
								</View>
							)}
							{child.weaningStart && <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 6 }}>Weaning since {formatDate(child.weaningStart)}</Text>}
						</View>
						<TouchableOpacity onPress={() => onNavigate("children")} activeOpacity={0.8} style={{ position: "relative", marginLeft: 14 }}>
							{child.photoUri ? (
								<View style={{ width: 72, height: 72, borderRadius: 36, overflow: "hidden", borderWidth: 3, borderColor: "rgba(255,255,255,0.4)" }}>
									<Image source={{ uri: child.photoUri }} style={{ width: 72, height: 72 }} resizeMode="cover" />
								</View>
							) : (
								<Svg width={64} height={64} viewBox="0 0 64 64">
									<Circle cx="32" cy="32" r="30" fill="rgba(255,255,255,0.15)" />
									<Circle cx="32" cy="28" r="16" fill="rgba(255,255,255,0.25)" />
									<Circle cx="24" cy="26" r="3"  fill="rgba(255,255,255,0.8)" />
									<Circle cx="40" cy="26" r="3"  fill="rgba(255,255,255,0.8)" />
									<Path d="M26 34 Q32 39 38 34" stroke="rgba(255,255,255,0.8)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
									<Path d="M14 44 Q32 56 50 44" stroke="rgba(255,255,255,0.25)" strokeWidth="3" strokeLinecap="round" fill="none" />
								</Svg>
							)}
							<View style={{ position: "absolute", bottom: 0, right: 0, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" }}>
								<Icon name="edit" size={11} color="#ffffff" />
							</View>
						</TouchableOpacity>
					</View>
					{/* Tap hint */}
					<View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.15)", gap: 4 }}>
						<Text style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: "600" }}>View full profile</Text>
						<Icon name="chevRight" size={12} color="rgba(255,255,255,0.7)" />
					</View>
				</TouchableOpacity>
			) : (
				<View style={[s.card, { alignItems: "center", paddingVertical: 28 }]}>
					<Icon name="baby" size={44} color={C.secondaryPurple} />
					<Text style={{ color: C.mutedText, fontWeight: "600", fontSize: 15, marginTop: 10, marginBottom: 12 }}>No child added yet</Text>
					<TouchableOpacity onPress={() => onNavigate("children")} style={[s.btnPrimary, { paddingHorizontal: 28, width: "auto" }]}>
						<Text style={s.btnPrimaryText}>Add your baby</Text>
					</TouchableOpacity>
				</View>
			)}

			{/* ── Stats row 1 ── */}
			<View style={{ flexDirection: "row", gap: 10 }}>
				<TouchableOpacity onPress={() => onNavigateFiltered("log", "")}        style={[s.statCard, { backgroundColor: C.bgPurple,       flex: 1 }]} activeOpacity={0.8}>
					<Icon name="grid" size={20} color={C.primaryPurple} />
					<Text style={[s.statValue, { color: C.primaryPurple }]}>{unique}</Text>
					<Text style={[s.statLabel, { color: C.primaryPurple }]}>Tried</Text>
				</TouchableOpacity>
				<TouchableOpacity onPress={() => onNavigateFiltered("log", "Loved")}   style={[s.statCard, { backgroundColor: C.statGreenBg,   flex: 1 }]} activeOpacity={0.8}>
					<ReactionFace reaction="Loved" size={24} />
					<Text style={[s.statValue, { color: C.statGreenText }]}>{liked}</Text>
					<Text style={[s.statLabel, { color: C.statGreenText }]}>Likes</Text>
				</TouchableOpacity>
				<TouchableOpacity onPress={() => onNavigateFiltered("log", "Rejected")} style={[s.statCard, { backgroundColor: C.statRedBg,    flex: 1 }]} activeOpacity={0.8}>
					<ReactionFace reaction="Rejected" size={24} />
					<Text style={[s.statValue, { color: C.statRedText }]}>{disliked}</Text>
					<Text style={[s.statLabel, { color: C.statRedText }]}>Dislikes</Text>
				</TouchableOpacity>
				<TouchableOpacity onPress={() => onNavigateFiltered("log", "Neutral")}  style={[s.statCard, { backgroundColor: C.statNeutralBg, flex: 1 }]} activeOpacity={0.8}>
					<ReactionFace reaction="Neutral" size={24} />
					<Text style={[s.statValue, { color: C.statNeutralText }]}>{neutral}</Text>
					<Text style={[s.statLabel, { color: C.statNeutralText }]}>Neutral</Text>
				</TouchableOpacity>
			</View>

			{/* ── Stats row 2 ── */}
			<View style={{ flexDirection: "row", gap: 10 }}>
				<TouchableOpacity onPress={() => onNavigateFiltered("log", "Allergic")}   style={[s.statCard, { backgroundColor: C.statRedBg,     flex: 1 }]} activeOpacity={0.8}>
					<ReactionFace reaction="Allergic" size={24} />
					<Text style={[s.statValue, { color: "#c0392b" }]}>{allergic}</Text>
					<Text style={[s.statLabel, { color: "#c0392b" }]}>Allergic</Text>
				</TouchableOpacity>
				<TouchableOpacity onPress={() => onNavigateFiltered("log", "Liquids")}    style={[s.statCard, { backgroundColor: C.statBlueBg,    flex: 1 }]} activeOpacity={0.8}>
					<CategoryIcon category="Liquids" size={30} />
					<Text style={[s.statValue, { color: C.statBlueText }]}>{liquids}</Text>
					<Text style={[s.statLabel, { color: C.statBlueText }]}>Liquids</Text>
				</TouchableOpacity>
				<TouchableOpacity onPress={() => onNavigateFiltered("log", "Favourites")} style={[s.statCard, { backgroundColor: C.statNeutralBg, flex: 1 }]} activeOpacity={0.8}>
					<Icon name="starFill" size={20} color="#c49a10" />
					<Text style={[s.statValue, { color: "#c49a10" }]}>{favourites}</Text>
					<Text style={[s.statLabel, { color: "#c49a10" }]}>Faves</Text>
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
								<Text style={{ fontSize: 11, color: C.mutedText, marginTop: 1 }}>{allergenTotal - allergenIntroduced} still to introduce</Text>
							</View>
						</View>
						<View style={{ alignItems: "flex-end" }}>
							<Text style={{ fontSize: 22, fontWeight: "800", color: C.primaryPurple }}>{allergenIntroduced}/{allergenTotal}</Text>
							<Text style={{ fontSize: 11, color: C.mutedText }}>introduced</Text>
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
									<Text style={{ fontSize: 10, color: C.mutedText, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.3 }}>Try next</Text>
									<Text style={{ fontSize: 13, fontWeight: "700", color: C.primaryPinkDark }}>{nextAllergen.value}</Text>
								</View>
							</View>
							<View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
								<Text style={{ fontSize: 12, fontWeight: "700", color: C.primaryPurple }}>View Tracker</Text>
								<Icon name="chevRight" size={12} color={C.primaryPurple} />
							</View>
						</View>
					) : (
						<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
							<Text style={{ fontSize: 14 }}>🎉</Text>
							<Text style={{ fontSize: 13, fontWeight: "700", color: "#2d7a55" }}>All allergens introduced!</Text>
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
								{lastBottle && <Text style={{ fontSize: 11, color: C.mutedText, marginTop: 1 }}>Last feed {formatTime(lastBottle.time)}</Text>}
							</View>
						</View>
						<View style={{ alignItems: "flex-end" }}>
							<Text style={{ fontSize: 22, fontWeight: "800", color: "#2a5f8f" }}>{todayTotalMl} ml</Text>
							<Text style={{ fontSize: 11, color: C.mutedText }}>{todayBottles.length} feed{todayBottles.length !== 1 ? "s" : ""}</Text>
						</View>
					</View>
					{todayBottles.length > 0 ? (
						<MilkGraph entries={todayBottles} />
					) : (
						<View style={{ alignItems: "center", paddingVertical: 16, backgroundColor: C.bgPurple, borderRadius: 14 }}>
							<Icon name="bottle" size={28} color={C.secondaryPurple} />
							<Text style={{ fontSize: 13, color: C.mutedText, fontWeight: "600", marginTop: 6 }}>No bottles logged today</Text>
						</View>
					)}
					{todayBottles.length > 0 && (
						<View style={{ flexDirection: "row", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
							{Object.entries(todayBottles.reduce((acc, e) => { acc[e.type] = (acc[e.type] || 0) + 1; return acc; }, {})).map(([type, count]) => {
								const tc = MILK_TYPE_COLORS[type] || MILK_TYPE_COLORS.formula;
								return (
									<View key={type} style={{ backgroundColor: tc.bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, flexDirection: "row", alignItems: "center", gap: 4 }}>
										<View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tc.color }} />
										<Text style={{ fontSize: 11, fontWeight: "700", color: tc.color }}>{count}× {MILK_LABELS[type] || type}</Text>
									</View>
								);
							})}
						</View>
					)}
				</TouchableOpacity>
			)}

			{/* ── Featured recipe ── */}
			{featuredRecipe && (
				<TouchableOpacity onPress={() => onNavigateToRecipe?.(featuredRecipe.id)} activeOpacity={0.88} style={{ borderRadius: 20, overflow: "hidden", backgroundColor: C.white, shadowColor: "#9b7fe8", shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 }}>
					{featuredRecipe.imageUrl ? (
						<Image source={{ uri: featuredRecipe.imageUrl }} style={{ width: "100%", height: 160 }} resizeMode="cover" />
					) : (
						<View style={{ width: "100%", height: 120, backgroundColor: C.bgPurple, alignItems: "center", justifyContent: "center" }}>
							<CategoryIcon category={featuredRecipe.category} size={64} />
						</View>
					)}
					<View style={{ position: "absolute", top: 12, left: 12 }}>
						<View style={{ backgroundColor: "rgba(196,154,16,0.92)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
							<Text style={{ fontSize: 11, fontWeight: "700", color: "#fff" }}>★ Recipe of the Day</Text>
						</View>
					</View>
					{featuredRecipe.freezable && (
						<View style={{ position: "absolute", top: 12, right: 12, backgroundColor: "rgba(42,95,143,0.9)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, flexDirection: "row", alignItems: "center", gap: 4 }}>
							<Text style={{ fontSize: 11 }}>❄️</Text>
							<Text style={{ fontSize: 10, fontWeight: "700", color: "#fff" }}>Freezable</Text>
						</View>
					)}
					<View style={{ padding: 16 }}>
						<Text style={{ fontWeight: "800", fontSize: 16, color: C.primaryPinkDark, marginBottom: 8 }}>{featuredRecipe.title}</Text>
						<View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
							{featuredRecipe.ageGroup  && <View style={{ backgroundColor: C.bgGreen,   borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}><Text style={{ fontSize: 11, fontWeight: "700", color: "#2e7d52" }}>{featuredRecipe.ageGroup}</Text></View>}
							{featuredRecipe.time      && <View style={{ backgroundColor: C.bgPurple, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}><Text style={{ fontSize: 11, fontWeight: "700", color: C.primaryPurple }}>⏱ {featuredRecipe.time}</Text></View>}
							{featuredRecipe.servings  && <View style={{ backgroundColor: C.bgPurple, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}><Text style={{ fontSize: 11, fontWeight: "700", color: C.primaryPurple }}>🍽 {featuredRecipe.servings} servings</Text></View>}
						</View>
						{featuredRecipe.description && <Text style={{ fontSize: 13, color: C.mutedText, lineHeight: 19, marginBottom: 14 }} numberOfLines={2}>{featuredRecipe.description}</Text>}
						<View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
							<View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
								<Text style={{ fontSize: 13, fontWeight: "700", color: C.primaryPurple }}>View Recipe</Text>
								<Icon name="chevRight" size={13} color={C.primaryPurple} />
							</View>
							<TouchableOpacity onPress={(e) => { e.stopPropagation?.(); onNavigate("recipes"); }} activeOpacity={0.75} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.bgPurple, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
								<Icon name="chef" size={13} color={C.primaryPurple} />
								<Text style={{ fontSize: 12, fontWeight: "700", color: C.primaryPurple }}>More Recipes</Text>
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
						<Text style={{ fontWeight: "700", fontSize: 14, color: "#c0392b" }}>Allergic Reactions Logged</Text>
						<Text style={{ fontSize: 12, color: "#c0392b", marginTop: 2 }}>{allergic} reaction{allergic !== 1 ? "s" : ""} recorded — check food log</Text>
					</View>
				</View>
			)}

			{/* ── Recent foods ── */}
			{recent.length > 0 && (
				<View style={s.card}>
					<View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
						<Text style={s.sectionTitle}>Recent Foods</Text>
						<TouchableOpacity onPress={() => onNavigate("log")}>
							<Text style={{ fontSize: 13, color: C.primaryPurple, fontWeight: "700" }}>View all</Text>
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
								<Text style={{ fontWeight: "700", fontSize: 15, color: C.primaryPinkDark }}>{e.name}{e.favourite ? " ★" : ""}</Text>
								<Text style={{ fontSize: 12, color: C.mutedText, marginTop: 2 }}>{formatDate(e.date)}{e.form ? ` · ${e.form}` : ""}</Text>
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
				<View style={[s.card, { alignItems: "center", paddingVertical: 40 }]}>
					<Icon name="utensils" size={48} color={C.secondaryPurple} />
					<Text style={[s.sectionTitle, { marginTop: 16, marginBottom: 8 }]}>No foods logged yet</Text>
					<Text style={{ color: C.mutedText, fontSize: 14, textAlign: "center", marginBottom: 20, lineHeight: 22 }}>Start tracking your little one's weaning journey</Text>
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
						<Text style={{ fontWeight: "800", fontSize: 14, color: "#fff" }}>Unlock Munch Sprouts Pro</Text>
						<Text style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>Recipes, PDF export, milestones & more — from £2.99/mo</Text>
					</View>
					<Icon name="chevRight" size={14} color="rgba(255,255,255,0.4)" />
				</TouchableOpacity>
			)}
		</ScrollView>
	);
}
