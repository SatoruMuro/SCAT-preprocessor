import assert from "node:assert/strict";
import test from "node:test";
import { strToU8, zipSync } from "fflate";
import { extractDocxText } from "../offline/docx.mjs";

test("extracts paragraphs, tabs, and Japanese text from DOCX", () => {
  const documentXml = `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>A一</w:t><w:tab/><w:t>質問です。</w:t></w:r></w:p>
    <w:p><w:r><w:t>サカイ　回答です。</w:t></w:r></w:p>
  </w:body>
</w:document>`;
  const archive = zipSync({
    "word/document.xml": strToU8(documentXml),
  });

  assert.equal(
    extractDocxText(archive.buffer),
    "A一\t質問です。\n\nサカイ　回答です。",
  );
});
