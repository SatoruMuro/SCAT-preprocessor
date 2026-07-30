const SENTENCE_END = /[^。！？!?]+[。！？!?]+[」』”’）)\]]*|[^。！？!?]+$/g;
const TRANSITION_START =
  /^(?:ただし|しかし|一方で?|ところが|それに対して|逆に|例えば|具体的には|そのため|したがって|なので|だから|また|さらに|それから|次に|結局|要するに|つまり|なお|あと)/;

export const DEMO_TRANSCRIPT = `A一　本日はお時間をいただき、ありがとうございます。最初に、普段どのような作品を作っているか教えてください。

サカイ　お願いします。普段は動物を題材にした作品を作っています。素材が持つ質感や、形の特徴が伝わるように意識しています。

A一　形の特徴というのは、どのようなところでしょうか。

サカイ　例えば動物の毛並みを描くだけでは、何の動物なのか分からないことがあります。そのため、耳や脚の形など、その動物らしさが現れる部分をよく観察しています。一方で、細部を描き込みすぎず、素材そのものの表情も残したいと考えています。`;

export function normalizeRawText(value) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[\u200b\u200c\u200d\ufeff]/g, "")
    .replace(/[ \t　]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function splitIntoParagraphs(rawText) {
  const normalized = normalizeRawText(rawText);
  if (!normalized) return [];

  const blocks = normalized
    .split(/\n\s*\n/)
    .map((block) => block.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);

  if (blocks.length > 1) return blocks;

  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length > 1 ? lines : blocks;
}

function plausibleSpeakerLabel(label) {
  const trimmed = label.trim();
  if (!trimmed || trimmed.length > 20) return false;
  if (/[。！？!?、，,「」『』（）()]/.test(trimmed)) return false;
  return !/^(?:ええと|あの|その|そして|それで|だから|ただ|しかし)$/.test(
    trimmed,
  );
}

export function detectSpeakerCandidates(rawText) {
  const counts = new Map();
  const order = [];

  for (const paragraph of splitIntoParagraphs(rawText)) {
    const match = paragraph.match(/^(.{1,20}?)[\t 　:：]{1,}(.+)$/);
    if (!match || !plausibleSpeakerLabel(match[1])) continue;
    const label = match[1].trim();
    if (!counts.has(label)) order.push(label);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return order
    .sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0))
    .slice(0, 12);
}

export function parseSpeakerList(value) {
  return [
    ...new Set(
      String(value ?? "")
        .split(/[\n,、，/／]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parseTurns(rawText, speakers = []) {
  const paragraphs = splitIntoParagraphs(rawText);
  const normalizedSpeakers = speakers
    .map((speaker) => speaker.trim())
    .filter(Boolean);
  const speakerPattern = normalizedSpeakers.length
    ? new RegExp(
        `^(${normalizedSpeakers
          .sort((a, b) => b.length - a.length)
          .map(escapeRegExp)
          .join("|")})[\\t 　:：]+(.+)$`,
      )
    : /^(.{1,20}?)[\t 　:：]+(.+)$/;

  const turns = [];
  let current = null;

  for (const paragraph of paragraphs) {
    const match = paragraph.match(speakerPattern);
    const isSpeaker =
      match &&
      (normalizedSpeakers.length > 0 || plausibleSpeakerLabel(match[1]));

    if (isSpeaker) {
      if (current?.text) turns.push(current);
      current = {
        speaker: match[1].trim(),
        text: match[2].trim(),
      };
      continue;
    }

    if (current) {
      current.text = `${current.text} ${paragraph}`.trim();
    } else {
      current = { speaker: "", text: paragraph };
    }
  }

  if (current?.text) turns.push(current);
  return turns;
}

export function splitSentences(text) {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  return (normalized.match(SENTENCE_END) ?? [normalized])
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function standardSegments(text) {
  const sentences = splitSentences(text);
  if (sentences.length <= 1) return sentences;

  const chunks = [];
  let current = "";

  const flush = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };

  for (const sentence of sentences) {
    const startsNewTopic =
      current.length >= 24 && TRANSITION_START.test(sentence.trim());
    const becomesTooLong = current && current.length + sentence.length > 150;
    const standaloneLongSentence = current && sentence.length >= 70;

    if (startsNewTopic || becomesTooLong || standaloneLongSentence) flush();
    current = current ? `${current}${sentence}` : sentence;
    if (current.length >= 95) flush();
  }

  flush();
  return chunks;
}

export function segmentTurns(turns, mode = "standard") {
  let sequence = 0;
  return turns.flatMap((turn, turnIndex) => {
    let segments;
    if (mode === "coarse") {
      segments = [turn.text.trim()];
    } else if (mode === "fine") {
      segments = splitSentences(turn.text);
    } else {
      segments = standardSegments(turn.text);
    }

    return segments.filter(Boolean).map((text) => ({
      id: `row-${Date.now()}-${turnIndex}-${sequence++}`,
      speaker: turn.speaker,
      text,
    }));
  });
}

export function nearestSplitPoint(text, requestedIndex) {
  if (requestedIndex > 0 && requestedIndex < text.length) return requestedIndex;
  const middle = Math.floor(text.length / 2);
  const candidates = [];
  for (let index = 1; index < text.length - 1; index += 1) {
    if (/[。！？!?、，,]/.test(text[index - 1])) candidates.push(index);
  }
  if (!candidates.length) return middle;
  return candidates.reduce((best, candidate) =>
    Math.abs(candidate - middle) < Math.abs(best - middle) ? candidate : best,
  );
}
