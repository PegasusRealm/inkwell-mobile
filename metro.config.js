const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const path = require('path');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */

// Explicitly set project root to mobile_2 directory
const projectRoot = __dirname;

const config = {
  projectRoot: projectRoot,
  watchFolders: [projectRoot],
  resolver: {
    // Only look for modules in mobile_2/node_modules
    nodeModulesPaths: [path.resolve(projectRoot, 'node_modules')],
  },
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);
