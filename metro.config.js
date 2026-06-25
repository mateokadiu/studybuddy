const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// allow .pte (ExecuTorch) binary model files as assets
config.resolver.assetExts.push('pte', 'bin', 'gguf');

// `react-native-pdf-extract` was never published — alias to a local no-op stub
// so the bundle compiles. PDF extract on device is out of scope for this build.
const nodeEmpty = path.resolve(__dirname, 'src/lib/stubs/node-empty.js');
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  'react-native-pdf-extract': path.resolve(__dirname, 'src/lib/stubs/pdf-extract.js'),
};

// Node built-ins are only used in dev/tooling fallbacks (`if (isNode()) …`) but
// Metro can't tree-shake those guards, so route them to a single empty stub.
const NODE_BUILTINS = new Set([
  'fs',
  'path',
  'os',
  'util',
  'crypto',
  'child_process',
  'stream',
  'buffer',
  'events',
  'url',
  'querystring',
  'http',
  'https',
  'net',
  'tls',
  'tty',
  'zlib',
  'assert',
]);
const originalResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('node:') || NODE_BUILTINS.has(moduleName)) {
    return { filePath: nodeEmpty, type: 'sourceFile' };
  }
  if (originalResolve) return originalResolve(context, moduleName, platform);
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
