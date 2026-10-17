const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Expo enables experimental thread workers. Use Metro's process workers to
// avoid NodeThreadsWorker startup/retry crashes in local development builds.
// Keep Expo's resolver/transformer defaults and parallel bundling intact.
config.transformer.unstable_workerThreads = false;

module.exports = config;
