// Build-time only. The application never downloads models.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { Readable } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const models = require("../assets/models/manifest.json");
const root = path.resolve(__dirname, "../assets/models");
async function verify(file, model) {
  if (!fs.existsSync(file) || fs.statSync(file).size !== model.bytes)
    return false;
  const hash = crypto.createHash("sha256");
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest("hex") === model.sha256;
}
async function main() {
  fs.mkdirSync(root, { recursive: true });
  for (const model of models) {
    const file = path.join(root, model.file);
    if (await verify(file, model)) {
      console.log(`Verified ${model.name}`);
      continue;
    }
    if (process.argv.includes("--check"))
      throw Error(
        `Missing or invalid bundled model: ${model.file}. Run npm run models:prepare.`,
      );
    console.log(`Preparing ${model.name} (${model.bytes} bytes)`);
    const response = await fetch(model.url);
    if (!response.ok || !response.body)
      throw Error(`Model fetch failed: ${response.status}`);
    const partial = file + ".part";
    try {
      await pipeline(
        Readable.fromWeb(response.body),
        fs.createWriteStream(partial),
      );
      if (!(await verify(partial, model)))
        throw Error(`Checksum mismatch: ${model.file}`);
      fs.renameSync(partial, file);
    } finally {
      if (fs.existsSync(partial)) fs.unlinkSync(partial);
    }
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
