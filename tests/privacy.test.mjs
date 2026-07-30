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

test("offline artifact contains one complete document and a working bundle", async () => {
  const html = await fs.readFile(
    new URL("../dist/SCAT-preprocessor-offline.html", import.meta.url),
    "utf8",
  );

  assert.equal((html.match(/<!doctype html>/gi) ?? []).length, 1);
  assert.doesNotMatch(html, /__(?:SCRIPT|STYLES)__/);
  assert.match(html, /id="file-input"/);
  assert.match(html, /for="file-input"/);
});
