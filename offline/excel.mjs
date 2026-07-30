import { strToU8, zipSync } from "fflate";

const HEADERS = [
  "番号",
  "発話者",
  "テクスト",
  "<1>テクスト中の注目すべき語句",
  "<2>テクスト中の語句の言いかえ",
  "<3>左を説明するようなテクスト外の概念",
  "<4>テーマ・構成概念\n（前後や全体の文脈を考慮して）",
  "<5>疑問・課題",
];

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function columnName(index) {
  let value = index;
  let name = "";
  while (value > 0) {
    value -= 1;
    name = String.fromCharCode(65 + (value % 26)) + name;
    value = Math.floor(value / 26);
  }
  return name;
}

function cell(reference, value, style) {
  if (value === null || value === undefined || value === "") {
    return `<c r="${reference}" s="${style}"/>`;
  }
  if (typeof value === "number") {
    return `<c r="${reference}" s="${style}"><v>${value}</v></c>`;
  }
  return `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
}

function rowXml(rowNumber, values, styles, height) {
  const cells = values
    .map((value, index) =>
      cell(`${columnName(index + 1)}${rowNumber}`, value, styles[index]),
    )
    .join("");
  return `<row r="${rowNumber}" ht="${height}" customHeight="1">${cells}</row>`;
}

function estimatedRowHeight(text) {
  const lines = Math.max(2, Math.ceil(String(text ?? "").length / 34));
  return Math.min(165, 22 + lines * 18);
}

function sheetXml(entries) {
  const rows = [];
  const merges = [];
  rows.push(rowXml(1, HEADERS, Array(8).fill(1), 61));

  entries.forEach((entry, index) => {
    const rowNumber = index + 2;
    rows.push(
      rowXml(
        rowNumber,
        [
          index + 1,
          entry.speaker || null,
          entry.text || null,
          null,
          null,
          null,
          null,
          null,
        ],
        [2, 2, 3, 3, 3, 3, 3, 3],
        estimatedRowHeight(entry.text),
      ),
    );
  });

  const summaryStart = entries.length + 3;
  const summaryItems = [
    ["ストーリー・ライン", 95],
    ["理論記述", 95],
    ["さらに追究すべき点・課題", 82],
  ];
  summaryItems.forEach(([label, height], index) => {
    const rowNumber = summaryStart + index;
    rows.push(
      rowXml(
        rowNumber,
        [label, null, null, null, null, null, null, null],
        [4, 4, 5, 5, 5, 5, 5, 5],
        height,
      ),
    );
    merges.push(`A${rowNumber}:B${rowNumber}`, `C${rowNumber}:H${rowNumber}`);
  });

  const footerStart = summaryStart + 4;
  const footerValues = [
    "SCAT(Steps for Coding and Theorization)を使った質的データ分析",
    "SCAT WEB site からのダウンロードフォーム scatform1.xls",
    "http://www.educa.nagoya-u.ac.jp/~otani/scat/scatform1.xls",
  ];
  footerValues.forEach((value, index) => {
    const rowNumber = footerStart + index;
    rows.push(
      rowXml(
        rowNumber,
        [value, null, null, null, null, null, null, null],
        Array(8).fill(6 + index),
        20,
      ),
    );
    merges.push(`A${rowNumber}:H${rowNumber}`);
  });

  const lastRow = footerStart + 2;
  const mergeXml = merges
    .map((reference) => `<mergeCell ref="${reference}"/>`)
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
  <dimension ref="A1:H${lastRow}"/>
  <sheetViews>
    <sheetView workbookViewId="0">
      <pane xSplit="3" ySplit="1" topLeftCell="D2" activePane="bottomRight" state="frozen"/>
      <selection pane="bottomRight"/>
    </sheetView>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="42" customHeight="1"/>
  <cols>
    <col min="1" max="1" width="5" customWidth="1"/>
    <col min="2" max="2" width="8" customWidth="1"/>
    <col min="3" max="3" width="53" customWidth="1"/>
    <col min="4" max="4" width="25" customWidth="1"/>
    <col min="5" max="5" width="24" customWidth="1"/>
    <col min="6" max="6" width="23" customWidth="1"/>
    <col min="7" max="7" width="25.5" customWidth="1"/>
    <col min="8" max="8" width="27" customWidth="1"/>
  </cols>
  <sheetData>${rows.join("")}</sheetData>
  <autoFilter ref="A1:H1"/>
  <mergeCells count="${merges.length}">${mergeXml}</mergeCells>
  <pageMargins left="0.25" right="0.25" top="0.4" bottom="0.4" header="0.2" footer="0.2"/>
  <pageSetup paperSize="8" orientation="landscape" fitToWidth="1" fitToHeight="0"/>
  <headerFooter><oddFooter>&amp;L SCAT前処理ツールで作成&amp;C &amp;P / &amp;N&amp;R &amp;D</oddFooter></headerFooter>
</worksheet>`;
}

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="6">
    <font><sz val="11"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="11"/><name val="ＭＳ 明朝"/></font>
    <font><sz val="10.5"/><name val="ＭＳ 明朝"/></font>
    <font><b/><sz val="10.5"/><name val="ＭＳ 明朝"/></font>
    <font><b/><sz val="10"/><name val="ＭＳ 明朝"/></font>
    <font><u/><color rgb="FF315EA8"/><sz val="9"/><name val="ＭＳ 明朝"/></font>
  </fonts>
  <fills count="2">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
  </fills>
  <borders count="3">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="medium"><color rgb="FF000000"/></left><right style="medium"><color rgb="FF000000"/></right><top style="medium"><color rgb="FF000000"/></top><bottom style="medium"><color rgb="FF000000"/></bottom><diagonal/></border>
    <border><left style="thin"><color rgb="FF000000"/></left><right style="thin"><color rgb="FF000000"/></right><top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="9">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="top" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="3" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="top" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="5" fillId="0" borderId="0" xfId="0" applyFont="1"/>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function workbookXml(lastRow) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <bookViews><workbookView activeTab="0"/></bookViews>
  <sheets><sheet name="SCAT form1" sheetId="1" r:id="rId1"/></sheets>
  <definedNames><definedName name="_xlnm.Print_Area" localSheetId="0">&apos;SCAT form1&apos;!$A$1:$H$${lastRow}</definedName></definedNames>
  <calcPr calcId="191029" fullCalcOnLoad="1"/>
</workbook>`;
}

export function createScatWorkbookBytes(entries) {
  const lastRow = entries.length + 9;
  const files = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`),
    "docProps/app.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>SCAT前処理ツール</Application></Properties>`),
    "docProps/core.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>SCAT前処理ツール</dc:creator><cp:lastModifiedBy>SCAT前処理ツール</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created></cp:coreProperties>`),
    "xl/workbook.xml": strToU8(workbookXml(lastRow)),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`),
    "xl/styles.xml": strToU8(STYLES_XML),
    "xl/worksheets/sheet1.xml": strToU8(sheetXml(entries)),
  };
  return zipSync(files, { level: 6 });
}

export function downloadScatWorkbook(entries, sourceName = "transcript") {
  const bytes = createScatWorkbookBytes(entries);
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const safeBase =
    String(sourceName)
      .replace(/\.[^.]+$/, "")
      .replace(/[\\/:*?"<>|]/g, "_")
      .trim() || "transcript";
  anchor.href = url;
  anchor.download = `${safeBase}_SCAT前処理.xlsx`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
