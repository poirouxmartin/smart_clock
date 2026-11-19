const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push('mjs');
config.resolver.unstable_enablePackageExports = true;

// Do not watch native build outputs (GBs of files,
// kills the Metro event loop on Windows).
config.resolver.blockList = [
  /android\/app\/build\/.*/,
  /android\/app\/.cxx\/.*/,
  /android\/build\/.*/,
];

module.exports = config;