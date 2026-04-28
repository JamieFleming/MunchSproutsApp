import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Image } from "react-native";
import { useTheme, useStyles } from "../ThemeContext";
import { Icon, CategoryIcon, ReactionFace } from "./Icon";
import { PrimaryBtn } from "./SharedComponents";
import { PickerModal } from "./PickerModal";
import { DateField } from "./DatePickerModal";
import { CATEGORIES, FORMS, REACTIONS, MEAL_TIMES } from "../constants";
import { pickImageAsBase64 } from "../helpers";

const EMPTY_FORM = {
	date: "",
	name: "",
	categories: [],
	category: "",
	form: "",
	reaction: "",
	notes: "",
	favourite: false,
	ml: "",
	photoUri: "",
	mealTime: "",
};

function parseCategories(cat) {
	if (!cat) return [];
	if (Array.isArray(cat)) return cat;
	return [cat];
}

export function FoodForm({
	onSubmit,
	initial = {},
	buttonLabel = "Add to Log",
	isPro = false,
}) {
	const { C } = useTheme();
	const s = useStyles();
	const today = new Date().toISOString().split("T")[0];

	const [form, setForm] = useState({
		...EMPTY_FORM,
		date: today,
		...initial,
		categories: parseCategories(initial.category || initial.categories),
	});
	const [showFormPicker, setShowFormPicker] = useState(false);
	const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

	const toggleCategory = (val) => {
		setForm((p) => {
			const cats = p.categories || [];
			const exists = cats.includes(val);
			const updated = exists ? cats.filter((c) => c !== val) : [...cats, val];
			return { ...p, categories: updated, category: updated[0] || "" };
		});
	};

	const isLiquids = (form.categories || []).includes("Liquids");

	const handleSubmit = () => {
		const cats = form.categories || [];
		if (!form.date || !form.name || cats.length === 0) {
			onSubmit(null, "Please fill in Date, Name and at least one Category.");
			return;
		}
		const submitData = {
			...form,
			category: cats[0] || "",
			categories: cats,
			ml: isLiquids ? form.ml || "" : "",
		};
		onSubmit(submitData);
		if (!initial.id)
			setForm({ ...EMPTY_FORM, date: today });
	};

	return (
		<View style={{ gap: 18 }}>
			<DateField
				label="Date"
				value={form.date}
				onChange={(v) => set("date", v)}
				minYear={2020}
				maxYear={new Date().getFullYear() + 1}
			/>

			<View>
				<Text style={s.label}>Meal Time (optional)</Text>
				<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
					{MEAL_TIMES.map((m) => {
						const sel = form.mealTime === m.value;
						return (
							<TouchableOpacity
								key={m.value}
								onPress={() => set("mealTime", sel ? "" : m.value)}
								style={{
									flexDirection: "row",
									alignItems: "center",
									gap: 5,
									paddingHorizontal: 12,
									paddingVertical: 8,
									borderRadius: 999,
									backgroundColor: sel ? m.color : C.white,
									borderWidth: 2,
									borderColor: sel ? m.color : C.borderLight,
								}}
								activeOpacity={0.8}>
								<Text style={{ fontSize: 12, fontWeight: "700", color: sel ? "#ffffff" : C.mutedText }}>
									{m.value}
								</Text>
							</TouchableOpacity>
						);
					})}
				</View>
			</View>

			<View>
				<Text style={s.label}>Food or Drink Name</Text>
				<TextInput
					value={form.name}
					onChangeText={(v) => set("name", v)}
					placeholder="e.g. Banana, Water, Formula"
					style={[s.input, { backgroundColor: C.white }]}
					placeholderTextColor={C.mutedText}
					autoComplete="off"
					autoCorrect={false}
				/>
			</View>

			<View>
				<View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
					<Text style={s.label}>Category</Text>
					{(form.categories || []).length > 0 && (
						<Text style={{ fontSize: 11, color: C.primaryPurple, fontWeight: "700" }}>
							{(form.categories || []).join(" · ")}
						</Text>
					)}
				</View>
				<Text style={{ fontSize: 11, color: C.mutedText, marginBottom: 10, marginTop: -4 }}>
					Tap to select — you can pick multiple
				</Text>
				<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
					{CATEGORIES.map((c) => {
						const sel = (form.categories || []).includes(c.value);
						return (
							<TouchableOpacity
								key={c.value}
								onPress={() => toggleCategory(c.value)}
								style={{ alignItems: "center", gap: 6, width: "22%", opacity: sel ? 1 : 0.65 }}
								activeOpacity={0.8}>
								<View
									style={{
										borderWidth: 2.5,
										borderColor: sel ? c.color : "transparent",
										borderRadius: 16,
										padding: 2,
									}}>
									<CategoryIcon category={c.value} size={48} />
									{sel && (
										<View
											style={{
												position: "absolute",
												top: -4,
												right: -4,
												width: 18,
												height: 18,
												borderRadius: 9,
												backgroundColor: c.color,
												alignItems: "center",
												justifyContent: "center",
											}}>
											<Icon name="check" size={11} color="#ffffff" />
										</View>
									)}
								</View>
								<Text style={{ fontSize: 9, fontWeight: "700", color: sel ? c.color : C.mutedText, textAlign: "center", textTransform: "uppercase" }}>
									{c.value}
								</Text>
							</TouchableOpacity>
						);
					})}
				</View>
			</View>

			{isLiquids && (
				<View>
					<Text style={s.label}>Amount (ml) — optional</Text>
					<View style={[s.input, { flexDirection: "row", alignItems: "center", backgroundColor: C.white, gap: 8 }]}>
						<TextInput
							value={form.ml}
							onChangeText={(v) => set("ml", v.replace(/[^0-9]/g, ""))}
							placeholder="e.g. 120"
							keyboardType="number-pad"
							style={{ flex: 1, color: C.textCharcoal, fontWeight: "600", fontSize: 15 }}
							placeholderTextColor={C.mutedText}
							autoComplete="off"
						/>
						<Text style={{ fontSize: 14, fontWeight: "700", color: C.mutedText }}>ml</Text>
					</View>
					<Text style={{ fontSize: 11, color: C.mutedText, marginTop: 6 }}>
						Record how much your baby drank
					</Text>
				</View>
			)}

			<View>
				<Text style={s.label}>Form / Texture</Text>
				<TouchableOpacity
					onPress={() => setShowFormPicker(true)}
					style={[s.input, { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: C.white }]}>
					<Text style={{ color: form.form ? C.textCharcoal : C.mutedText, fontWeight: "600" }}>
						{form.form || "Select form…"}
					</Text>
					<Icon name="chevDown" size={14} color={C.mutedText} />
				</TouchableOpacity>
				<PickerModal
					visible={showFormPicker}
					title="Form / Texture"
					options={FORMS}
					value={form.form}
					onSelect={(v) => set("form", v)}
					onClose={() => setShowFormPicker(false)}
				/>
			</View>

			<View>
				<Text style={s.label}>Reaction</Text>
				<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
					{REACTIONS.map((r) => {
						const sel = form.reaction === r.value;
						return (
							<TouchableOpacity
								key={r.value}
								onPress={() => set("reaction", r.value)}
								style={{
									backgroundColor: sel ? r.bg : C.white,
									borderColor: sel ? r.border : C.borderLight,
									borderWidth: 2,
									borderRadius: 16,
									paddingVertical: 10,
									paddingHorizontal: 6,
									flex: 1,
									alignItems: "center",
									gap: 6,
									minWidth: "18%",
									shadowColor: "#000",
									shadowOpacity: sel ? 0 : 0.03,
									shadowRadius: 4,
									elevation: sel ? 0 : 1,
								}}
								activeOpacity={0.8}>
								<ReactionFace reaction={r.value} size={32} />
								<Text style={{ fontWeight: "700", fontSize: 10, color: sel ? r.color : C.mutedText, textAlign: "center" }}>
									{r.value}
								</Text>
							</TouchableOpacity>
						);
					})}
				</View>
			</View>

			<View>
				<Text style={s.label}>Notes (optional)</Text>
				<TextInput
					value={form.notes}
					onChangeText={(v) => set("notes", v)}
					placeholder="Texture feedback, observations…"
					multiline
					numberOfLines={3}
					style={[s.input, { height: 80, textAlignVertical: "top", backgroundColor: C.white }]}
					placeholderTextColor={C.mutedText}
					autoComplete="off"
				/>
			</View>

			<TouchableOpacity
				onPress={() => set("favourite", !form.favourite)}
				style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
				activeOpacity={0.8}>
				<View
					style={{
						width: 24,
						height: 24,
						borderRadius: 8,
						borderWidth: 2,
						borderColor: C.primaryPurple,
						backgroundColor: form.favourite ? C.primaryPurple : C.white,
						alignItems: "center",
						justifyContent: "center",
					}}>
					{form.favourite && <Icon name="check" size={14} color="#ffffff" />}
				</View>
				<Icon name="starFill" size={16} color="#d4a017" />
				<Text style={{ fontWeight: "700", fontSize: 13, color: C.textCharcoal }}>
					Mark as Favourite
				</Text>
			</TouchableOpacity>

			<View>
				<View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
					<Text style={s.label}>Memory Photo (optional)</Text>
					{!isPro && (
						<View style={{ backgroundColor: C.warningStroke, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
							<Text style={{ fontSize: 10, fontWeight: "700", color: "#ffffff" }}>PRO</Text>
						</View>
					)}
				</View>
				{isPro ? (
					<TouchableOpacity
						onPress={async () => {
							const uri = await pickImageAsBase64([4, 3]);
							if (uri) set("photoUri", uri);
						}}
						style={{
							borderWidth: 2,
							borderColor: form.photoUri ? C.primaryPurple : C.borderLight,
							borderStyle: form.photoUri ? "solid" : "dashed",
							borderRadius: 16,
							overflow: "hidden",
							minHeight: 120,
							alignItems: "center",
							justifyContent: "center",
						}}
						activeOpacity={0.8}>
						{form.photoUri ? (
							<>
								<Image source={{ uri: form.photoUri }} style={{ width: "100%", height: 180, borderRadius: 14 }} resizeMode="cover" />
								<TouchableOpacity
									onPress={() => set("photoUri", null)}
									style={{ position: "absolute", top: 8, right: 8, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 999, padding: 6 }}>
									<Icon name="close" size={14} color="#ffffff" />
								</TouchableOpacity>
							</>
						) : (
							<View style={{ alignItems: "center", gap: 8, paddingVertical: 24 }}>
								<Icon name="image" size={32} color={C.mutedText} />
								<Text style={{ fontSize: 13, color: C.mutedText, fontWeight: "600" }}>
									Tap to add a photo memory
								</Text>
							</View>
						)}
					</TouchableOpacity>
				) : (
					<View
						style={{
							borderWidth: 2,
							borderColor: C.borderLight,
							borderStyle: "dashed",
							borderRadius: 16,
							minHeight: 120,
							alignItems: "center",
							justifyContent: "center",
							opacity: 0.6,
						}}>
						<View style={{ alignItems: "center", gap: 8, paddingVertical: 24 }}>
							<Icon name="lock" size={28} color={C.mutedText} />
							<Text style={{ fontSize: 13, color: C.mutedText, fontWeight: "600" }}>
								Photo memories — Pro only
							</Text>
							<Text style={{ fontSize: 11, color: C.mutedText, textAlign: "center", paddingHorizontal: 20 }}>
								Upgrade to Pro to attach photos to food log entries
							</Text>
						</View>
					</View>
				)}
			</View>

			<PrimaryBtn label={buttonLabel} onPress={handleSubmit} />
		</View>
	);
}
