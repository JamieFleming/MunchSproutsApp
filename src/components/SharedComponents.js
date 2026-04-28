import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useTheme, useStyles } from "../ThemeContext";
import { Icon, ReactionFace } from "./Icon";
import { reactionCfg } from "../helpers";

export function Card({ children, style, danger = false }) {
	const { C } = useTheme();
	const s = useStyles();
	return (
		<View
			style={[
				s.card,
				danger && { backgroundColor: C.statRedBg, borderColor: "#e07070" },
				style,
			]}>
			{children}
		</View>
	);
}

export function SectionTitle({ children, icon }) {
	const { C } = useTheme();
	const s = useStyles();
	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				gap: 8,
				marginBottom: 14,
			}}>
			{icon && <Icon name={icon} size={16} color={C.primaryPurple} />}
			<Text style={s.sectionTitle}>{children}</Text>
		</View>
	);
}

export function ReactionBadge({ reaction }) {
	const r = reactionCfg(reaction);
	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				gap: 6,
				backgroundColor: r.bg,
				borderRadius: 999,
				paddingHorizontal: 10,
				paddingVertical: 5,
			}}>
			<ReactionFace reaction={reaction} size={18} />
			<Text style={{ color: r.color, fontSize: 12, fontWeight: "700" }}>
				{reaction}
			</Text>
		</View>
	);
}

export function StatCard({ icon, label, value, color, bg }) {
	const s = useStyles();
	return (
		<View style={[s.statCard, { backgroundColor: bg }]}>
			<Icon name={icon} size={18} color={color} />
			<Text style={[s.statValue, { color }]}>{value}</Text>
			<Text style={s.statLabel}>{label}</Text>
		</View>
	);
}

export function PrimaryBtn({ label, onPress, color, icon }) {
	const { C } = useTheme();
	const s = useStyles();
	return (
		<TouchableOpacity
			onPress={onPress}
			style={[s.btnPrimary, color && { backgroundColor: color }]}
			activeOpacity={0.8}>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					gap: 8,
					justifyContent: "center",
				}}>
				{icon && <Icon name={icon} size={14} color="#ffffff" />}
				<Text style={s.btnPrimaryText}>{label}</Text>
			</View>
		</TouchableOpacity>
	);
}

export function SecondaryBtn({ onPress, children, style: extra }) {
	const s = useStyles();
	return (
		<TouchableOpacity
			onPress={onPress}
			style={[s.btnSecondary, extra]}
			activeOpacity={0.8}>
			{children}
		</TouchableOpacity>
	);
}

export function DangerBtn({ onPress, children, style: extra }) {
	const s = useStyles();
	return (
		<TouchableOpacity
			onPress={onPress}
			style={[s.btnDanger, extra]}
			activeOpacity={0.8}>
			{children}
		</TouchableOpacity>
	);
}
