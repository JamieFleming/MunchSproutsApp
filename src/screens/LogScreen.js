import React, { useState, useEffect } from "react";
import {
	View, Text, TextInput, TouchableOpacity, ScrollView,
	FlatList, Modal, Image, Alert, RefreshControl, Platform,
} from "react-native";
import { useTheme, useStyles } from "../ThemeContext";
import { Icon, CategoryIcon, AllergenIcon } from "../components/Icon";
import { ZoomableImage } from "../components/ZoomableImage";
import { ReactionBadge, SecondaryBtn, DangerBtn } from "../components/SharedComponents";
import { CATEGORIES, MEAL_TIMES, ALLERGENS } from "../constants";
import { groupByFood, normalize, formatDate, reactionCfg } from "../helpers";

// ── Constants ─────────────────────────────────────────────────────────────────

const SORT_OPTS = [
	{ id: "date-desc", label: "Newest" },
	{ id: "alpha",     label: "A–Z" },
	{ id: "attempts",  label: "Attempts" },
	{ id: "reaction",  label: "Reaction" },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function AttemptRow({ attempt: a, attemptNum, milestones, hasMultipleUsers, currentUserId, userMap, onToggleFavourite, onEdit, onDelete, setLightboxPhoto, isEven }) {
	const { C } = useTheme();
	const s = useStyles();
	return (
		<View style={{ padding: 14, backgroundColor: isEven ? C.bgPurple : C.white, borderTopWidth: 1, borderTopColor: C.borderLight }}>
			<View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
				<View style={{ flex: 1 }}>
					<Text style={[s.smallLabel, { marginBottom: 6 }]}>
						Attempt {attemptNum} · {formatDate(a.date)}{a.time ? ` at ${a.time}` : ""}{a.favourite ? " ★" : ""}
					</Text>

					{/* Badges row */}
					<View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
						{a.mealTime && (() => {
							const mt = MEAL_TIMES.find((m) => m.value === a.mealTime);
							return mt ? (
								<View style={{ backgroundColor: mt.bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
									<Text style={{ fontSize: 11, fontWeight: "700", color: mt.color }}>{mt.value}</Text>
								</View>
							) : null;
						})()}
						{a.form && (
							<View style={{ backgroundColor: C.white, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 }}>
								<Text style={{ fontSize: 11, fontWeight: "600", color: C.mutedText }}>{a.form}</Text>
							</View>
						)}
						{a.ml ? (
							<View style={{ backgroundColor: C.statBlueBg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
								<Text style={{ fontSize: 11, fontWeight: "700", color: C.statBlueText }}>{a.ml}ml</Text>
							</View>
						) : null}
						<ReactionBadge reaction={a.reaction} />
					</View>

					{/* Allergen badges */}
					{a.allergens?.length > 0 && (
						<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
							{a.allergens.map((allergen) => {
								const cfg = ALLERGENS.find((al) => al.value === allergen);
								if (!cfg) return null;
								return (
									<View key={allergen} style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: cfg.bg, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: cfg.color + "55" }}>
										<AllergenIcon allergen={allergen} size={16} />
										<Text style={{ fontSize: 10, fontWeight: "700", color: cfg.color }}>{allergen}</Text>
									</View>
								);
							})}
						</View>
					)}

					{/* Milestone badges */}
					{milestones[a.id] && (
						<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
							{milestones[a.id].map((m) => (
								<View key={m.type} style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: m.bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1.5, borderColor: m.color + "55" }}>
									<Icon name={m.icon} size={12} color={m.color} />
									<Text style={{ fontSize: 11, fontWeight: "800", color: m.color }}>{m.label}</Text>
								</View>
							))}
						</View>
					)}

					{/* Notes */}
					{a.notes ? <Text style={{ fontSize: 12, color: C.mutedText, marginTop: 6, fontStyle: "italic" }}>"{a.notes}"</Text> : null}

					{/* Multi-user indicator */}
					{hasMultipleUsers && a.userId && (
						<View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 }}>
							<Icon name="user" size={11} color={C.mutedText} />
							<Text style={{ fontSize: 11, color: C.mutedText, fontStyle: "italic" }}>
								{a.userId === currentUserId ? "Added by you" : `Added by ${userMap[a.userId]?.split("@")[0] || "partner"}`}
							</Text>
						</View>
					)}

					{/* Photo */}
					{a.photoUri?.startsWith("http") && (
						<TouchableOpacity onPress={() => setLightboxPhoto({ uri: a.photoUri, name: "" })} activeOpacity={0.9} style={{ marginTop: 10 }}>
							<Image source={{ uri: a.photoUri }} style={{ width: "100%", height: 180, borderRadius: 12 }} resizeMode="cover" />
							<View style={{ position: "absolute", bottom: 8, right: 8, backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 8, padding: 5 }}>
								<Icon name="search" size={14} color="#fff" />
							</View>
						</TouchableOpacity>
					)}
				</View>

				{/* Action buttons */}
				<View style={{ flexDirection: "row", gap: 6 }}>
					<SecondaryBtn onPress={() => onToggleFavourite(a.id)} style={{ padding: 8 }}>
						<Icon name={a.favourite ? "starFill" : "star"} size={14} color="#d4a017" />
					</SecondaryBtn>
					<SecondaryBtn onPress={() => onEdit(a)} style={{ padding: 8 }}>
						<Icon name="edit" size={14} color={C.primaryPurple} />
					</SecondaryBtn>
					<DangerBtn onPress={() => Alert.alert("Delete", "Delete this entry?", [{ text: "Cancel" }, { text: "Delete", style: "destructive", onPress: () => onDelete(a.id) }])} style={{ padding: 8 }}>
						<Icon name="trash" size={14} color="#c0392b" />
					</DangerBtn>
				</View>
			</View>
		</View>
	);
}

function FoodCard({ foodKey: key, group: g, isOpen, toggle, milestones, hasMultipleUsers, currentUserId, userMap, onEdit, onDelete, onToggleFavourite, onAddAttempt, setLightboxPhoto }) {
	const { C } = useTheme();
	const s = useStyles();

	const latest         = g.attempts.at(-1);
	const likedCnt       = g.attempts.filter((a) => a.reaction === "Loved" || a.reaction === "Good").length;
	const pct            = Math.round((likedCnt / g.attempts.length) * 100);
	const hasAllergy     = g.attempts.some((a) => a.reaction === "Allergic");
	const hasFav         = g.attempts.some((a) => a.favourite);
	const hasPhoto       = g.attempts.some((a) => a.photoUri?.startsWith("http"));
	const groupMilestones = g.attempts.flatMap((a) => milestones[a.id] || []);

	const cats = g.attempts[0]?.categories?.length ? g.attempts[0].categories : g.category ? [g.category] : [];

	return (
		<View style={[s.card, { padding: 0, overflow: "hidden", borderWidth: hasAllergy ? 2 : 0, borderColor: hasAllergy ? "#e07070" : "transparent", backgroundColor: hasAllergy ? C.statRedBg : C.white }]}>
			{/* Header */}
			<TouchableOpacity onPress={() => toggle(key)} style={{ flexDirection: "row", alignItems: "center", padding: 16, gap: 14 }} activeOpacity={0.8}>
				<CategoryIcon category={g.category} size={48} />
				<View style={{ flex: 1 }}>
					{/* Name + badges */}
					<View style={{ flexDirection: "row", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
						<Text style={{ fontWeight: "700", fontSize: 15, color: C.primaryPinkDark }}>{g.name}</Text>
						{hasFav    && <Icon name="starFill" size={13} color="#d4a017" />}
						{hasPhoto  && <Icon name="image"    size={13} color={C.mutedText} />}
						{hasAllergy && (
							<View style={{ backgroundColor: C.statRedBg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
								<Text style={{ fontSize: 9, fontWeight: "700", color: "#c0392b", textTransform: "uppercase" }}>Allergy</Text>
							</View>
						)}
						<View style={{ backgroundColor: C.bgPurple, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
							<Text style={{ fontSize: 10, fontWeight: "700", color: C.primaryPurple }}>{g.attempts.length}×</Text>
						</View>
						{groupMilestones.length > 0 && (
							<View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#fef6d4", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1.5, borderColor: "#c49a1055" }}>
								<Icon name="star" size={10} color="#c49a10" />
								<Text style={{ fontSize: 10, fontWeight: "800", color: "#c49a10" }}>
									{groupMilestones.length === 1 ? "Milestone" : `${groupMilestones.length} Milestones`}
								</Text>
							</View>
						)}
					</View>

					{/* Latest reaction + date */}
					<View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
						<ReactionBadge reaction={latest.reaction} />
						<Text style={{ fontSize: 11, color: C.mutedText }}>Latest · {formatDate(latest.date)}{latest.time ? ` at ${latest.time}` : ""}</Text>
					</View>

					{/* Category pills */}
					{cats.length > 0 && (
						<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 5 }}>
							{cats.map((cat) => {
								const cfg = CATEGORIES.find((c) => c.value === cat) || CATEGORIES[7];
								return (
									<View key={cat} style={{ backgroundColor: cfg.bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
										<Text style={{ fontSize: 10, fontWeight: "700", color: cfg.color }}>{cat}</Text>
									</View>
								);
							})}
						</View>
					)}

					{/* Like bar */}
					<View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
						<View style={{ flex: 1, backgroundColor: C.borderLight, borderRadius: 999, height: 6, overflow: "hidden", maxWidth: 100 }}>
							<View style={{ backgroundColor: C.primaryGreen, height: "100%", width: `${pct}%`, borderRadius: 999 }} />
						</View>
						<Text style={{ fontSize: 11, color: C.mutedText, fontWeight: "600" }}>{pct}% liked</Text>
					</View>
				</View>
				<Icon name={isOpen ? "chevUp" : "chevDown"} size={16} color={C.mutedText} />
			</TouchableOpacity>

			{/* Expanded attempts */}
			{isOpen && [...g.attempts].reverse().map((a, i) => (
				<AttemptRow
					key={a.id}
					attempt={a}
					attemptNum={g.attempts.length - i}
					isEven={i % 2 === 0}
					milestones={milestones}
					hasMultipleUsers={hasMultipleUsers}
					currentUserId={currentUserId}
					userMap={userMap}
					onToggleFavourite={onToggleFavourite}
					onEdit={onEdit}
					onDelete={onDelete}
					setLightboxPhoto={setLightboxPhoto}
				/>
			))}

			{/* Add another attempt */}
			{isOpen && onAddAttempt && (
				<TouchableOpacity
					onPress={() => onAddAttempt(g)}
					style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderTopWidth: 1, borderTopColor: C.borderLight, backgroundColor: C.bgPurple, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }}
					activeOpacity={0.8}>
					<Icon name="plus" size={14} color={C.primaryPurple} />
					<Text style={{ fontSize: 13, fontWeight: "700", color: C.primaryPurple }}>Add Another Attempt</Text>
				</TouchableOpacity>
			)}
		</View>
	);
}

// ── Screen ────────────────────────────────────────────────────────────────────

export function LogScreen({
	foodLog, childName, bottleLog = [], initialFilter, initialOpenKey, initialAllergenFilter,
	milestones = {}, userMap = {}, currentUserId,
	onEdit, onDelete, onToggleFavourite, onAddAttempt, refreshing, onRefresh,
}) {
	const hasMultipleUsers = Object.keys(userMap).length > 1;
	const { C } = useTheme();
	const s = useStyles();

	const [search,         setSearch]         = useState("");
	const [sortBy,         setSortBy]         = useState("date-desc");
	const [reactionFilter, setReactionFilter] = useState(initialFilter || "");
	const [allergenFilter, setAllergenFilter] = useState(initialAllergenFilter || "");
	const [lightboxPhoto,  setLightboxPhoto]  = useState(null);
	const [expanded,       setExpanded]       = useState(initialOpenKey ? new Set([initialOpenKey]) : new Set());

	useEffect(() => { if (initialOpenKey)        setExpanded(new Set([initialOpenKey])); }, [initialOpenKey]);
	useEffect(() => { setAllergenFilter(initialAllergenFilter || ""); }, [initialAllergenFilter]);

	// Build filtered + sorted key list
	const groups = groupByFood(foodLog);
	let keys = Object.keys(groups);
	if (search)          keys = keys.filter((k) => normalize(groups[k].name).includes(normalize(search)));
	if (reactionFilter === "Liquids")    keys = keys.filter((k) => groups[k].category === "Liquids");
	else if (reactionFilter === "Favourites") keys = keys.filter((k) => groups[k].attempts.some((a) => a.favourite));
	else if (reactionFilter)             keys = keys.filter((k) => groups[k].attempts.some((a) => a.reaction === reactionFilter));
	if (allergenFilter)  keys = keys.filter((k) => groups[k].attempts.some((a) => Array.isArray(a.allergens) && a.allergens.includes(allergenFilter)));

	if (sortBy === "date-desc") keys.sort((a, b) => new Date(groups[b].attempts.at(-1).date) - new Date(groups[a].attempts.at(-1).date));
	else if (sortBy === "alpha")    keys.sort((a, b) => a.localeCompare(b));
	else if (sortBy === "attempts") keys.sort((a, b) => groups[b].attempts.length - groups[a].attempts.length);
	else if (sortBy === "reaction") {
		const order = ["Loved", "Good", "Neutral", "Rejected", "Allergic", ""];
		keys.sort((a, b) => order.indexOf(groups[a].attempts.at(-1).reaction || "") - order.indexOf(groups[b].attempts.at(-1).reaction || ""));
	}

	const toggle = (k) => setExpanded((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });

	const REACTION_FILTERS = [
		{ id: "",           label: "All",       color: C.primaryPurple,  bg: C.bgPurple      },
		{ id: "Loved",      label: "Loved",     color: C.statGreenText,  bg: C.statGreenBg   },
		{ id: "Good",       label: "Good",      color: "#3a7a3a",        bg: "#ddf0dd"        },
		{ id: "Neutral",    label: "Neutral",   color: C.statNeutralText,bg: C.statNeutralBg },
		{ id: "Rejected",   label: "Rejected",  color: C.statRedText,    bg: C.statRedBg     },
		{ id: "Allergic",   label: "Allergic",  color: "#c0392b",        bg: "#fde8e8"        },
		{ id: "Liquids",    label: "Liquids",   color: C.statBlueText,   bg: C.statBlueBg    },
		{ id: "Favourites", label: "Favourites",color: "#c49a10",        bg: "#fef6d4"        },
	];

	return (
		<View style={{ flex: 1 }}>
			{/* Search bar */}
			<View style={[s.input, { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12, backgroundColor: C.white }]}>
				<Icon name="search" size={16} color={C.mutedText} />
				<TextInput value={search} onChangeText={setSearch} placeholder="Search foods…" style={{ flex: 1, color: C.textCharcoal, fontWeight: "600", fontSize: 15 }} placeholderTextColor={C.mutedText} />
			</View>

			{/* Sort chips */}
			<ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ gap: 8, paddingBottom: 10, paddingHorizontal: 2 }}>
				{SORT_OPTS.map((opt) => (
					<TouchableOpacity key={opt.id} onPress={() => setSortBy(opt.id)}
						style={{ backgroundColor: sortBy === opt.id ? C.primaryPurple : C.white, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1.5, borderColor: sortBy === opt.id ? C.primaryPurple : C.borderLight, height: 34, justifyContent: "center", alignItems: "center" }}>
						<Text style={{ fontSize: 12, fontWeight: "700", color: sortBy === opt.id ? C.white : C.mutedText }}>{opt.label}</Text>
					</TouchableOpacity>
				))}
			</ScrollView>

			{/* Active allergen filter badge */}
			{allergenFilter ? (() => {
				const cfg = ALLERGENS.find((a) => a.value === allergenFilter);
				return (
					<View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
						<View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: cfg?.bg || "#fff0cc", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1.5, borderColor: (cfg?.color || "#d4860a") + "55", flex: 1 }}>
							<AllergenIcon allergen={allergenFilter} size={20} />
							<Text style={{ fontSize: 12, fontWeight: "700", color: cfg?.color || "#a85a1a", flex: 1 }}>Filtered: {allergenFilter}</Text>
							<TouchableOpacity onPress={() => setAllergenFilter("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
								<Icon name="close" size={14} color={cfg?.color || "#a85a1a"} />
							</TouchableOpacity>
						</View>
					</View>
				);
			})() : null}

			{/* Reaction filter chips */}
			<ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ gap: 8, paddingBottom: 10, paddingHorizontal: 2 }}>
				{REACTION_FILTERS.map((f) => {
					const active = reactionFilter === f.id;
					return (
						<TouchableOpacity key={f.id || "all"} onPress={() => setReactionFilter(f.id)}
							style={{ backgroundColor: active ? f.bg : C.white, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1.5, borderColor: active ? f.color : C.borderLight, height: 34, justifyContent: "center", alignItems: "center" }}>
							<Text style={{ fontSize: 12, fontWeight: "700", color: active ? f.color : C.mutedText }}>{f.label}</Text>
						</TouchableOpacity>
					);
				})}
			</ScrollView>

			{/* Clear filter */}
			{reactionFilter !== "" && (
				<TouchableOpacity onPress={() => setReactionFilter("")} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
					<Text style={{ fontSize: 12, color: C.primaryPurple, fontWeight: "700" }}>Filtered: {reactionFilter} · Tap to clear</Text>
					<Icon name="close" size={13} color={C.primaryPurple} />
				</TouchableOpacity>
			)}

			<Text style={[s.smallLabel, { marginBottom: 10 }]}>{keys.length} food{keys.length !== 1 ? "s" : ""}</Text>

			{/* Food list */}
			<FlatList
				data={keys}
				keyExtractor={(item) => item}
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{ gap: 10, paddingBottom: 20 }}
				removeClippedSubviews
				refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primaryPurple} colors={[C.primaryPurple]} progressBackgroundColor={C.white} />}
				renderItem={({ item: key }) => (
					<FoodCard
						foodKey={key}
						group={groups[key]}
						isOpen={expanded.has(key)}
						toggle={toggle}
						milestones={milestones}
						hasMultipleUsers={hasMultipleUsers}
						currentUserId={currentUserId}
						userMap={userMap}
						onEdit={onEdit}
						onDelete={onDelete}
						onToggleFavourite={onToggleFavourite}
						onAddAttempt={onAddAttempt}
						setLightboxPhoto={setLightboxPhoto}
					/>
				)}
			/>

			{/* Photo lightbox */}
			<Modal visible={!!lightboxPhoto} animationType="fade" statusBarTranslucent onRequestClose={() => setLightboxPhoto(null)}>
				<View style={{ flex: 1, backgroundColor: "#000" }}>
					<TouchableOpacity
						onPress={() => setLightboxPhoto(null)}
						style={{ position: "absolute", top: Platform.OS === "ios" ? 56 : 20, right: 20, zIndex: 10, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 20, padding: 10 }}>
						<Icon name="close" size={20} color="#fff" />
					</TouchableOpacity>
					{lightboxPhoto && <ZoomableImage uri={lightboxPhoto.uri} />}
					<Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, textAlign: "center", paddingBottom: 6 }}>Pinch to zoom · Double-tap to reset</Text>
					{lightboxPhoto?.name && (
						<View style={{ backgroundColor: "rgba(0,0,0,0.7)", paddingHorizontal: 24, paddingVertical: 16, paddingBottom: Platform.OS === "ios" ? 36 : 16 }}>
							<Text style={{ fontSize: 18, fontWeight: "800", color: "#fff" }}>{lightboxPhoto.name}</Text>
						</View>
					)}
				</View>
			</Modal>
		</View>
	);
}
