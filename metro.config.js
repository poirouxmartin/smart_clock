const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push('mjs');
config.resolver.unstable_enablePackageExports = true;

// Ne pas suivre les sorties de build natif (Go de fichiers,
// tue la boucle d'événements Metro sur Windows).
config.resolver.blockList = [
  /android\/app\/build\/.*/,
  /android\/app\/.cxx\/.*/,
  /android\/build\/.*/,
];

module.exports = config;