const { test } = require("node:test");
const assert = require("node:assert/strict");
const harness = require("./support/appHarness.cjs");
test("swipe stays open without deleting; tapping Delete requires confirmation", () => {
  let handlers,
    prompts = [],
    deleted = 0,
    starred = 0,
    repeated = 0,
    target;
  const h = harness("ios", {
    "react-native": {
      View: "View",
      Text: "Text",
      TouchableOpacity: "TouchableOpacity",
      StyleSheet: { create: (x) => x },
      Animated: {
        Value: class {
          setValue() {}
          stopAnimation() {}
        },
        View: "Animated.View",
        spring: (_, options) => {
          target = options.toValue;
          return { start() {} };
        },
      },
      PanResponder: {
        create: (value) => {
          handlers = value;
          return { panHandlers: {} };
        },
      },
      Alert: { alert: (...args) => prompts.push(args) },
    },
  });
  const { SwipeToDelete } = h.load("src/components/SwipeToDelete.js");
  const tree = SwipeToDelete({
    label: "milk entry",
    onDelete: () => deleted++,
    onFavourite: () => starred++,
    onRepeat: () => repeated++,
    children: null,
  });
  assert.equal(
    handlers.onMoveShouldSetPanResponder(null, { dx: -20, dy: 40 }),
    false,
  );
  assert.equal(
    handlers.onMoveShouldSetPanResponder(null, { dx: 50, dy: 0 }),
    false,
  );
  assert.equal(
    handlers.onMoveShouldSetPanResponder(null, { dx: -40, dy: 3 }),
    true,
  );
  handlers.onPanResponderRelease(null, { dx: -20 });
  assert.equal(prompts.length, 0);
  handlers.onPanResponderRelease(null, { dx: -90 });
  assert.equal(deleted, 0);
  assert.equal(prompts.length, 0);
  assert.equal(target, -228);
  const actions = tree.props.children[0].props.children;
  actions
    .find((action) => action && action.props.accessibilityLabel === "Favourite")
    .props.onPress();
  actions
    .find((action) => action && action.props.accessibilityLabel === "Repeat")
    .props.onPress();
  assert.equal(starred, 1);
  assert.equal(repeated, 1);
  assert.equal(deleted, 0);
  actions
    .find((action) => action && action.props.accessibilityLabel === "Delete")
    .props.onPress();
  assert.equal(prompts.length, 1);
  const buttons = prompts[0][2];
  assert.equal(buttons[0].style, "cancel");
  assert.equal(buttons[0].onPress, undefined);
  buttons[1].onPress();
  assert.equal(deleted, 1);
  handlers.onPanResponderTerminate();
  assert.equal(prompts.length, 1);
});
