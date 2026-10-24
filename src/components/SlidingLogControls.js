import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, View } from "react-native";

/** Measure independently of the animated viewport so children never squash/reflow. */
export function SlidingLogControls({
  hidden,
  children,
  ...accessibilityProps
}) {
  const progress = useRef(new Animated.Value(hidden ? 0 : 1)).current;
  const [height, setHeight] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (alive) setReduceMotion(value);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: hidden ? 0 : 1,
      duration: reduceMotion ? 0 : 260,
      easing: Easing.inOut(Easing.cubic),
      // Height must update layout so the list gains the space as the controls move.
      useNativeDriver: false,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [hidden, progress, reduceMotion]);
  return (
    <Animated.View
      {...accessibilityProps}
      pointerEvents={hidden ? "none" : "auto"}
      style={{
        height: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, height],
        }),
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <Animated.View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [-height, 0],
              }),
            },
          ],
        }}
      >
        <View
          onLayout={({ nativeEvent }) =>
            setHeight(Math.ceil(nativeEvent.layout.height))
          }
        >
          {children}
        </View>
      </Animated.View>
    </Animated.View>
  );
}
