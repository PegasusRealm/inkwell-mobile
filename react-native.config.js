module.exports = {
  dependencies: {
    // @react-native-voice/voice uses iOS APIs deprecated in iOS 12 and removed in iOS 26.
    // Disable native iOS linking — JS layer handles null Voice gracefully.
    '@react-native-voice/voice': {
      platforms: {
        ios: null,
      },
    },
  },
  project: {
    ios: {},
    android: {},
  },
  assets: ['./assets/fonts'],
};
