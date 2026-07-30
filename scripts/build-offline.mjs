import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptsDirectory, "..");
const offlineDirectory = path.join(projectDirectory, "offline");
const outputDirectory = path.join(projectDirectory, "dist");

const [template, styles] = await Promise.all([
  fs.readFile(path.join(offlineDirectory, "template.html"), "utf8"),
  fs.readFile(path.join(offlineDirectory, "styles.css"), "utf8"),
]);

const bundle = await build({
  entryPoints: [path.join(offlineDirectory, "app.mjs")],
  bundle: true,
  write: false,
  minify: true,
  format: "iife",
  platform: "browser",
  target: ["chrome109", "edge109", "firefox115", "safari16"],
  define: {
    global: "globalThis",
    "process.env.NODE_ENV": '"production"',
  },
});

const script = bundle.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const html = template
  .replace("__STYLES__", () => styles)
  .replace("__SCRIPT__", () => script);

await fs.mkdir(outputDirectory, { recursive: true });
await Promise.all([
  fs.writeFile(
    path.join(outputDirectory, "SCAT-preprocessor-offline.html"),
    html,
    "utf8",
  ),
  fs.writeFile(path.join(outputDirectory, "index.html"), html, "utf8"),
]);

console.log(
  `Built offline app (${Math.round(Buffer.byteLength(html) / 1024).toLocaleString("en-US")} KB)`,
);
