const fs = require("node:fs");
if (
  process.env.EAS_BUILD_PLATFORM === "android" &&
  process.env.EAS_BUILD_PROFILE === "production"
) {
  const source = fs.readFileSync("lib/license-keys.ts", "utf8");
  if (/LICENSE_PUBLIC_KEYS[^=]*=\s*\[\s*\]/.test(source))
    throw Error(
      "Android production build refused: provision the owner public key in lib/license-keys.ts first.",
    );
}
