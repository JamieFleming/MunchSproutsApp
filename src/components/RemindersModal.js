import React, { useState } from "react";
import {
	View,
	Text,
	Modal,
	ScrollView,
	TouchableOpacity,
	Platform,
	Alert,
	ActivityIndicator,
} from "react-native";
import { useTheme } from "../ThemeContext";
import { Icon } from "./Icon";
import {
	requestNotificationPermission,
	scheduleReminders,
	cancelAllReminders,
	DEFAULT_NOTIFICATION_PREFS,
} from "../notifications";

// ── Time options ──────────────────────────────────────────────────────────────
const QUIET_START_OPTIONS = [
	{ label: "6 pm",      value: "18:00" },
	{ label: "7 pm",      value: "19:00" },
	{ label: "8 pm",      value: "20:00" },
	{ label: "9 pm",      value: "21:00" },
	{ label: "10 pm",     value: "22:00" },
	{ label: "11 pm",     value: "23:00" },
	{ label: "Midnight",  value: "00:00" },
];

const QUIET_END_OPTIONS = [
	{ label: "5 am",  value: "05:00" },
	{ label: "6 am",  value: "06:00" },
	{ label: "7 am",  value: "07:00" },
	{ label: "8 am",  value: "08:00" },
	{ label: "9 am",  value: "09:00" },
	{ label: "10 am", value: "10:00" },
];

const INTERVAL_OPTIONS = [
	{ label: "Every 3 hrs", value: 3 },
	{ label: "Every 4 hrs", value: 4 },
	{ label: "Every 5 hrs", value: 5 },
];

const SOUND_OPTIONS = [
	{ label: "Default",  value: "default",  icon: "volume" },
	{ label: "Silent",   value: "silent",   icon: "volumeOff" },
];

// ── Toggle pill ───────────────────────────────────────────────────────────────
function TogglePill({ value, onToggle, C }) {
	return (
		<TouchableOpacity
			onPress={onToggle}
			activeOpacity={0.85}
			style={{
				width: 48,
				height: 28,
				borderRadius: 14,
				backgroundColor: value ? C.primaryPurple : C.borderLight,
				justifyContent: "center",
				paddingHorizontal: 3,
			}}>
			<View
				style={{
					width: 22,
					height: 22,
					borderRadius: 11,
					backgroundColor: "#ffffff",
					alignSelf: value ? "flex-end" : "flex-start",
					shadowColor: "#000",
					shadowOpacity: 0.15,
					shadowRadius: 2,
					elevation: 2,
				}}
			/>
		</TouchableOpacity>
	);
}

// ── Chip row ──────────────────────────────────────────────────────────────────
function ChipRow({ options, value, onChange, C }) {
	return (
		<ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
			<View style={{ flexDirection: "row", gap: 8, paddingRight: 16 }}>
				{options.map((opt) => {
					const active = opt.value === value;
					return (
						<TouchableOpacity
							key={opt.value}
							onPress={() => onChange(opt.value)}
							activeOpacity={0.8}
							style={{
								paddingHorizontal: 14,
								paddingVertical: 8,
								borderRadius: 999,
								backgroundColor: active ? C.primaryPurple : C.bgPurple,
								borderWidth: 1.5,
								borderColor: active ? C.primaryPurple : "transparent",
							}}>
							<Text
								style={{
									fontSize: 13,
									fontFamily: "NunitoSans_700Bold",
									color: active ? "#ffffff" : C.textCharcoal,
								}}>
								{opt.label}
							</Text>
						</TouchableOpacity>
					);
				})}
			</View>
		</ScrollView>
	);
}

// ── Section card ──────────────────────────────────────────────────────────────
function SectionCard({ children, C, style }) {
	return (
		<View
			style={[
				{
					backgroundColor: C.white,
					borderRadius: 18,
					padding: 18,
					marginBottom: 14,
					shadowColor: "#000",
					shadowOpacity: 0.05,
					shadowRadius: 8,
					elevation: 2,
				},
				style,
			]}>
			{children}
		</View>
	);
}

// ── Main component ────────────────────────────────────────────────────────────
export function RemindersModal({ visible, onClose, prefs: initialPrefs, onSave }) {
	const { C } = useTheme();
	const [prefs, setPrefs] = useState(initialPrefs || DEFAULT_NOTIFICATION_PREFS);
	const [saving, setSaving] = useState(false);

	// Keep in sync when parent passes updated prefs
	React.useEffect(() => {
		if (visible) setPrefs(initialPrefs || DEFAULT_NOTIFICATION_PREFS);
	}, [visible]);

	const set = (key, val) => setPrefs((p) => ({ ...p, [key]: val }));

	const handleSave = async () => {
		setSaving(true);
		try {
			if (prefs.enabled) {
				const granted = await requestNotificationPermission();
				if (!granted) {
					Alert.alert(
						"Permission needed",
						"Please allow notifications in your device Settings to enable reminders.",
					);
					setSaving(false);
					return;
				}
				await scheduleReminders(prefs);
			} else {
				await cancelAllReminders();
			}
			await onSave(prefs);
			onClose();
		} catch (e) {
			console.warn("Failed to save reminders:", e.message);
			Alert.alert("Error", "Could not save reminder settings. Please try again.");
		} finally {
			setSaving(false);
		}
	};

	return (
		<Modal
			visible={visible}
			animationType="slide"
			presentationStyle="pageSheet"
			onRequestClose={onClose}>
			<View style={{ flex: 1, backgroundColor: C.bgMain }}>
				{/* Header */}
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						justifyContent: "space-between",
						paddingHorizontal: 20,
						paddingTop: Platform.OS === "ios" ? 20 : 20,
						paddingBottom: 16,
						backgroundColor: C.white,
						borderBottomWidth: 1,
						borderBottomColor: C.borderLight,
					}}>
					<View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
						<View
							style={{
								width: 36,
								height: 36,
								borderRadius: 11,
								backgroundColor: C.bgPurple,
								alignItems: "center",
								justifyContent: "center",
							}}>
							<Icon name="bell" size={18} color={C.primaryPurple} />
						</View>
						<Text style={{ fontFamily: "NunitoSans_800ExtraBold", fontSize: 20, color: C.primaryPinkDark }}>
							Reminders
						</Text>
					</View>
					<TouchableOpacity
						onPress={onClose}
						style={{
							backgroundColor: C.bgPurple,
							borderRadius: 10,
							padding: 10,
						}}>
						<Icon name="close" size={18} color={C.mutedText} />
					</TouchableOpacity>
				</View>

				<ScrollView
					contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
					showsVerticalScrollIndicator={false}>

					{/* Enable toggle */}
					<SectionCard C={C}>
						<TouchableOpacity
							onPress={() => set("enabled", !prefs.enabled)}
							activeOpacity={0.8}
							style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
							<View
								style={{
									width: 42,
									height: 42,
									borderRadius: 13,
									backgroundColor: prefs.enabled ? C.bgPurple : C.borderLight,
									alignItems: "center",
									justifyContent: "center",
								}}>
								<Icon
									name={prefs.enabled ? "bell" : "bellOff"}
									size={20}
									color={prefs.enabled ? C.primaryPurple : C.mutedText}
								/>
							</View>
							<View style={{ flex: 1 }}>
								<Text style={{ fontFamily: "NunitoSans_700Bold", fontSize: 15, color: C.textCharcoal }}>
									Log Reminders
								</Text>
								<Text style={{ fontSize: 12, color: C.mutedText, marginTop: 2 }}>
									{prefs.enabled
										? "Reminders are on"
										: "Get nudged to log your baby's meals"}
								</Text>
							</View>
							<TogglePill value={prefs.enabled} onToggle={() => set("enabled", !prefs.enabled)} C={C} />
						</TouchableOpacity>
					</SectionCard>

					{prefs.enabled && (
						<>
							{/* Interval */}
							<SectionCard C={C}>
								<View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 }}>
									<Icon name="clock" size={16} color={C.primaryPurple} />
									<Text style={{ fontFamily: "NunitoSans_700Bold", fontSize: 14, color: C.textCharcoal }}>
										Reminder Interval
									</Text>
								</View>
								<Text style={{ fontSize: 12, color: C.mutedText }}>
									How often should we remind you?
								</Text>
								<ChipRow
									options={INTERVAL_OPTIONS}
									value={prefs.intervalHours}
									onChange={(v) => set("intervalHours", v)}
									C={C}
								/>
							</SectionCard>

							{/* Quiet hours */}
							<SectionCard C={C}>
								<View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 }}>
									<Icon name="moon" size={16} color="#7b5ea7" />
									<Text style={{ fontFamily: "NunitoSans_700Bold", fontSize: 14, color: C.textCharcoal }}>
										Quiet Hours
									</Text>
								</View>
								<Text style={{ fontSize: 12, color: C.mutedText, marginBottom: 14 }}>
									No reminders will be sent during this time
								</Text>

								<Text style={{ fontSize: 12, fontFamily: "NunitoSans_700Bold", color: C.mutedText, marginBottom: 2 }}>
									DO NOT DISTURB FROM
								</Text>
								<ChipRow
									options={QUIET_START_OPTIONS}
									value={prefs.quietStart}
									onChange={(v) => set("quietStart", v)}
									C={C}
								/>

								<Text style={{ fontSize: 12, fontFamily: "NunitoSans_700Bold", color: C.mutedText, marginTop: 16, marginBottom: 2 }}>
									UNTIL
								</Text>
								<ChipRow
									options={QUIET_END_OPTIONS}
									value={prefs.quietEnd}
									onChange={(v) => set("quietEnd", v)}
									C={C}
								/>

								{/* Preview */}
								<View
									style={{
										marginTop: 16,
										backgroundColor: C.bgPurple,
										borderRadius: 12,
										padding: 12,
										flexDirection: "row",
										alignItems: "center",
										gap: 10,
									}}>
									<Icon name="moon" size={14} color={C.primaryPurple} />
									<Text style={{ fontSize: 12, color: C.primaryPurple, fontFamily: "NunitoSans_600SemiBold", flex: 1 }}>
										{`Quiet from ${formatTime(prefs.quietStart)} to ${formatTime(prefs.quietEnd)}`}
									</Text>
								</View>
							</SectionCard>

							{/* Sound */}
							<SectionCard C={C}>
								<View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 }}>
									<Icon name="volume" size={16} color={C.primaryPurple} />
									<Text style={{ fontFamily: "NunitoSans_700Bold", fontSize: 14, color: C.textCharcoal }}>
										Notification Sound
									</Text>
								</View>
								<View style={{ flexDirection: "row", gap: 10 }}>
									{SOUND_OPTIONS.map((opt) => {
										const active = prefs.sound === opt.value;
										return (
											<TouchableOpacity
												key={opt.value}
												onPress={() => set("sound", opt.value)}
												activeOpacity={0.8}
												style={{
													flex: 1,
													flexDirection: "row",
													alignItems: "center",
													gap: 10,
													padding: 14,
													borderRadius: 14,
													backgroundColor: active ? C.bgPurple : C.bgMain,
													borderWidth: 2,
													borderColor: active ? C.primaryPurple : C.borderLight,
												}}>
												<Icon
													name={opt.icon}
													size={18}
													color={active ? C.primaryPurple : C.mutedText}
												/>
												<Text
													style={{
														fontFamily: "NunitoSans_700Bold",
														fontSize: 14,
														color: active ? C.primaryPurple : C.mutedText,
													}}>
													{opt.label}
												</Text>
												{active && (
													<View style={{ marginLeft: "auto" }}>
														<Icon name="check" size={14} color={C.primaryPurple} />
													</View>
												)}
											</TouchableOpacity>
										);
									})}
								</View>
							</SectionCard>
						</>
					)}

					{/* Save button */}
					<TouchableOpacity
						onPress={handleSave}
						disabled={saving}
						activeOpacity={0.85}
						style={{
							backgroundColor: C.primaryPurple,
							borderRadius: 16,
							paddingVertical: 16,
							alignItems: "center",
							justifyContent: "center",
							opacity: saving ? 0.7 : 1,
							flexDirection: "row",
							gap: 8,
						}}>
						{saving ? (
							<ActivityIndicator color="#ffffff" />
						) : (
							<>
								<Icon name="check" size={18} color="#ffffff" />
								<Text style={{ color: "#ffffff", fontFamily: "NunitoSans_800ExtraBold", fontSize: 16 }}>
									Save Reminders
								</Text>
							</>
						)}
					</TouchableOpacity>

					{prefs.enabled && (
						<Text
							style={{
								fontSize: 11,
								color: C.mutedText,
								textAlign: "center",
								marginTop: 12,
								lineHeight: 16,
							}}>
							Reminders will appear even when the app is closed.{"\n"}
							You can turn them off at any time.
						</Text>
					)}
				</ScrollView>
			</View>
		</Modal>
	);
}

// ── Helper ────────────────────────────────────────────────────────────────────
function formatTime(t) {
	if (!t) return "";
	const [h] = t.split(":").map(Number);
	if (h === 0) return "midnight";
	if (h === 12) return "12 pm";
	return h < 12 ? `${h} am` : `${h - 12} pm`;
}
