import {
  DEMO_TRANSCRIPT,
  detectSpeakerCandidates,
  nearestSplitPoint,
  normalizeRawText,
  parseSpeakerList,
  parseTurns,
  segmentTurns,
} from "./logic.mjs";
import { extractDocxText } from "./docx.mjs";
import { downloadScatWorkbook } from "./excel.mjs";

const state = {
  rawText: "",
  sourceName: "",
  entries: [],
};

const byId = (id) => document.getElementById(id);
const fileInput = byId("file-input");
const dropzone = byId("dropzone");
const speakerInput = byId("speaker-input");
const modeSelect = byId("mode-select");
const processButton = byId("process-button");
const exportButton = byId("export-button");
const clearButton = byId("clear-button");
const addRowButton = byId("add-row-button");
const demoButton = byId("demo-button");
const fileStatus = byId("file-status");
const extractedText = byId("extracted-text");
const rowsBody = byId("rows-body");
const emptyState = byId("empty-state");
const rowCount = byId("row-count");
const toast = byId("toast");

function showToast(message, kind = "success") {
  toast.textContent = message;
  toast.dataset.kind = kind;
  toast.hidden = false;
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => {
    toast.hidden = true;
  }, 3600);
}

function setFileStatus(message, kind = "neutral") {
  fileStatus.textContent = message;
  fileStatus.dataset.kind = kind;
}

function setRawTranscript(text, sourceName) {
  state.rawText = normalizeRawText(text);
  state.sourceName = sourceName;
  extractedText.value = state.rawText;
  const candidates = detectSpeakerCandidates(state.rawText);
  speakerInput.value = candidates.join("、");
  setFileStatus(
    `${sourceName} を読み込みました（${state.rawText.length.toLocaleString("ja-JP")}文字）`,
    "success",
  );
  processButton.disabled = !state.rawText;
  byId("settings-card").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function readTranscriptFile(file) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension !== "docx" && extension !== "txt") {
    throw new Error("読み込める形式は .docx または .txt です。");
  }

  if (extension === "docx") {
    const arrayBuffer = await file.arrayBuffer();
    return extractDocxText(arrayBuffer);
  }
  return file.text();
}

async function handleFile(file) {
  if (!file) return;
  setFileStatus("文書をこの端末内で読み込んでいます…", "neutral");
  try {
    const text = await readTranscriptFile(file);
    if (!normalizeRawText(text)) {
      throw new Error("文書内にテキストが見つかりませんでした。");
    }
    setRawTranscript(text, file.name);
  } catch (error) {
    setFileStatus(
      error instanceof Error ? error.message : "読み込みに失敗しました。",
      "error",
    );
  } finally {
    fileInput.value = "";
  }
}

function createButton(label, className, onClick, title = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  if (title) button.title = title;
  button.addEventListener("click", onClick);
  return button;
}

function renderRows() {
  rowsBody.replaceChildren();
  emptyState.hidden = state.entries.length > 0;
  rowCount.textContent = `${state.entries.length}行`;
  exportButton.disabled = state.entries.length === 0;
  clearButton.disabled = !state.rawText && state.entries.length === 0;

  state.entries.forEach((entry, index) => {
    const row = document.createElement("tr");
    row.dataset.id = entry.id;

    const numberCell = document.createElement("td");
    numberCell.className = "number-cell";
    numberCell.textContent = String(index + 1);

    const speakerCell = document.createElement("td");
    const speaker = document.createElement("input");
    speaker.className = "speaker-field";
    speaker.value = entry.speaker;
    speaker.setAttribute("aria-label", `${index + 1}行目の発話者`);
    speaker.addEventListener("input", () => {
      entry.speaker = speaker.value;
    });
    speakerCell.append(speaker);

    const textCell = document.createElement("td");
    const textarea = document.createElement("textarea");
    textarea.className = "text-field";
    textarea.value = entry.text;
    textarea.rows = Math.min(
      8,
      Math.max(2, Math.ceil(entry.text.length / 48)),
    );
    textarea.setAttribute("aria-label", `${index + 1}行目のテクスト`);
    textarea.addEventListener("input", () => {
      entry.text = textarea.value;
      textarea.rows = Math.min(
        8,
        Math.max(2, Math.ceil(entry.text.length / 48)),
      );
    });
    textCell.append(textarea);

    const actionCell = document.createElement("td");
    actionCell.className = "actions-cell";
    const actionButtons = document.createElement("div");
    actionButtons.className = "actions-wrap";
    actionButtons.append(
      createButton(
        "分割",
        "row-action primary",
        () => {
          const point = nearestSplitPoint(entry.text, textarea.selectionStart);
          const before = entry.text.slice(0, point).trim();
          const after = entry.text.slice(point).trim();
          if (!before || !after) {
            showToast(
              "分割したい位置にカーソルを置いてください。",
              "error",
            );
            return;
          }
          state.entries.splice(
            index,
            1,
            { ...entry, text: before },
            {
              id: `${entry.id}-split-${Date.now()}`,
              speaker: entry.speaker,
              text: after,
            },
          );
          renderRows();
        },
        "カーソル位置で2行に分けます",
      ),
      createButton(
        "前と結合",
        "row-action",
        () => {
          if (index === 0) return;
          const previous = state.entries[index - 1];
          previous.text = `${previous.text}${entry.text}`.trim();
          state.entries.splice(index, 1);
          renderRows();
        },
        "直前の行のテクスト末尾に結合します",
      ),
      createButton(
        "削除",
        "row-action danger",
        () => {
          state.entries.splice(index, 1);
          renderRows();
        },
      ),
    );
    actionCell.append(actionButtons);

    row.append(numberCell, speakerCell, textCell, actionCell);
    rowsBody.append(row);
  });
}

function processTranscript() {
  const latestText = normalizeRawText(extractedText.value);
  if (!latestText) {
    showToast(
      "先にWordまたはテキストファイルを読み込んでください。",
      "error",
    );
    return;
  }
  state.rawText = latestText;
  const speakers = parseSpeakerList(speakerInput.value);
  const turns = parseTurns(latestText, speakers);
  state.entries = segmentTurns(turns, modeSelect.value);
  renderRows();
  showToast(
    `${turns.length}発言を${state.entries.length}個の意味のまとまりに分割しました。`,
  );
  byId("review-card").scrollIntoView({ behavior: "smooth", block: "start" });
}

fileInput.addEventListener("change", () => {
  void handleFile(fileInput.files?.[0]);
});
for (const eventName of ["dragenter", "dragover"]) {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.dataset.dragging = "true";
  });
}
for (const eventName of ["dragleave", "drop"]) {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    delete dropzone.dataset.dragging;
  });
}
dropzone.addEventListener("drop", (event) => {
  void handleFile(event.dataTransfer?.files?.[0]);
});

processButton.addEventListener("click", processTranscript);
demoButton.addEventListener("click", () => {
  setRawTranscript(DEMO_TRANSCRIPT, "ダミー逐語録.docx");
  showToast("研究データを含まないダミー逐語録を読み込みました。");
});
addRowButton.addEventListener("click", () => {
  state.entries.push({
    id: `manual-${Date.now()}`,
    speaker: "",
    text: "",
  });
  renderRows();
});
clearButton.addEventListener("click", () => {
  if (
    !window.confirm(
      "読み込んだテキストと編集中の行を、この画面のメモリから消去しますか？",
    )
  ) {
    return;
  }
  state.rawText = "";
  state.sourceName = "";
  state.entries = [];
  extractedText.value = "";
  speakerInput.value = "";
  setFileStatus("まだ文書は読み込まれていません。");
  processButton.disabled = true;
  renderRows();
  showToast("画面上のデータを消去しました。");
});
exportButton.addEventListener("click", async () => {
  exportButton.disabled = true;
  const originalLabel = exportButton.textContent;
  exportButton.textContent = "Excelを作成中…";
  try {
    await downloadScatWorkbook(state.entries, state.sourceName);
    showToast("SCAT形式のExcelを端末に保存しました。");
  } catch (error) {
    showToast(
      error instanceof Error ? error.message : "Excelの作成に失敗しました。",
      "error",
    );
  } finally {
    exportButton.textContent = originalLabel;
    exportButton.disabled = state.entries.length === 0;
  }
});

renderRows();
