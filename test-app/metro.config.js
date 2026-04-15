const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// The SDK is symlinked from ../packages/react-native
// Metro needs to know about the real location
const sdkPath = path.resolve(__dirname, '../packages/react-native');

// Watch the SDK source folder
config.watchFolders = [sdkPath];

// Make sure Metro can resolve modules from the SDK's node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(sdkPath, 'node_modules'),
];

module.exports = config;
