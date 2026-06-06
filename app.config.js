// Dynamic config so EAS can inject google-services.json via a secret file env var.
// On EAS builders: GOOGLE_SERVICES_JSON is set to the temp file path by EAS.
// Locally: falls back to ./google-services.json (gitignored, must be present for local builds).
module.exports = ({ config }) => ({
	...config,
	android: {
		...config.android,
		googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json",
	},
});
