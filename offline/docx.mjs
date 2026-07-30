import { strFromU8, unzipSync } from "fflate";

const MAX_DOCX_BYTES = 50 * 1024 * 1024;
const MAX_DOCUMENT_XML_BYTES = 25 * 1024 * 1024;

function decodeXml(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#([0-9]+);/g, (_, decimal) =>
      String.fromCodePoint(Number.parseInt(decimal, 10)),
    )
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function paragraphText(xml) {
  return decodeXml(
    xml
      .replace(/<(?:\w+:)?tab\b[^>]*\/>/gi, "\t")
      .replace(/<(?:\w+:)?(?:br|cr)\b[^>]*\/>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

export function extractDocxText(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  if (bytes.byteLength > MAX_DOCX_BYTES) {
    throw new Error("Wordファイルが大きすぎます（上限50 MB）。");
  }

  let archive;
  try {
    archive = unzipSync(bytes, {
      filter(file) {
        return (
          file.name === "word/document.xml" &&
          file.originalSize <= MAX_DOCUMENT_XML_BYTES
        );
      },
    });
  } catch {
    throw new Error("Wordファイルを読み取れませんでした。");
  }

  const documentXml = archive["word/document.xml"];
  if (!documentXml) {
    throw new Error("Word本文が見つからないか、文書が大きすぎます。");
  }

  const xml = strFromU8(documentXml);
  const paragraphs = [
    ...xml.matchAll(
      /<(?:\w+:)?p\b[^>]*>([\s\S]*?)<\/(?:\w+:)?p>/gi,
    ),
  ]
    .map((match) => paragraphText(match[1]))
    .filter(Boolean);

  if (!paragraphs.length) {
    throw new Error("Word文書内にテキストが見つかりませんでした。");
  }
  return paragraphs.join("\n\n");
}
