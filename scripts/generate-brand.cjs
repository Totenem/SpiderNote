// Rasterize the editable SVG masters into Expo's required PNG assets.
const sharp = require("sharp");
const path = require("node:path");
async function main() {
  for (const [name, source, size, background] of [
    ["icon.png", "mark.svg", 1024, "#17132D"],
    ["android-icon-foreground.png", "mark.svg", 1024],
    ["android-icon-monochrome.png", "monochrome.svg", 1024],
    ["splash-icon.png", "mark.svg", 512],
    ["favicon.png", "mark.svg", 64, "#17132D"],
  ]) {
    const image = sharp(path.join("assets", "brand", source)).resize(
      size,
      size,
    );
    if (background) image.flatten({ background });
    await image.png().toFile(path.join("assets", "images", name));
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
