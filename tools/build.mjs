// Builds dist/ from src/: compiled CSS, minified script, same-site copies of React/ZXing/fonts, offline service worker.
// Run `npm install` once, then `npm run build`. dist/ is committed and published by .github/workflows/pages.yml.
import { transform } from "esbuild";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const P = (...a) => path.join(root, ...a);
const dist = P("dist");
const hash = (buf) => createHash("sha256").update(buf).digest("hex").slice(0, 10);
const read = (f) => fs.readFileSync(f, "utf8");

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(P("dist/vendor"), { recursive: true });
fs.mkdirSync(P("dist/fonts"), { recursive: true });

// Libraries (exact versions from package.json) served from this site.
const vendor = {
  "react-18.2.0.production.min.js": "node_modules/react/umd/react.production.min.js",
  "react-dom-18.2.0.production.min.js": "node_modules/react-dom/umd/react-dom.production.min.js",
  "htm-3.1.1.umd.js": "node_modules/htm/dist/htm.umd.js",
  "zxing-0.21.3.min.js": "node_modules/@zxing/library/umd/index.min.js",
};
for (const [name, src] of Object.entries(vendor)) fs.copyFileSync(P(src), P("dist/vendor", name));

// Fonts (Latin subset only).
const fonts = [
  "node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2",
  "node_modules/@fontsource-variable/public-sans/files/public-sans-latin-wght-normal.woff2",
  "node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2",
  "node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-600-normal.woff2",
];
for (const f of fonts) fs.copyFileSync(P(f), P("dist/fonts", path.basename(f)));

// CSS: Tailwind only emits the classes the app uses.
const tmpCss = P("dist/.tmp.css");
execFileSync(process.execPath, [P("node_modules/tailwindcss/lib/cli.js"), "-c", P("tailwind.config.js"), "-i", P("src/styles.css"), "-o", tmpCss, "--minify"], { cwd: root, stdio: "pipe" });
const css = fs.readFileSync(tmpCss);
fs.rmSync(tmpCss);
const cssName = `app.${hash(css)}.css`;
fs.writeFileSync(P("dist", cssName), css);

// Barcode worker.
const workerSrc = read(P("src/scan-worker.js")).replace("__ZXING_URL__", "vendor/zxing-0.21.3.min.js");
const worker = (await transform(workerSrc, { minify: true, target: "es2019" })).code;
const workerName = `scan-worker.${hash(worker)}.js`;
fs.writeFileSync(P("dist", workerName), worker);

// App script.
const appSrc = read(P("src/app.js")).replaceAll("__WORKER_URL__", workerName).replaceAll("__ZXING_URL__", "vendor/zxing-0.21.3.min.js");
const app = (await transform(appSrc, { minify: true, target: "es2019" })).code;
const jsName = `app.${hash(app)}.js`;
fs.writeFileSync(P("dist", jsName), app);

// HTML.
const scripts = [...Object.keys(vendor).filter((n) => !n.startsWith("zxing")).map((n) => `vendor/${n}`), jsName]
  .map((s) => `<script defer src="${s}"></script>`).join("\n");
fs.writeFileSync(P("dist/index.html"), read(P("src/index.html")).replace("{{CSS}}", cssName).replace("{{SCRIPTS}}", scripts));

// Static files.
for (const f of ["manifest.webmanifest", "icon.svg", "icon-180.png", "icon-192.png", "icon-512.png"]) fs.copyFileSync(P("static", f), P("dist", f));
fs.writeFileSync(P("dist/.nojekyll"), "");

// Service worker: precaches everything above; its cache name changes with every build.
const files = fs.readdirSync(dist, { recursive: true, withFileTypes: true }).filter((d) => d.isFile() && d.name !== ".nojekyll")
  .map((d) => path.relative(dist, path.join(d.parentPath, d.name)).split(path.sep).join("/"));
const build = hash(files.sort().map((f) => f + hash(fs.readFileSync(P("dist", f)))).join());
const sw = read(P("src/sw.js")).replace("__BUILD__", build).replace("__PRECACHE__", JSON.stringify(["./", ...files]));
fs.writeFileSync(P("dist/sw.js"), sw);

const size = (f) => (fs.statSync(P("dist", f)).size / 1024).toFixed(1) + " KB";
console.log(`built ${build}`);
for (const f of [cssName, jsName, workerName, "index.html", "sw.js"]) console.log("  ", f.padEnd(28), size(f));
