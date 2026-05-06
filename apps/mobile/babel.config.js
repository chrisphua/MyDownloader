// Standard Expo Babel config. expo-router needs no extra plugins as of SDK 50+;
// reanimated would go here if we used it for animations.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
  };
};
