import assert from "node:assert/strict";
import test from "node:test";
import { strFromU8, unzipSync } from "fflate";
import { createScatWorkbookBytes } from "../offline/excel.mjs";

test("creates an SCAT workbook with transcript and analysis sections", () => {
  const output = createScatWorkbookBytes([
    { speaker: "I", text: "普段の活動について教えてください。" },
    { speaker: "R", text: "素材の質感を意識して制作しています。" },
  ]);
  const archive = unzipSync(output);
  const sheet = strFromU8(archive["xl/worksheets/sheet1.xml"]);
  const workbook = strFromU8(archive["xl/workbook.xml"]);

  assert.match(workbook, /sheet name="SCAT form1"/);
  assert.match(sheet, />番号</);
  assert.match(sheet, /&lt;5&gt;疑問・課題/);
  assert.match(sheet, />R</);
  assert.match(sheet, /素材の質感を意識して制作しています。/);
  assert.match(sheet, /ストーリー・ライン/);
  assert.match(sheet, /理論記述/);
  assert.match(sheet, /さらに追究すべき点・課題/);
  assert.ok(output.byteLength > 3000);
});
