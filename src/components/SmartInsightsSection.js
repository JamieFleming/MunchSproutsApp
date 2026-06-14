/**
 * SmartInsightsSection
 *
 * Renders AI-powered growth, nutrition and milk insights for the Child Detail screen.
 * Scores (nutrition variety, weekly trend, milk intake) are computed locally — free, instant.
 * AI narrative text is fetched from the generateInsights Cloud Function and
 * cached in Firestore for 24 hours.
 *
 * All data shown is GUIDANCE ONLY based on NHS/WHO published standards.
 * It is not medical advice. Always refer parents to their healthcare team.
 */

import React, { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getApp } from "firebase/app";
import { useTheme } from "../ThemeContext";
import { Icon } from "./Icon";
import {
	computeNutritionScore,
	computeTrends,
	computeMilestones,
	computeMilkInsight,
	buildInsightPayload,
	MILESTONES,
} from "../smartInsights";

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function ScoreRing({ score }) {
	const color = score >= 70 ? "#16a34a" : score >= 40 ? "#d4860a" : "#c0392b";
	const bg    = score >= 70 ? "#f0fdf4" : score >= 40 ? "#fff7ed" : "#fef2f2";
	return (
		<View style={{ alignItems: "center", justifyContent: "center", width: 80, height: 80, borderRadius: 40, backgroundColor: bg, borderWidth: 4, borderColor: color + "40" }}>
			<Text style={{ fontSize: 22, fontFamily: "PlusJakartaSans_700Bold", color }}>{score}</Text>
			<Text style={{ fontSize: 9, fontFamily: "NunitoSans_700Bold", color, letterSpacing: 0.3 }}>/ 100</Text>
		</View>
	);
}

function SkeletonLine({ width = "100%", height = 14, style }) {
	const { C } = useTheme();
	return <View style={[{ width, height, borderRadius: 7, backgroundColor: C.bgPurple }, style]} />;
}

function InsightCard({ icon, iconColor, iconBg, label, text, loading }) {
	const { C } = useTheme();
	return (
		<View style={{ backgroundColor: C.white, borderRadius: 16, padding: 14, gap: 8, borderWidth: 1, borderColor: C.borderLight }}>
			<View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
				<View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: iconBg, alignItems: "center", justifyContent: "center" }}>
					<Icon name={icon} size={16} color={iconColor} />
				</View>
				<Text style={{ fontSize: 13, fontFamily: "PlusJakartaSans_600SemiBold", color: C.primaryPinkDark }}>{label}</Text>
			</View>
			{loading ? (
				<View style={{ gap: 6 }}>
					<SkeletonLine width="95%" />
					<SkeletonLine width="70%" />
				</View>
			) : (
				<Text style={{ fontFamily: "NunitoSans_400Regular", fontSize: 13, color: C.mutedText, lineHeight: 19 }}>{text}</Text>
			)}
		</View>
	);
}

function MilestoneRow({ milestones }) {
	const { C } = useTheme();
	const achievedCount = milestones.filter((m) => m.achieved).length;
	const nextIdx = milestones.findIndex((m) => !m.achieved);
	return (
		<View style={{ gap: 10 }}>
			<View style={{ gap: 6 }}>
				<View style={{ flexDirection: "row", justifyContent: "space-between" }}>
					<Text style={{ fontSize: 12, fontFamily: "NunitoSans_700Bold", color: C.textCharcoal }}>Weaning Journey</Text>
					<Text style={{ fontSize: 12, fontFamily: "NunitoSans_700Bold", color: C.primaryPurple }}>{achievedCount}/{milestones.length}</Text>
				</View>
				<View style={{ height: 6, backgroundColor: C.bgPurple, borderRadius: 3, overflow: "hidden" }}>
					<View style={{ height: 6, width: `${(achievedCount / milestones.length) * 100}%`, backgroundColor: C.primaryPurple, borderRadius: 3 }} />
				</View>
			</View>
			<View style={{ flexDirection: "row", alignItems: "center", gap: 0 }}>
				{milestones.map((m, i) => {
					const isNext = i === nextIdx;
					return (
						<React.Fragment key={m.id}>
							{i > 0 && <View style={{ flex: 1, height: 2, backgroundColor: m.achieved ? C.primaryPurple : C.bgPurple }} />}
							<View style={{ width: isNext ? 28 : 20, height: isNext ? 28 : 20, borderRadius: isNext ? 14 : 10, backgroundColor: m.achieved ? C.primaryPurple : C.bgPurple, borderWidth: isNext ? 2 : 0, borderColor: isNext ? C.primaryPurple : "transparent", alignItems: "center", justifyContent: "center" }}>
								{m.achieved ? <Icon name="check" size={isNext ? 14 : 10} color="#fff" /> : isNext ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.primaryPurple }} /> : null}
							</View>
						</React.Fragment>
					);
				})}
			</View>
			{nextIdx >= 0 && (
				<View style={{ backgroundColor: C.bgPurple, borderRadius: 12, padding: 12, flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
					<Icon name="info" size={14} color={C.primaryPurple} />
					<View style={{ flex: 1 }}>
						<Text style={{ fontSize: 12, fontFamily: "NunitoSans_800ExtraBold", color: C.primaryPurpleDark, marginBottom: 2 }}>Next: {milestones[nextIdx].label}</Text>
						<Text style={{ fontFamily: "NunitoSans_400Regular", fontSize: 12, color: C.mutedText, lineHeight: 17 }}>{milestones[nextIdx].tip}</Text>
					</View>
				</View>
			)}
		</View>
	);
}

function AllergenProgress({ allergenProgress }) {
	const { C } = useTheme();
	const { introduced, missing, count, total } = allergenProgress;
	return (
		<View style={{ gap: 8 }}>
			<View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
				<Text style={{ fontSize: 12, fontFamily: "NunitoSans_700Bold", color: C.textCharcoal }}>Allergens Introduced</Text>
				<Text style={{ fontSize: 12, fontFamily: "NunitoSans_700Bold", color: count >= total ? "#16a34a" : C.primaryPurple }}>{count}/{total}</Text>
			</View>
			<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
				{introduced.map((a) => (
					<View key={a} style={{ backgroundColor: "#f0fdf4", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, flexDirection: "row", alignItems: "center", gap: 4 }}>
						<Icon name="check" size={10} color="#16a34a" />
						<Text style={{ fontSize: 11, fontFamily: "NunitoSans_700Bold", color: "#16a34a" }}>{a}</Text>
					</View>
				))}
				{missing.map((a) => (
					<View key={a} style={{ backgroundColor: C.bgPurple, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 }}>
						<Text style={{ fontSize: 11, fontFamily: "NunitoSans_600SemiBold", color: C.mutedText }}>{a}</Text>
					</View>
				))}
			</View>
		</View>
	);
}

function MilkSummaryBar({ milk }) {
	const { C } = useTheme();
	if (!milk?.hasData) return null;

	const isBreastOnly = milk.milkType === "breast" && !milk.hasFormula;
	const target = milk.nhsTarget;

	// Always use a neutral colour — no red/amber alarms; we never tell parents to act
	let statusColor = "#2a5f8f";
	let statusBg    = "#dbeafe";
	if (isBreastOnly) {
		statusColor = "#7a2d6a"; statusBg = "#f5d4f0";
	}

	const typeLabel =
		milk.milkType === "formula" ? "Formula" :
		milk.milkType === "breast"  ? "Breast Milk" : "Mixed";

	const pct = !isBreastOnly && milk.avgDailyMlThis > 0 && target.maxMl > 0
		? Math.min(100, Math.round((milk.avgDailyMlThis / target.maxMl) * 100))
		: null;

	return (
		<View style={{ backgroundColor: statusBg, borderRadius: 14, padding: 14, gap: 10 }}>
			{/* Header row */}
			<View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
				<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
					<Icon name="bottle" size={14} color={statusColor} />
					<Text style={{ fontSize: 13, fontFamily: "NunitoSans_800ExtraBold", color: statusColor }}>Milk Intake</Text>
					<View style={{ backgroundColor: statusColor + "22", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
						<Text style={{ fontSize: 10, fontFamily: "NunitoSans_800ExtraBold", color: statusColor }}>{typeLabel}</Text>
					</View>
				</View>
				{!isBreastOnly && milk.avgDailyMlThis > 0 && (
					<Text style={{ fontSize: 15, fontFamily: "NunitoSans_700Bold", color: statusColor }}>{milk.avgDailyMlThis}ml/day</Text>
				)}
				{isBreastOnly && milk.avgDailyFeeds > 0 && (
					<Text style={{ fontSize: 15, fontFamily: "NunitoSans_700Bold", color: statusColor }}>{milk.avgDailyFeeds} feeds/day</Text>
				)}
			</View>

			{/* Progress bar (formula/mixed only) */}
			{pct !== null && (
				<View style={{ gap: 4 }}>
					<View style={{ height: 7, backgroundColor: statusColor + "25", borderRadius: 4, overflow: "hidden" }}>
						<View style={{ height: 7, width: `${pct}%`, backgroundColor: statusColor, borderRadius: 4 }} />
					</View>
					<View style={{ flexDirection: "row", justifyContent: "space-between" }}>
						<Text style={{ fontFamily: "NunitoSans_400Regular", fontSize: 10, color: C.mutedText }}>NHS reference: {target.minMl}–{target.maxMl}ml/day</Text>
						<Text style={{ fontSize: 10, fontFamily: "NunitoSans_700Bold", color: statusColor }}>{pct}% of range</Text>
					</View>
				</View>
			)}

			{/* Breast-only note */}
			{isBreastOnly && (
				<Text style={{ fontFamily: "NunitoSans_400Regular", fontSize: 11, color: statusColor, lineHeight: 17 }}>
					Breast milk volume can't be measured — feed frequency is tracked instead. The NHS reference range for this age is {target.minFeeds}–{target.maxFeeds} feeds/day. Always follow your baby's cues and speak to your health visitor about your baby's individual needs.
				</Text>
			)}

			{/* Trend + days */}
			<View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
				<Text style={{ fontFamily: "NunitoSans_400Regular", fontSize: 10, color: C.mutedText }}>{milk.daysLogged} day{milk.daysLogged !== 1 ? "s" : ""} logged (last 7 days)</Text>
				{milk.trend !== "stable" && (
					<View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
						<Icon name={milk.trend === "up" ? "trendUp" : "trendDown"} size={11} color={statusColor} />
						<Text style={{ fontSize: 11, fontFamily: "NunitoSans_700Bold", color: statusColor }}>
							{milk.trend === "up" ? "↑ vs last week" : "↓ vs last week"}
						</Text>
					</View>
				)}
			</View>
		</View>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function SmartInsightsSection({ child, foodLog, weightLog, bottleLog = [], user }) {
	const { C } = useTheme();

	// Age in months
	const dob = child?.dob ? new Date(child.dob) : null;
	const ageMonths = dob
		? Math.floor((Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
		: null;

	// ── Local computations (free, instant) ──────────────────────────────────
	const nutrition      = computeNutritionScore(foodLog);
	const trends         = computeTrends(foodLog);
	const { milestones, allergenProgress } = computeMilestones(foodLog, child);
	const milk           = computeMilkInsight(bottleLog, ageMonths || 6);

	// ── AI narrative state ───────────────────────────────────────────────────
	const [aiInsights,  setAiInsights]  = useState(null);
	const [aiLoading,   setAiLoading]   = useState(false);
	const [aiError,     setAiError]     = useState(null);
	const [lastRefresh, setLastRefresh] = useState(null);

	// ── Fetch AI insights ────────────────────────────────────────────────────
	const fetchInsights = useCallback(async (force = false) => {
		if (!user?.uid) return;
		setAiLoading(true);
		setAiError(null);
		try {
			const app       = getApp();
			const functions = getFunctions(app, "europe-west2");
			const fn        = httpsCallable(functions, "generateInsights");

			const payload = {
				...buildInsightPayload(child, foodLog, weightLog, bottleLog),
				childId: child.id,
				force,
			};

			const result = await fn(payload);
			setAiInsights(result.data.insights);
			setLastRefresh(new Date().toISOString());
		} catch (err) {
			console.warn("[SmartInsights] fetch error:", err?.message);
			setAiError("Couldn't load insights right now. Check your connection and try again.");
		} finally {
			setAiLoading(false);
		}
	}, [user?.uid, child?.id, foodLog.length, bottleLog.length]);

	useEffect(() => { fetchInsights(); }, [fetchInsights]);

	// ── Trend chip ───────────────────────────────────────────────────────────
	const trendUp    = trends.trend === "up";
	const trendSame  = trends.trend === "same";
	const trendColor = trendUp ? "#16a34a" : trendSame ? C.mutedText : "#c0392b";
	const trendBg    = trendUp ? "#f0fdf4" : trendSame ? C.bgPurple : "#fef2f2";
	const trendIcon  = trendUp ? "trendUp" : trendSame ? "minus" : "trendDown";
	const trendLabel = trends.thisWeekCount === 0
		? "No meals this week"
		: `${trends.thisWeekCount} meal${trends.thisWeekCount !== 1 ? "s" : ""} this week`;

	// ─────────────────────────────────────────────────────────────────────────
	return (
		<View style={{ gap: 16 }}>

			{/* ── Header ── */}
			<View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
				<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
					<Icon name="sparkle" size={16} color={C.primaryPurple} />
					<View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
						<Text style={{ fontFamily: "PlusJakartaSans_600SemiBold", fontSize: 17, color: C.primaryPinkDark }}>Smart Insights</Text>
						<View style={{ backgroundColor: C.primaryPurple, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 }}>
							<Text style={{ fontSize: 9, fontFamily: "NunitoSans_800ExtraBold", color: "#fff", textTransform: "uppercase", letterSpacing: 0.5 }}>AI</Text>
						</View>
					</View>
				</View>
				<TouchableOpacity
					onPress={() => fetchInsights(true)}
					disabled={aiLoading}
					style={{ backgroundColor: C.bgPurple, borderRadius: 10, padding: 8 }}>
					{aiLoading
						? <ActivityIndicator size="small" color={C.primaryPurple} />
						: <Icon name="refresh" size={15} color={C.primaryPurple} />}
				</TouchableOpacity>
			</View>
			<Text style={{ fontFamily: "NunitoSans_400Regular", fontSize: 11, color: C.mutedText }}>
				Personalised for {child.name}
				{lastRefresh ? ` · updated ${new Date(lastRefresh).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
			</Text>

			{/* ── Score row ── */}
			<View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
				<View style={{ alignItems: "center", gap: 6 }}>
					<ScoreRing score={nutrition.score} />
					<Text style={{ fontSize: 10, fontFamily: "NunitoSans_700Bold", color: C.mutedText, textAlign: "center" }}>
						Variety{"\n"}Score
					</Text>
				</View>
				<View style={{ flex: 1, gap: 8 }}>
					<View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: trendBg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}>
						<Icon name={trendIcon} size={14} color={trendColor} />
						<Text style={{ fontSize: 12, fontFamily: "NunitoSans_700Bold", color: trendColor, flex: 1 }}>{trendLabel}</Text>
					</View>
					<View style={{ flexDirection: "row", gap: 8 }}>
						<View style={{ flex: 1, backgroundColor: C.bgPurple, borderRadius: 10, padding: 10, alignItems: "center", borderWidth: 1, borderColor: C.borderLight }}>
							<Text style={{ fontSize: 18, fontFamily: "NunitoSans_800ExtraBold", color: C.primaryPurple }}>{nutrition.uniqueFoodsCount}</Text>
							<Text style={{ fontSize: 10, fontFamily: "NunitoSans_600SemiBold", color: C.mutedText, textAlign: "center" }}>foods (14d)</Text>
						</View>
						<View style={{ flex: 1, backgroundColor: "#fff7ed", borderRadius: 10, padding: 10, alignItems: "center", borderWidth: 1, borderColor: "#fed7aa" }}>
							<Text style={{ fontSize: 18, fontFamily: "NunitoSans_800ExtraBold", color: "#c2410c" }}>{allergenProgress.count}</Text>
							<Text style={{ fontSize: 10, fontFamily: "NunitoSans_600SemiBold", color: C.mutedText, textAlign: "center" }}>allergens</Text>
						</View>
					</View>
				</View>
			</View>

			{/* ── Categories found ── */}
			{nutrition.categoriesFound.length > 0 && (
				<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
					{nutrition.categoriesFound.map((cat) => (
						<View key={cat} style={{ backgroundColor: "#f0fdf4", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, flexDirection: "row", alignItems: "center", gap: 4 }}>
							<Icon name="check" size={10} color="#16a34a" />
							<Text style={{ fontSize: 11, fontFamily: "NunitoSans_700Bold", color: "#16a34a" }}>{cat}</Text>
						</View>
					))}
					{nutrition.missingCategories.map((cat) => (
						<View key={cat} style={{ backgroundColor: C.bgPurple, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
							<Text style={{ fontSize: 11, fontFamily: "NunitoSans_600SemiBold", color: C.mutedText }}>{cat}</Text>
						</View>
					))}
				</View>
			)}

			{/* ── Milk summary bar ── */}
			<MilkSummaryBar milk={milk} />

			{/* ── AI Insight cards ── */}
			{aiError ? (
				<View style={{ backgroundColor: "#fef2f2", borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
					<Icon name="info" size={16} color="#c0392b" />
					<Text style={{ fontSize: 12, color: "#c0392b", flex: 1, lineHeight: 18 }}>{aiError}</Text>
				</View>
			) : (
				<View style={{ gap: 8 }}>
					<InsightCard icon="leaf"      iconColor="#16a34a" iconBg="#dcfce7" label="Nutrition"        text={aiInsights?.nutrition}  loading={aiLoading && !aiInsights} />
					<InsightCard icon="starFill"  iconColor="#7c3aed" iconBg="#ede8f7" label="Progress"         text={aiInsights?.progress}   loading={aiLoading && !aiInsights} />
					<InsightCard icon="chevRight" iconColor="#c2410c" iconBg="#fff7ed" label="This Week"        text={aiInsights?.nextSteps}  loading={aiLoading && !aiInsights} />
					<InsightCard icon="baby"      iconColor="#7a2d6a" iconBg="#f5d4f0" label="Milk & Feeding"   text={aiInsights?.milk}       loading={aiLoading && !aiInsights} />
					<InsightCard icon="trendUp"   iconColor="#2a5f8f" iconBg="#dbeafe" label="Weight & Growth"  text={aiInsights?.weight}     loading={aiLoading && !aiInsights} />
				</View>
			)}

			{/* ── Divider ── */}
			<View style={{ height: 1, backgroundColor: C.borderLight }} />

			{/* ── Allergen progress ── */}
			<AllergenProgress allergenProgress={allergenProgress} />

			{/* ── Divider ── */}
			<View style={{ height: 1, backgroundColor: C.borderLight }} />

			{/* ── Milestone tracker ── */}
			<MilestoneRow milestones={milestones} />

			{/* ── Divider ── */}
			<View style={{ height: 1, backgroundColor: C.borderLight }} />

			{/* ── Medical Disclaimer ── */}
			<View style={{ backgroundColor: "#fffbeb", borderRadius: 14, padding: 16, gap: 10, borderWidth: 1.5, borderColor: "#f59e0b" }}>
				<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
					<Icon name="alert" size={18} color="#d97706" />
					<Text style={{ fontSize: 13, fontFamily: "NunitoSans_800ExtraBold", color: "#92400e", flex: 1 }}>Guidance Only — Not Medical Advice</Text>
				</View>
				<Text style={{ fontSize: 12, color: "#78350f", lineHeight: 19 }}>
					Smart Insights uses NHS and WHO published guidance as a general reference. It is{" "}
					<Text style={{ fontFamily: "NunitoSans_700Bold" }}>not a substitute for professional medical advice</Text>
					, diagnosis or treatment.{"\n\n"}
					Always consult your{" "}
					<Text style={{ fontFamily: "NunitoSans_700Bold" }}>health visitor, GP or paediatrician</Text>
					{" "}about your baby's growth, milk intake and development. Never delay or ignore professional medical advice because of anything shown here.
				</Text>
				<Text style={{ fontSize: 11, color: "#92400e", fontStyle: "italic", lineHeight: 16 }}>
					References: NHS Start4Life · WHO Child Growth Standards · SACN Infant Feeding guidance
				</Text>
			</View>

			{/* ── Powered by ── */}
			<Text style={{ fontFamily: "NunitoSans_400Regular", fontSize: 10, color: C.mutedText, textAlign: "center" }}>
				AI insights powered by OpenAI · based on NHS &amp; WHO guidelines
			</Text>
		</View>
	);
}
