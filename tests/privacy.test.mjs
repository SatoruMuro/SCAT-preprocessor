import fs from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

test("offline artifact blocks outbound connections and has no remote assets", async () => {
  const html = await fs.readFile(
    new URL("../dist/SCAT-preprocessor-offline.html", import.meta.url),
    "utf8",
  );

  assert.match(html, /connect-src 'none'/);
  assert.doesNotMatch(html, /<script\b[^>]*\bsrc=/i);
  assert.doesNotMatch(html, /<link\b[^>]*\bhref=["']https?:/i);
  assert.doesNotMatch(html, /<img\b[^>]*\bsrc=["']https?:/i);
  assert.doesNotMatch(
    html,
    /\b(?:fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|localStorage|indexedDB)\b/,
  );
});
