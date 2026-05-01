import React, { useRef, useState } from "react";
import {
	View,
	Image,
	Animated,
	PanResponder,
	ActivityIndicator,
	Dimensions,
} from "react-native";
import { TouchableOpacity } from "react-native";

const SCREEN_W = Dimensions.get("window").width;
const SCREEN_H = Dimensions.get("window").height;

/**
 * Pinch-to-zoom image with a loading spinner.
 * Double-tap resets zoom to 1×.
 */
export function ZoomableImage({ uri }) {
	const scale = useRef(new Animated.Value(1)).current;
	const opacity = useRef(new Animated.Value(0)).current;
	const scaleRef = useRef(1);
	const lastDistance = useRef(null);
	const lastTap = useRef(0);
	const [loading, setLoading] = useState(true);

	const panResponder = useRef(
		PanResponder.create({
			onStartShouldSetPanResponder: (evt) =>
				evt.nativeEvent.touches.length === 2,
			onMoveShouldSetPanResponder: (evt) =>
				evt.nativeEvent.touches.length === 2,
			onPanResponderGrant: () => {
				lastDistance.current = null;
			},
			onPanResponderMove: (evt) => {
				const touches = evt.nativeEvent.touches;
				if (touches.length !== 2) return;
				const dx = touches[0].pageX - touches[1].pageX;
				const dy = touches[0].pageY - touches[1].pageY;
				const distance = Math.sqrt(dx * dx + dy * dy);
				if (lastDistance.current !== null) {
					const delta = distance / lastDistance.current;
					scaleRef.current = Math.max(1, Math.min(5, scaleRef.current * delta));
					scale.setValue(scaleRef.current);
				}
				lastDistance.current = distance;
			},
			onPanResponderRelease: () => {
				lastDistance.current = null;
				if (scaleRef.current < 1) {
					scaleRef.current = 1;
					Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
				}
			},
			onPanResponderTerminate: () => {
				lastDistance.current = null;
			},
		}),
	).current;

	const handleDoubleTap = () => {
		const now = Date.now();
		if (now - lastTap.current < 300) {
			scaleRef.current = 1;
			Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
		}
		lastTap.current = now;
	};

	return (
		<TouchableOpacity
			activeOpacity={1}
			onPress={handleDoubleTap}
			style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
			{loading && (
				<ActivityIndicator
					color="#ffffff"
					size="large"
					style={{ position: "absolute" }}
				/>
			)}
			<Animated.View
				style={{
					width: SCREEN_W,
					height: SCREEN_H * 0.75,
					transform: [{ scale }],
					opacity,
				}}
				{...panResponder.panHandlers}>
				<Image
					source={{ uri }}
					style={{ width: "100%", height: "100%" }}
					resizeMode="contain"
					fadeDuration={0}
					onLoad={() => {
						setLoading(false);
						Animated.timing(opacity, {
							toValue: 1,
							duration: 200,
							useNativeDriver: true,
						}).start();
					}}
				/>
			</Animated.View>
		</TouchableOpacity>
	);
}
