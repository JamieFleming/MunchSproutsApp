/**
 * withDisableActivitySaveState
 *
 * Sets android:saveEnabled="false" on the MainActivity.
 *
 * Why: on some Android devices, when expo-image-picker launches a new Activity the
 * OS tries to serialise the React Native Activity's saved-instance-state Bundle via
 * Binder IPC.  If the Bundle exceeds ~1 MB you get TransactionTooLargeException.
 * React Native always restores its own state from the JS bundle on resume, so
 * skipping Android's native state-save is safe and eliminates the crash entirely.
 */
const { withAndroidManifest } = require("@expo/config-plugins");

module.exports = function withDisableActivitySaveState(config) {
	return withAndroidManifest(config, (config) => {
		const activities =
			config.modResults.manifest.application?.[0]?.activity ?? [];

		for (const activity of activities) {
			const name = activity.$?.["android:name"] ?? "";
			if (name === ".MainActivity" || name.endsWith("MainActivity")) {
				activity.$["android:saveEnabled"] = "false";
				break;
			}
		}

		return config;
	});
};
