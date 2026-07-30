import assert from "node:assert/strict";
import test from "node:test";
import {
  DEMO_TRANSCRIPT,
  detectSpeakerCandidates,
  parseSpeakerList,
  parseTurns,
  segmentTurns,
  splitSentences,
} from "../offline/logic.mjs";

test("detects speakers and parses turns from a Japanese transcript", () => {
  const speakers = detectSpeakerCandidates(DEMO_TRANSCRIPT);
  assert.deepEqual(speakers, ["A一", "サカイ"]);

  const turns = parseTurns(DEMO_TRANSCRIPT, speakers);
  assert.equal(turns.length, 4);
  assert.equal(turns[0].speaker, "A一");
  assert.match(turns[1].text, /素材が持つ質感/);
});

test("supports Japanese punctuation and three segmentation levels", () => {
  const turns = parseTurns(
    "I　質問です。もう少し教えてください。\n\nR　回答です。しかし、別の見方もあります。",
    ["I", "R"],
  );

  assert.equal(splitSentences(turns[0].text).length, 2);
  assert.equal(segmentTurns(turns, "coarse").length, 2);
  assert.equal(segmentTurns(turns, "fine").length, 4);
  assert.ok(segmentTurns(turns, "standard").length >= 2);
});

test("normalizes comma-separated speaker labels", () => {
  assert.deepEqual(parseSpeakerList("I、R, 参加者A\n参加者A"), [
    "I",
    "R",
    "参加者A",
  ]);
});
