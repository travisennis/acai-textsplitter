import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SentenceSplitter } from "../source/sentenceSplitter.ts";

describe("SentenceSplitter", () => {
  const splitter = new SentenceSplitter({
    maxLength: 100,
    overlap: 20,
  });

  it("splits text into sentences", () => {
    const text =
      "This is sentence one. This is sentence two! How about three? And four.";
    const chunks = splitter.splitText(text);
    assert(chunks.length > 0);
    assert(chunks[0].includes("This is sentence one"));
  });

  it("handles abbreviations correctly", () => {
    const text = "Mr. Smith went to Dr. Jones. They discussed Ph.D. programs.";
    const chunks = splitter.splitText(text);
    assert.strictEqual(chunks.length, 1);
    assert.strictEqual(chunks[0], text);
  });

  it("handles empty input", () => {
    assert.deepStrictEqual(splitter.splitText(""), []);
    assert.deepStrictEqual(splitter.splitText("   "), []);
  });

  it("respects maxLength", () => {
    const longSentence =
      "This is a very long sentence that should definitely exceed the maximum length limit that we have set for our text chunks in this test case.";
    const chunks = splitter.splitText(longSentence);
    for (const chunk of chunks) {
      assert(
        chunk.length <= 100,
        "Chunk length must be less than or equal to 100",
      );
    }
  });

  it("applies overlap correctly", () => {
    const text =
      "First sentence here. Second sentence there. Third sentence everywhere.";
    const chunks = splitter.splitText(text);
    if (chunks.length > 1) {
      assert.ok(chunks[1].includes(chunks[0].slice(-20)));
    }
  });
});
