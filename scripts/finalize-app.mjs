import { copyFile, readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
await copyFile("dist-app/app.html", "dist-app/index.html");
const assets = (await readdir("dist-app/assets"))
  .filter((x) => /\.(js|css)$/.test(x))
  .map((x) => `/assets/${x}`);
const ocr = (await readdir("dist-app/ocr"))
  .filter((x) => !x.includes("LICENSE"))
  .map((x) => `/ocr/${x}`);
const precache = [
  "/app.html",
  "/index.html",
  "/manifest.webmanifest",
  "/brand/logo-crop.png",
  "/brand/logo-dark.png",
  "/brand/icon-192.png",
  ...assets,
  ...ocr,
];
let sw = await readFile("dist-app/sw.js", "utf8");
const hash = createHash("sha256")
  .update(assets.join())
  .digest("hex")
  .slice(0, 10);
sw = sw.replace(
  "const CACHE='bookmarks-shell-v1';",
  `const CACHE='bookmarks-shell-${hash}';`,
);
sw = sw.replace(
  "await c.addAll(['/app.html','/brand/logo.png','/brand/logo-crop.png','/brand/logo-dark.png','/brand/icon-192.png','/manifest.webmanifest']);",
  `await c.addAll(${JSON.stringify(precache)});`,
);
await writeFile("dist-app/sw.js", sw);
