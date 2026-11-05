const { withDangerousMod } = require("expo/config-plugins");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
module.exports = (config) =>
  withDangerousMod(config, [
    "android",
    async (config) => {
      const root = config.modRequest.projectRoot;
      const models = require(path.join(root, "assets/models/manifest.json"));
      const target = path.join(
        config.modRequest.platformProjectRoot,
        "app/src/main/assets/models",
      );
      fs.mkdirSync(target, { recursive: true });
      for (const model of models) {
        const source = path.join(root, "assets/models", model.file);
        if (!fs.existsSync(source) || fs.statSync(source).size !== model.bytes)
          throw Error(
            `Missing bundled model ${model.file}. Run npm run models:prepare before building.`,
          );
        const hash = crypto.createHash("sha256");
        for await (const chunk of fs.createReadStream(source))
          hash.update(chunk);
        if (hash.digest("hex") !== model.sha256)
          throw Error(`Invalid model checksum: ${model.file}`);
        fs.copyFileSync(source, path.join(target, model.file));
      }
      return config;
    },
  ]);
