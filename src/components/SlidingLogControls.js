import React, { useState } from "react";
import { Animated, View } from "react-native";

/** Measure independently of the animated viewport so children never squash/reflow. */
export function SlidingLogControls({
  hidden,
  progress,
  children,
  ...accessibilityProps
}) {
  const [height, setHeight] = useState(0);
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
