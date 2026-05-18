/**
 * SmartInsightsSection
 *
 * Renders AI-powered growth & nutrition insights for the Child Detail screen.
 * - Scores (nutrition variety, weekly trend) are computed locally — free, instant.
 * - AI narrative text is fetched from the generateInsights Cloud Function and
 *   cached in Firestore for 24 hours, keeping costs near zero.
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
	buildInsightPayload,
	MILESTONES,
} from "../smartInsights";

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/** Circular score ring */
function ScoreRing({ score }) {
	const color =
		score >= 70 ? "#16a34a" :
		score >= 40 ? "#d4860a" : "#c0392b";
	const bg =
		score >= 70 ? "#f0fdf4" :
		score >= 40 ? "#fff7ed" : "#fef2f2";

	return (
		<View style={{ alignItems: "center", justifyContent: "center", width: 80, height: 80, borderRadius: 40, backgroundColor: bg, borderWidth: 4, borderColor: color + "40" }}>
			<Text style={{ fontSize: 22, fontWeight: "900", color }}>{score}</Text>
			<Text style={{ fontSize: 9, fontWeight: "700", color, letterSpacing: 0.3 }}>/ 100</Text>
		</View>
	);
}

/** Skeleton loading placeholder */
function SkeletonLine({ width = "100%", height = 14, style }) {
	const { C } = useTheme();
	return (
		<View style={[{ width, height, borderRadius: 7, backgroundColor: C.bgPurple }, style]} />
	);
}

/** Single AI insight card */
function InsightCard({ icon, iconColor, iconBg, label, text, loading }) {
	const { C } = useTheme();
	return (
		<View style={{ backgroundColor: C.screen, borderRadius: 14, padding: 14, gap: 8 }}>
			<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
				<View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: iconBg, alignItems: "center", justifyContent: "center" }}>
					<Icon name={icon} size={14} color={iconColor} />
				</View>
				<Text style={{ fontSize: 12, fontWeight: "800", color: iconColor }}>{label}</Text>
			</View>
			{loading ? (
				<View style={{ gap: 6 }}>
					<SkeletonLine width="95%" />
					<SkeletonLine width="70%" />
				</View>
			) : (
				<Text style={{ fontSize: 13, color: C.textCharcoal, lineHeight: 19 }}>{text}</Text>
			)}
		</View>
	);
}

/** Milestone step indicator */
function MilestoneRow({ milestones }) {
	const { C } = useTheme();
	const achievedCount = milestones.filter((m) => m.achieved).length;
	const nextIdx = milestones.findIndex((m) => !m.achieved);

	return (
		<View style={{ gap: 10 }}>
			{/* Progress bar */}
			<View style={{ gap: 6 }}>
				<View style={{ flexDirection: "row", justifyContent: "space-between" }}>
					<Text style={{ fontSize: 12, fontWeight: "700", color: C.textCharcoal }}>
						Weaning Journey
					</Text>
					<Text style={{ fontSize: 12, fontWeight: "700", color: C.primaryPurple }}>
						{achievedCount}/{milestones.length}
					</Text>
				</View>
				<View style={{ height: 6, backgroundColor: C.bgPurple, borderRadius: 3, overflow: "hidden" }}>
					<View style={{ height: 6, width: `${(achievedCount / milestones.length) * 100}%`, backgroundColor: C.primaryPurple, borderRadius: 3 }} />
				</View>
			</View>

			{/* Step dots */}
			<View style={{ flexDirection: "row", alignItems: "center", gap: 0 }}>
				{milestones.map((m, i) => {
					const isNext = i === nextIdx;
					return (
						<React.Fragment key={m.id}>
							{i > 0 && (
								<View style={{ flex: 1, height: 2, backgroundColor: m.achieved ? C.primaryPurple : C.bgPurple }} />
							)}
							<View style={{
								width: isNext ? 28 : 20,
								height: isNext ? 28 : 20,
								borderRadius: isNext ? 14 : 10,
								backgroundColor: m.achieved ? C.primaryPurple : isNext ? C.bgPurple : C.bgPurple,
								borderWidth: isNext ? 2 : 0,
								borderColor: isNext ? C.primaryPurple : "transparent",
								alignItems: "center",
								justifyContent: "center",
							}}>
								{m.achieved ? (
									<Icon name="check" size={isNext ? 14 : 10} color="#fff" />
								) : isNext ? (
									<View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.primaryPurple }} />
								) : null}
							</View>
						</React.Fragment>
					);
				})}
			</View>

			{/* Next milestone tip */}
			{nextIdx >= 0 && (
				<View style={{ backgroundColor: C.bgPurple, borderRadius: 12, padding: 12, flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
					<Icon name="info" size={14} color={C.primaryPurple} />
					<View style={{ flex: 1 }}>
						<Text style={{ fontSize: 12, fontWeight: "800", color: C.primaryPurpleDark, marginBottom: 2 }}>
							Next: {milestones[nextIdx].label}
						</Text>
						<Text style={{ fontSize: 12, color: C.mutedText, lineHeight: 17 }}>
							{milestones[nextIdx].tip}
						</Text>
					</View>
				</View>
			)}
		</View>
	);
}

/** Allergen progress chips */
function AllergenProgress({ allergenProgress }) {
	const { C } = useTheme();
	const { introduced, missing, count, total } = allergenProgress;

	return (
		<View style={{ gap: 8 }}>
			<View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
				<Text style={{ fontSize: 12, fontWeight: "700", color: C.textCharcoal }}>Allergens Introduced</Text>
				<Text style={{ fontSize: 12, fontWeight: "700", color: count >= total ? "#16a34a" : C.primaryPurple }}>
					{count}/{total}
				</Text>
			</View>
			<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
				{introduced.map((a) => (
					<View key={a} style={{ backgroundColor: "#f0fdf4", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, flexDirection: "row", alignItems: "center", gap: 4 }}>
						<Icon name="check" size={10} color="#16a34a" />
						<Text style={{ fontSize: 11, fontWeight: "700", color: "#16a34a" }}>{a}</Text>
					</View>
				))}
				{missing.map((a) => (
					<View key={a} style={{ backgroundColor: C.bgPurple, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 }}>
						<Text style={{ fontSize: 11, fontWeight: "600", color: C.mutedText }}>{a}</Text>
					</View>
				))}
			</View>
		</View>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function SmartInsightsSection({ child, foodLog, weightLog, user }) {
	const { C } = useTheme();

	// ── Local computations (free, instant) ───────────────────────────────────
	const nutrition      = computeNutritionScore(foodLog);
	const trends         = computeTrends(foodLog);
	const { milestones, allergenProgress } = computeMilestones(foodLog, child);

	// ── AI narrative state ────────────────────────────────────────────────────
	const [aiInsights, setAiInsights] = useState(null);   // { nutrition, progress, nextSteps }
	const [aiLoading,  setAiLoading]  = useState(false);
	const [aiError,    setAiError]    = useState(null);
	const [lastRefresh, setLastRefresh] = useState(null); // ISO string

	// ── Fetch AI insights ─────────────────────────────────────────────────────
	const fetchInsights = useCallback(async (force = false) => {
		if (!user?.uid) return;
		setAiLoading(true);
		setAiError(null);
		try {
			const app       = getApp();
			const functions = getFunctions(app, "europe-west2");
			const fn        = httpsCallable(functions, "generateInsights");

			const payload = {
				...buildInsightPayload(child, foodLog, weightLog),
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
	}, [user?.uid, child?.id, foodLog.length]);

	// Fetch on mount
	useEffect(() => {
		fetchInsights();
	}, [fetchInsights]);

	// ─────────────────────────────────────────────────────────────────────────
	// Trend chip
	// ─────────────────────────────────────────────────────────────────────────

	const trendUp   = trends.trend === "up";
	const trendSame = trends.trend === "same";
	const trendColor = trendUp ? "#16a34a" : trendSame ? C.mutedText : "#c0392b";
	const trendBg   = trendUp ? "#f0fdf4" : trendSame ? C.bgPurple : "#fef2f2";
	const trendIcon = trendUp ? "trendUp" : trendSame ? "minus" : "trendDown";
	const trendLabel = trends.thisWeekCount === 0
		? "No meals this week"
		: `${trends.thisWeekCount} meal${trends.thisWeekCount !== 1 ? "s" : ""} this week`;

	// ─────────────────────────────────────────────────────────────────────────
	// Render
	// ─────────────────────────────────────────────────────────────────────────

	return (
		<View style={{ gap: 16 }}>

			{/* ── Header ── */}
			<View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
				<View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
					<View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: "#ede8f7", alignItems: "center", justifyContent: "center" }}>
						<Icon name="sparkle" size={20} color="#7c3aed" />
					</View>
					<View>
						<View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
							<Text style={{ fontWeight: "800", fontSize: 16, color: C.primaryPinkDark }}>Smart Insights</Text>
							<View style={{ backgroundColor: "#7c3aed", borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 }}>
								<Text style={{ fontSize: 9, fontWeight: "800", color: "#fff", textTransform: "uppercase", letterSpacing: 0.5 }}>AI</Text>
							</View>
						</View>
						<Text style={{ fontSize: 11, color: C.mutedText, marginTop: 1 }}>
							Personalised for {child.name}
							{lastRefresh ? ` · updated ${new Date(lastRefresh).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
						</Text>
					</View>
				</View>

				{/* Refresh button */}
				<TouchableOpacity
					onPress={() => fetchInsights(true)}
					disabled={aiLoading}
					style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: C.bgPurple, alignItems: "center", justifyContent: "center" }}>
					{aiLoading ? (
						<ActivityIndicator size="small" color={C.primaryPurple} />
					) : (
						<Icon name="refresh" size={15} color={C.primaryPurple} />
					)}
				</TouchableOpacity>
			</View>

			{/* ── Score row ── */}
			<View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
				{/* Nutrition score ring */}
				<View style={{ alignItems: "center", gap: 6 }}>
					<ScoreRing score={nutrition.score} />
					<Text style={{ fontSize: 10, fontWeight: "700", color: C.mutedText, textAlign: "center" }}>
						Variety{"\n"}Score
					</Text>
				</View>

				{/* Stats */}
				<View style={{ flex: 1, gap: 8 }}>
					{/* Weekly trend chip */}
					<View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: trendBg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}>
						<Icon name={trendIcon} size={14} color={trendColor} />
						<Text style={{ fontSize: 12, fontWeight: "700", color: trendColor, flex: 1 }}>{trendLabel}</Text>
					</View>

					{/* Unique foods */}
					<View style={{ flexDirection: "row", gap: 8 }}>
						<View style={{ flex: 1, backgroundColor: C.bgPurple, borderRadius: 10, padding: 10, alignItems: "center" }}>
							<Text style={{ fontSize: 18, fontWeight: "900", color: C.primaryPurple }}>{nutrition.uniqueFoodsCount}</Text>
							<Text style={{ fontSize: 10, fontWeight: "600", color: C.mutedText, textAlign: "center" }}>foods (14d)</Text>
						</View>
						<View style={{ flex: 1, backgroundColor: "#fff7ed", borderRadius: 10, padding: 10, alignItems: "center" }}>
							<Text style={{ fontSize: 18, fontWeight: "900", color: "#c2410c" }}>{allergenProgress.count}</Text>
							<Text style={{ fontSize: 10, fontWeight: "600", color: C.mutedText, textAlign: "center" }}>allergens</Text>
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
							<Text style={{ fontSize: 11, fontWeight: "700", color: "#16a34a" }}>{cat}</Text>
						</View>
					))}
					{nutrition.missingCategories.map((cat) => (
						<View key={cat} style={{ backgroundColor: C.bgPurple, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
							<Text style={{ fontSize: 11, fontWeight: "600", color: C.mutedText }}>{cat}</Text>
						</View>
					))}
				</View>
			)}

			{/* ── AI Insight cards ── */}
			{aiError ? (
				<View style={{ backgroundColor: "#fef2f2", borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
					<Icon name="info" size={16} color="#c0392b" />
					<Text style={{ fontSize: 12, color: "#c0392b", flex: 1, lineHeight: 18 }}>{aiError}</Text>
				</View>
			) : (
				<View style={{ gap: 8 }}>
					<InsightCard
						icon="leaf"
						iconColor="#16a34a"
						iconBg="#dcfce7"
						label="Nutrition"
						text={aiInsights?.nutrition}
						loading={aiLoading && !aiInsights}
					/>
					<InsightCard
						icon="starFill"
						iconColor="#7c3aed"
						iconBg="#ede8f7"
						label="Progress"
						text={aiInsights?.progress}
						loading={aiLoading && !aiInsights}
					/>
					<InsightCard
						icon="chevRight"
						iconColor="#c2410c"
						iconBg="#fff7ed"
						label="This Week"
						text={aiInsights?.nextSteps}
						loading={aiLoading && !aiInsights}
					/>
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

			{/* ── Powered by ── */}
			<Text style={{ fontSize: 10, color: C.mutedText, textAlign: "center" }}>
				✨ AI insights powered by Google Gemini · based on NHS &amp; BLW guidelines
			</Text>
		</View>
	);
}
