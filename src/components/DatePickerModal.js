import React, { useState } from "react";
import { View, Text, TouchableOpacity, Modal } from "react-native";
import { useTheme, useStyles } from "../ThemeContext";
import { Icon } from "./Icon";
import { PickerModal } from "./PickerModal";
import { MONTHS } from "../constants";
import { formatDate, getDaysInMonth, buildYears, buildDays } from "../helpers";

export function DatePickerModal({
	visible,
	title,
	value,
	onSelect,
	onClose,
	minYear = 2000,
	maxYear = new Date().getFullYear(),
}) {
	const { C } = useTheme();
	const s = useStyles();
	const parseDate = (v) => {
		if (v) {
			const d = new Date(v);
			if (!isNaN(d))
				return {
					day: String(d.getDate()).padStart(2, "0"),
					month: d.getMonth(),
					year: String(d.getFullYear()),
				};
		}
		const now = new Date();
		return {
			day: String(now.getDate()).padStart(2, "0"),
			month: now.getMonth(),
			year: String(now.getFullYear()),
		};
	};
	const initial = parseDate(value);
	const [day, setDay] = useState(initial.day);
	const [month, setMonth] = useState(initial.month);
	const [year, setYear] = useState(initial.year);
	const [showDay, setShowDay] = useState(false);
	const [showMonth, setShowMonth] = useState(false);
	const [showYear, setShowYear] = useState(false);
	const years = buildYears(minYear, maxYear);
	const days = buildDays(month + 1, parseInt(year));
	const confirm = () => {
		const maxDay = getDaysInMonth(month + 1, parseInt(year));
		const safeDay = Math.min(parseInt(day), maxDay);
		const d = String(safeDay).padStart(2, "0");
		const m = String(month + 1).padStart(2, "0");
		onSelect(`${year}-${m}-${d}`);
		onClose();
	};
	if (!visible) return null;
	return (
		<Modal
			visible={visible}
			transparent
			animationType="slide"
			onRequestClose={onClose}>
			<TouchableOpacity
				style={s.pickerOverlay}
				onPress={onClose}
				activeOpacity={1}>
				<View
					style={[s.pickerSheet, { maxHeight: "70%" }]}
					onStartShouldSetResponder={() => true}>
					<Text style={s.pickerTitle}>{title}</Text>
					<View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
						<View style={{ flex: 1 }}>
							<Text style={[s.label, { marginBottom: 6 }]}>Day</Text>
							<TouchableOpacity
								onPress={() => setShowDay(true)}
								style={[s.input, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}>
								<Text style={{ color: C.textCharcoal, fontWeight: "600" }}>{day}</Text>
								<Icon name="chevDown" size={14} color={C.mutedText} />
							</TouchableOpacity>
						</View>
						<View style={{ flex: 1.5 }}>
							<Text style={[s.label, { marginBottom: 6 }]}>Month</Text>
							<TouchableOpacity
								onPress={() => setShowMonth(true)}
								style={[s.input, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}>
								<Text style={{ color: C.textCharcoal, fontWeight: "600" }}>{MONTHS[month]}</Text>
								<Icon name="chevDown" size={14} color={C.mutedText} />
							</TouchableOpacity>
						</View>
						<View style={{ flex: 1.2 }}>
							<Text style={[s.label, { marginBottom: 6 }]}>Year</Text>
							<TouchableOpacity
								onPress={() => setShowYear(true)}
								style={[s.input, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}>
								<Text style={{ color: C.textCharcoal, fontWeight: "600" }}>{year}</Text>
								<Icon name="chevDown" size={14} color={C.mutedText} />
							</TouchableOpacity>
						</View>
					</View>
					<View style={{ backgroundColor: C.bgPurple, borderRadius: 12, padding: 12, marginBottom: 16, alignItems: "center" }}>
						<Text style={{ color: C.primaryPinkDark, fontWeight: "700", fontSize: 14 }}>
							{formatDate(`${year}-${String(month + 1).padStart(2, "0")}-${day}`)}
						</Text>
					</View>
					<TouchableOpacity onPress={confirm} style={s.btnPrimary}>
						<Text style={s.btnPrimaryText}>Confirm Date</Text>
					</TouchableOpacity>
					<PickerModal visible={showDay} title="Day" options={days} value={day} onSelect={setDay} onClose={() => setShowDay(false)} />
					<PickerModal visible={showMonth} title="Month" options={MONTHS} value={MONTHS[month]} onSelect={(v) => setMonth(MONTHS.indexOf(v))} onClose={() => setShowMonth(false)} />
					<PickerModal visible={showYear} title="Year" options={years} value={year} onSelect={setYear} onClose={() => setShowYear(false)} />
				</View>
			</TouchableOpacity>
		</Modal>
	);
}

export function DateField({ label, value, onChange, minYear, maxYear }) {
	const { C } = useTheme();
	const s = useStyles();
	const [open, setOpen] = useState(false);
	return (
		<View>
			<Text style={s.label}>{label}</Text>
			<TouchableOpacity
				onPress={() => setOpen(true)}
				style={[s.input, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}>
				<Text style={{ color: value ? C.textCharcoal : C.mutedText, fontWeight: "600" }}>
					{value ? formatDate(value) : "Select date…"}
				</Text>
				<Icon name="calendar" size={16} color={C.mutedText} />
			</TouchableOpacity>
			<DatePickerModal
				visible={open}
				title={label}
				value={value}
				onSelect={onChange}
				onClose={() => setOpen(false)}
				minYear={minYear}
				maxYear={maxYear}
			/>
		</View>
	);
}
