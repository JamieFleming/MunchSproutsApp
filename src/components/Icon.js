import React from "react";
import Svg, {
	Path,
	Line,
	Polyline,
	Circle,
	Rect,
	Polygon,
	Ellipse,
	G,
} from "react-native-svg";
import { useTheme } from "../ThemeContext";
import { CATEGORIES, REACTIONS } from "../constants";
import { reactionCfg } from "../helpers";

export function Icon({ name, size = 18, color }) {
	const { C } = useTheme();
	if (color === undefined) color = C.mutedText;
	const p = {
		stroke: color,
		strokeWidth: 2,
		strokeLinecap: "round",
		strokeLinejoin: "round",
		fill: "none",
	};
	const icons = {
		home: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Path {...p} d="M3 12L12 3l9 9" />
				<Path {...p} d="M9 21V12h6v9" />
				<Path {...p} d="M3 12v9h6" />
				<Path {...p} d="M15 21v-9h6V21" />
			</Svg>
		),
		list: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Line {...p} x1="8" y1="6" x2="21" y2="6" />
				<Line {...p} x1="8" y1="12" x2="21" y2="12" />
				<Line {...p} x1="8" y1="18" x2="21" y2="18" />
				<Circle {...p} cx="3" cy="6" r="1" fill={color} />
				<Circle {...p} cx="3" cy="12" r="1" fill={color} />
				<Circle {...p} cx="3" cy="18" r="1" fill={color} />
			</Svg>
		),
		plus: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Line {...p} x1="12" y1="5" x2="12" y2="19" />
				<Line {...p} x1="5" y1="12" x2="19" y2="12" />
			</Svg>
		),
		chef: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Path
					{...p}
					d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z"
				/>
				<Line {...p} x1="6" y1="17" x2="18" y2="17" />
			</Svg>
		),
		more: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Line {...p} x1="3" y1="6" x2="21" y2="6" />
				<Line {...p} x1="3" y1="12" x2="21" y2="12" />
				<Line {...p} x1="3" y1="18" x2="21" y2="18" />
			</Svg>
		),
		settings: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Circle {...p} cx="12" cy="12" r="3" />
				<Path
					{...p}
					d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
				/>
			</Svg>
		),
		logout: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Path {...p} d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
				<Polyline {...p} points="16 17 21 12 16 7" />
				<Line {...p} x1="21" y1="12" x2="9" y2="12" />
			</Svg>
		),
		star: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Polygon
					{...p}
					points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
				/>
			</Svg>
		),
		starFill: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Polygon
					stroke={color}
					strokeWidth={0}
					fill={color}
					points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
				/>
			</Svg>
		),
		image: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Rect {...p} x="3" y="3" width="18" height="18" rx="2" ry="2" />
				<Circle {...p} cx="8.5" cy="8.5" r="1.5" />
				<Polyline {...p} points="21 15 16 10 5 21" />
			</Svg>
		),
		Camera: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Path
					{...p}
					d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
				/>
				<Circle {...p} cx="12" cy="13" r="4" />
			</Svg>
		),
		edit: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Path
					{...p}
					d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
				/>
				<Path
					{...p}
					d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
				/>
			</Svg>
		),
		trash: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Polyline {...p} points="3 6 5 6 21 6" />
				<Path {...p} d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
				<Path {...p} d="M10 11v6M14 11v6" />
				<Path {...p} d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
			</Svg>
		),
		close: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Line {...p} x1="18" y1="6" x2="6" y2="18" />
				<Line {...p} x1="6" y1="6" x2="18" y2="18" />
			</Svg>
		),
		chevDown: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Polyline {...p} points="6 9 12 15 18 9" />
			</Svg>
		),
		chevUp: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Polyline {...p} points="18 15 12 9 6 15" />
			</Svg>
		),
		chevRight: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Polyline {...p} points="9 18 15 12 9 6" />
			</Svg>
		),
		check: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Polyline {...p} points="20 6 9 17 4 12" />
			</Svg>
		),
		alert: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Path
					{...p}
					d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
				/>
				<Line {...p} x1="12" y1="9" x2="12" y2="13" />
				<Line {...p} x1="12" y1="17" x2="12.01" y2="17" />
			</Svg>
		),
		lock: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Rect {...p} x="3" y="11" width="18" height="11" rx="2" />
				<Path {...p} d="M7 11V7a5 5 0 0 1 10 0v4" />
			</Svg>
		),
		unlock: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Rect {...p} x="3" y="11" width="18" height="11" rx="2" />
				<Path {...p} d="M7 11V7a5 5 0 0 1 9.9-1" />
			</Svg>
		),
		search: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Circle {...p} cx="11" cy="11" r="8" />
				<Line {...p} x1="21" y1="21" x2="16.65" y2="16.65" />
			</Svg>
		),
		clock: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Circle {...p} cx="12" cy="12" r="10" />
				<Polyline {...p} points="12 6 12 12 16 14" />
			</Svg>
		),
		chart: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Line {...p} x1="18" y1="20" x2="18" y2="10" />
				<Line {...p} x1="12" y1="20" x2="12" y2="4" />
				<Line {...p} x1="6" y1="20" x2="6" y2="14" />
			</Svg>
		),
		grid: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Rect {...p} x="3" y="3" width="7" height="7" />
				<Rect {...p} x="14" y="3" width="7" height="7" />
				<Rect {...p} x="14" y="14" width="7" height="7" />
				<Rect {...p} x="3" y="14" width="7" height="7" />
			</Svg>
		),
		water: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Path
					{...p}
					fill={color}
					d="M12 2C6 9 4 13 4 16a8 8 0 0 0 16 0c0-3-2-7-8-14z"
				/>
			</Svg>
		),
		baby: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Circle {...p} cx="12" cy="8" r="4" />
				<Path {...p} d="M8 14c-3 1.5-5 3.5-5 5h18c0-1.5-2-3.5-5-5" />
			</Svg>
		),
		info: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Circle {...p} cx="12" cy="12" r="10" />
				<Line {...p} x1="12" y1="16" x2="12" y2="12" />
				<Line {...p} x1="12" y1="8" x2="12.01" y2="8" />
			</Svg>
		),
		utensils: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Path {...p} d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
				<Path {...p} d="M7 2v20" />
				<Path {...p} d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />
			</Svg>
		),
		key: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Path
					{...p}
					d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"
				/>
			</Svg>
		),
		crown: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Path {...p} d="M2 20h20M5 20l-2-9 5 4 4-8 4 8 5-4-2 9" />
			</Svg>
		),
		user: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Path {...p} d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
				<Circle {...p} cx="12" cy="7" r="4" />
			</Svg>
		),
		users: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Path {...p} d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
				<Circle {...p} cx="9" cy="7" r="4" />
				<Path {...p} d="M23 21v-2a4 4 0 0 0-3-3.87" />
				<Path {...p} d="M16 3.13a4 4 0 0 1 0 7.75" />
			</Svg>
		),
		calendar: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Rect {...p} x="3" y="4" width="18" height="18" rx="2" />
				<Line {...p} x1="16" y1="2" x2="16" y2="6" />
				<Line {...p} x1="8" y1="2" x2="8" y2="6" />
				<Line {...p} x1="3" y1="10" x2="21" y2="10" />
			</Svg>
		),
		download: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Path {...p} d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
				<Polyline {...p} points="7 10 12 15 17 10" />
				<Line {...p} x1="12" y1="15" x2="12" y2="3" />
			</Svg>
		),
		heart: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Path
					{...p}
					d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
				/>
			</Svg>
		),
		pdf: (
			<Svg width={size} height={size} viewBox="0 0 24 24">
				<Path
					{...p}
					d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
				/>
				<Polyline {...p} points="14 2 14 8 20 8" />
				<Line {...p} x1="16" y1="13" x2="8" y2="13" />
				<Line {...p} x1="16" y1="17" x2="8" y2="17" />
				<Polyline {...p} points="10 9 9 9 8 9" />
			</Svg>
		),
	};
	return icons[name] || null;
}

export function CategoryIcon({ category, size = 32 }) {
	const cfg = CATEGORIES.find((c) => c.value === category) || CATEGORIES[7];
	const s2 = size * 0.55;
	const icons = {
		Vegetables: (
			<Svg width={s2} height={s2} viewBox="0 0 24 24">
				<Path stroke={cfg.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" d="M2 22c1-5 4-9 8-10 1 3 3 5 5 6-2 1-4 3-5 6" />
				<Path stroke={cfg.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" d="M22 2s-8 2-10 10C8 16 6 19 2 22c3-1 7-3 10-8 2 1 4 1 6-1-1-3-1-7 4-11z" />
			</Svg>
		),
		Fruits: (
			<Svg width={s2} height={s2} viewBox="0 0 24 24">
				<Path stroke={cfg.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" d="M12 20.94c1.5 0 2.75-.67 4-2 1.5-1.67 2-3.5 2-5.44C18 9 15.87 7 13.5 7c-.87 0-1.5.2-2 .5-.5-.3-1.13-.5-2-.5C7.13 7 5 9 5 13.5c0 1.94.5 3.77 2 5.44 1.25 1.33 2.5 2 4 2z" />
				<Path stroke={cfg.color} strokeWidth={2} strokeLinecap="round" fill="none" d="M12 7V3" />
			</Svg>
		),
		Grains: (
			<Svg width={s2} height={s2} viewBox="0 0 24 24">
				<Path stroke={cfg.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" d="M2 22 16 8" />
				<Path stroke={cfg.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" d="M3.47 12.53 5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94z" />
				<Path stroke={cfg.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" d="M7.47 8.53 9 7l1.53 1.53a3.5 3.5 0 0 1 0 4.94L9 15l-1.53-1.53a3.5 3.5 0 0 1 0-4.94z" />
			</Svg>
		),
		Proteins: (
			<Svg width={s2} height={s2} viewBox="0 0 24 24">
				<Path stroke={cfg.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
				<Path stroke={cfg.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" d="M7 2v20" />
				<Path stroke={cfg.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />
			</Svg>
		),
		Dairy: (
			<Svg width={s2} height={s2} viewBox="0 0 24 24">
				<Path stroke={cfg.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" d="M8 2h8" />
				<Path stroke={cfg.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" d="M9 2v2.789a4 4 0 0 1-.672 2.219l-.656.984A4 4 0 0 0 7 10.212V20a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-9.789a4 4 0 0 0-.672-2.219l-.656-.984A4 4 0 0 1 15 4.788V2" />
			</Svg>
		),
		Legumes: (
			<Svg width={s2} height={s2} viewBox="0 0 24 24">
				<Path stroke={cfg.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" d="M10.5 22C6.5 22 2 17.52 2 13c0-3 1.9-5.5 5-6.5 1.3-.4 3.1.1 4.3 1.3C13.4 9.9 16 11 18 11c2 0 4-1 4-3-2 0-4-1-4-3 0-1.1.9-2 2-2" />
				<Path stroke={cfg.color} strokeWidth={2} strokeLinecap="round" fill="none" d="M10.5 22c4 0 8-4 8-9" />
			</Svg>
		),
		Liquids: (
			<Svg width={s2} height={s2} viewBox="0 0 24 24">
				<Path stroke={cfg.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill={cfg.color} fillOpacity={0.3} d="M12 2C6 9 4 13 4 16a8 8 0 0 0 16 0c0-3-2-7-8-14z" />
			</Svg>
		),
		Other: (
			<Svg width={s2} height={s2} viewBox="0 0 24 24">
				<Circle cx={s2 / 2} cy={s2 / 2} r={s2 * 0.4} fill={cfg.bg} stroke={cfg.color} strokeWidth={2} />
				<Line x1={s2 * 0.35} y1={s2 / 2} x2={s2 * 0.65} y2={s2 / 2} stroke={cfg.color} strokeWidth={2} strokeLinecap="round" />
				<Line x1={s2 / 2} y1={s2 * 0.35} x2={s2 / 2} y2={s2 * 0.65} stroke={cfg.color} strokeWidth={2} strokeLinecap="round" />
			</Svg>
		),
	};
	return (
		<Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
			<Circle cx={size / 2} cy={size / 2} r={size / 2} fill={cfg.bg} />
			<G x={(size - s2) / 2} y={(size - s2) / 2}>
				{icons[category] || icons.Other}
			</G>
		</Svg>
	);
}

export function ReactionFace({ reaction, size = 40 }) {
	const cfg = reactionCfg(reaction);
	const c = cfg.color;
	const bg = cfg.bg;
	const faces = {
		Loved: (
			<Svg width={size} height={size} viewBox="0 0 40 40">
				<Circle cx="20" cy="20" r="18" fill={bg} stroke={c} strokeWidth="1.5" />
				<Circle cx="14" cy="17" r="2.5" fill={c} />
				<Circle cx="26" cy="17" r="2.5" fill={c} />
				<Path d="M12 25 Q20 33 28 25" stroke={c} strokeWidth="2.2" strokeLinecap="round" fill="none" />
				<Path d="M15 14 Q14 11 11 12" stroke={c} strokeWidth="1.5" strokeLinecap="round" fill="none" />
				<Path d="M25 14 Q26 11 29 12" stroke={c} strokeWidth="1.5" strokeLinecap="round" fill="none" />
			</Svg>
		),
		Good: (
			<Svg width={size} height={size} viewBox="0 0 40 40">
				<Circle cx="20" cy="20" r="18" fill={bg} stroke={c} strokeWidth="1.5" />
				<Circle cx="14" cy="17" r="2.5" fill={c} />
				<Circle cx="26" cy="17" r="2.5" fill={c} />
				<Path d="M13 25 Q20 31 27 25" stroke={c} strokeWidth="2.2" strokeLinecap="round" fill="none" />
			</Svg>
		),
		Neutral: (
			<Svg width={size} height={size} viewBox="0 0 40 40">
				<Circle cx="20" cy="20" r="18" fill={bg} stroke={c} strokeWidth="1.5" />
				<Circle cx="14" cy="17" r="2.5" fill={c} />
				<Circle cx="26" cy="17" r="2.5" fill={c} />
				<Line x1="13" y1="26" x2="27" y2="26" stroke={c} strokeWidth="2.2" strokeLinecap="round" />
			</Svg>
		),
		Rejected: (
			<Svg width={size} height={size} viewBox="0 0 40 40">
				<Circle cx="20" cy="20" r="18" fill={bg} stroke={c} strokeWidth="1.5" />
				<Circle cx="14" cy="17" r="2.5" fill={c} />
				<Circle cx="26" cy="17" r="2.5" fill={c} />
				<Path d="M13 28 Q20 22 27 28" stroke={c} strokeWidth="2.2" strokeLinecap="round" fill="none" />
				<Path d="M15 14 Q14 11 11 13" stroke={c} strokeWidth="1.5" strokeLinecap="round" fill="none" />
				<Path d="M25 14 Q26 11 29 13" stroke={c} strokeWidth="1.5" strokeLinecap="round" fill="none" />
			</Svg>
		),
		Allergic: (
			<Svg width={size} height={size} viewBox="0 0 40 40">
				<Circle cx="20" cy="20" r="18" fill="#fde8e8" stroke="#c0392b" strokeWidth="1.5" />
				<Path d="M13 12 L27 28 M27 12 L13 28" stroke="#c0392b" strokeWidth="2.5" strokeLinecap="round" />
			</Svg>
		),
	};
	return faces[reaction] || faces.Neutral;
}
