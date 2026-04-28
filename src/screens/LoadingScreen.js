import React from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useTheme } from "../ThemeContext";

export function LoadingScreen() {
	const { C } = useTheme();
	return (
		<View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.bgMain }}>
			<ActivityIndicator size="large" color={C.primaryPurple} />
			<Text style={{ color: C.primaryPurple, fontWeight: "700", marginTop: 12, letterSpacing: 0.5 }}>
				Loading…
			</Text>
		</View>
	);
}
