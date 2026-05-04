import React from "react";
import {
	View,
	Text,
	TouchableOpacity,
	ScrollView,
	Linking,
} from "react-native";
import { useTheme, useStyles } from "../ThemeContext";
import { Icon } from "../components/Icon";
import { ALLERGENS } from "../constants";
import { computeAllergenStatus, formatDate } from "../helpers";

const STATUS_CFG = {
	Safe: {
		label: "Safely Tried",
		color: "#2d7a55",
		bg: "#d4f0e0",
		border: "#a8dcc0",
	},
	"In Progress": {
		label: "In Progress",
		color: "#a85a1a",
		bg: "#fde8d4",
		border: "#ddc8a8",
	},
	Reaction: {
		label: "Had Reaction",
		color: "#c0392b",
		bg: "#fde8e8",
		border: "#e07070",
	},
	"Not Tried": {
		label: "Not Tried",
		color: "#8a7aaa",
		bg: "#f0ecfc",
		border: "#c4b0f0",
	},
};

const ADVICE_TIPS = [
	"Introduce one new allergen at a time",
	"Wait 2–3 days before introducing the next allergen to spot any reaction",
	"Start with a small amount and increase gradually over the following days",
	"Introduce new allergens in the morning or at lunchtime so you can monitor your baby during the day",
	"Once introduced safely, keep giving the allergen regularly (e.g. 2–3 times per week) to maintain tolerance",
	"If your baby has eczema or an existing food allergy, speak to your GP or allergy specialist before starting",
];

export function AllergenScreen({ foodLog = [], onNavigate }) {
	const { C } = useTheme();
	const s = useStyles();

	const allergenStatus = computeAllergenStatus(foodLog, ALLERGENS);

	const introduced = allergenStatus.filter(
		(a) => a.status !== "Not Tried",
	).length;
	const safe = allergenStatus.filter((a) => a.status === "Safe").length;
	const inProgress = allergenStatus.filter(
		(a) => a.status === "In Progress",
	).length;
	const reactions = allergenStatus.filter(
		(a) => a.status === "Reaction",
	).length;
	const pct = Math.round((introduced / ALLERGENS.length) * 100);

	return (
		<ScrollView
			showsVerticalScrollIndicator={false}
			contentContainerStyle={{ paddingBottom: 30 }}>
			{/* ── Stats Row ── */}
			<View style={{ flexDirection: "row", gap: 8, marginBottom: 18 }}>
				{[
					{
						label: "Introduced",
						value: introduced,
						color: C.primaryPurple,
						bg: C.bgPurple,
					},
					{ label: "Safe", value: safe, color: "#2d7a55", bg: "#d4f0e0" },
					{
						label: "In Progress",
						value: inProgress,
						color: "#a85a1a",
						bg: "#fde8d4",
					},
					{
						label: "Reactions",
						value: reactions,
						color: "#c0392b",
						bg: "#fde8e8",
					},
				].map((stat) => (
					<View
						key={stat.label}
						style={{
							flex: 1,
							backgroundColor: stat.bg,
							borderRadius: 14,
							padding: 12,
							alignItems: "center",
						}}>
						<Text
							style={{
								fontSize: 22,
								fontWeight: "900",
								color: stat.color,
								lineHeight: 26,
							}}>
							{stat.value}
						</Text>
						<Text
							style={{
								fontSize: 9,
								fontWeight: "700",
								color: stat.color,
								textAlign: "center",
								marginTop: 3,
								textTransform: "uppercase",
								letterSpacing: 0.3,
							}}>
							{stat.label}
						</Text>
					</View>
				))}
			</View>

			{/* ── Progress Card ── */}
			<View style={[s.card, { marginBottom: 18 }]}>
				<View
					style={{
						flexDirection: "row",
						justifyContent: "space-between",
						alignItems: "center",
						marginBottom: 12,
					}}>
					<View>
						<Text style={s.sectionTitle}>Allergen Progress</Text>
						<Text style={{ fontSize: 12, color: C.mutedText, marginTop: 2 }}>
							{ALLERGENS.length - introduced} still to introduce
						</Text>
					</View>
					<View style={{ alignItems: "flex-end" }}>
						<Text
							style={{
								fontSize: 28,
								fontWeight: "900",
								color: C.primaryPinkDark,
								lineHeight: 30,
							}}>
							{introduced}
						</Text>
						<Text
							style={{ fontSize: 11, color: C.mutedText, fontWeight: "600" }}>
							of {ALLERGENS.length}
						</Text>
					</View>
				</View>
				<View
					style={{
						backgroundColor: C.borderLight,
						borderRadius: 999,
						height: 12,
						overflow: "hidden",
					}}>
					<View
						style={{
							backgroundColor: "#3db87a",
							height: "100%",
							width: `${pct}%`,
							borderRadius: 999,
						}}
					/>
				</View>
				{pct > 0 && (
					<Text
						style={{
							fontSize: 11,
							color: C.mutedText,
							marginTop: 6,
							textAlign: "right",
						}}>
						{pct}% complete
					</Text>
				)}
			</View>

			{/* ── Allergen Tracker Timeline ── */}
			<Text style={[s.sectionTitle, { marginBottom: 10 }]}>
				Allergen Timeline
			</Text>
			<View
				style={[s.card, { padding: 0, overflow: "hidden", marginBottom: 18 }]}>
				{allergenStatus.map((al, index) => {
					const cfg = STATUS_CFG[al.status];
					return (
						<View
							key={al.value}
							style={{
								flexDirection: "row",
								alignItems: "center",
								paddingVertical: 13,
								paddingHorizontal: 16,
								borderBottomWidth: index < allergenStatus.length - 1 ? 1 : 0,
								borderBottomColor: C.borderLight,
								backgroundColor:
									al.status === "Reaction" ? "#fff5f5" : "transparent",
							}}>
							{/* Emoji badge */}
							<View
								style={{
									width: 42,
									height: 42,
									borderRadius: 12,
									backgroundColor:
										al.status !== "Not Tried" ? al.bg : C.bgPurple,
									alignItems: "center",
									justifyContent: "center",
									marginRight: 12,
								}}>
								<Text style={{ fontSize: 22 }}>{al.emoji}</Text>
							</View>

							{/* Name + dates */}
							<View style={{ flex: 1 }}>
								<Text
									style={{
										fontWeight: "700",
										fontSize: 14,
										color: C.primaryPinkDark,
									}}>
									{al.value}
								</Text>
								{al.firstDate ? (
									<Text
										style={{ fontSize: 11, color: C.mutedText, marginTop: 2 }}>
										First: {formatDate(al.firstDate)}
										{al.lastDate && al.lastDate !== al.firstDate
											? ` · Last: ${formatDate(al.lastDate)}`
											: ""}
										{al.count > 1 ? ` · ${al.count} entries` : ""}
									</Text>
								) : (
									<Text
										style={{ fontSize: 11, color: C.mutedText, marginTop: 2 }}>
										Not yet introduced
									</Text>
								)}
							</View>

							{/* Status pill */}
							<View
								style={{
									backgroundColor: cfg.bg,
									borderRadius: 999,
									paddingHorizontal: 10,
									paddingVertical: 5,
									borderWidth: 1,
									borderColor: cfg.border,
									marginLeft: 8,
								}}>
								<Text
									style={{
										fontSize: 10,
										fontWeight: "700",
										color: cfg.color,
									}}>
									{cfg.label}
								</Text>
							</View>
						</View>
					);
				})}
			</View>

			{/* ── Introduction Advice ── */}
			<Text style={[s.sectionTitle, { marginBottom: 10 }]}>
				Introduction Advice
			</Text>
			<View style={[s.card, { marginBottom: 12 }]}>
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: 10,
						marginBottom: 16,
					}}>
					<View
						style={{
							width: 38,
							height: 38,
							borderRadius: 11,
							backgroundColor: "#d4e8f5",
							alignItems: "center",
							justifyContent: "center",
						}}>
						<Icon name="info" size={18} color="#2a5f8f" />
					</View>
					<Text
						style={{
							fontWeight: "800",
							fontSize: 15,
							color: C.primaryPinkDark,
							flex: 1,
						}}>
						How to introduce allergens safely
					</Text>
				</View>

				{ADVICE_TIPS.map((tip, i) => (
					<View
						key={i}
						style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
						<View
							style={{
								width: 22,
								height: 22,
								borderRadius: 11,
								backgroundColor: C.bgPurple,
								alignItems: "center",
								justifyContent: "center",
								flexShrink: 0,
								marginTop: 1,
							}}>
							<Text
								style={{
									fontSize: 10,
									fontWeight: "800",
									color: C.primaryPurple,
								}}>
								{i + 1}
							</Text>
						</View>
						<Text
							style={{
								fontSize: 13,
								color: C.textCharcoal,
								lineHeight: 20,
								flex: 1,
							}}>
							{tip}
						</Text>
					</View>
				))}

				{/* NHS Link */}
				<TouchableOpacity
					onPress={() =>
						Linking.openURL(
							"https://www.nhs.uk/baby/weaning-and-feeding/food-allergies-in-babies-and-young-children/",
						)
					}
					style={{
						flexDirection: "row",
						alignItems: "center",
						justifyContent: "center",
						gap: 8,
						backgroundColor: "#d4e8f5",
						borderRadius: 12,
						paddingVertical: 13,
						marginTop: 6,
					}}
					activeOpacity={0.8}>
					<Icon name="info" size={16} color="#2a5f8f" />
					<Text style={{ fontWeight: "700", fontSize: 14, color: "#2a5f8f" }}>
						View NHS Allergen Guidance
					</Text>
				</TouchableOpacity>
			</View>

			{/* ── Medical Disclaimer ── */}
			<View
				style={{
					backgroundColor: "#fff8e1",
					borderRadius: 14,
					padding: 14,
					flexDirection: "row",
					gap: 10,
				}}>
				<Icon name="alert" size={18} color="#d4860a" />
				<Text
					style={{ fontSize: 12, color: "#7a5a1a", lineHeight: 19, flex: 1 }}>
					<Text style={{ fontWeight: "800" }}>For general guidance only.</Text>{" "}
					This tracker is{" "}
					<Text style={{ fontWeight: "700" }}>
						not a substitute for medical advice.
					</Text>{" "}
					Always consult your GP, Health Visitor or a registered dietitian
					before introducing allergens, especially if your baby has eczema, an
					existing allergy, or you have any concerns.
				</Text>
			</View>
		</ScrollView>
	);
}
