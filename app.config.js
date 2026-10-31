module.exports = ({ config }) => {
  if (process.env.EAS_BUILD_PROFILE !== "preview") return config;
  return {
    ...config,
    plugins: config.plugins.map((plugin) => {
      if (!Array.isArray(plugin) || plugin[0] !== "expo-build-properties")
        return plugin;
      return [
        plugin[0],
        {
          ...plugin[1],
          android: {
            ...plugin[1].android,
            // Internal APKs prioritize build turnaround; production keeps Expo's
            // release optimization defaults. This does not affect the AI prompts.
            enableMinifyInReleaseBuilds: false,
            enableShrinkResourcesInReleaseBuilds: false,
          },
        },
      ];
    }),
  };
};
