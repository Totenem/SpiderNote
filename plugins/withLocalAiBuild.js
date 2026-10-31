const { withGradleProperties } = require("expo/config-plugins");

// llama.rn builds a JNI wrapper for every CPU variant by default. Keep the
// portable fallback plus the CPU variants useful on our arm64 phone target.
module.exports = function withLocalAiBuild(config) {
  return withGradleProperties(config, (config) => {
    config.modResults = config.modResults.filter(
      (item) => item.key !== "rnllamaVariants",
    );
    config.modResults.push({
      type: "property",
      key: "rnllamaVariants",
      value: "rnllama,rnllama_v8_2,rnllama_v8_2_dotprod",
    });
    return config;
  });
};
