const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// allow .pte (ExecuTorch) binary model files as assets
config.resolver.assetExts.push('pte', 'bin', 'gguf');

module.exports = config;
