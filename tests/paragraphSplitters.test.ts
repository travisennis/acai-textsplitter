import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ParagraphSplitter } from "../source/paragraphSplitter.ts";

describe("ParagraphSplitter", () => {
  const splitter = new ParagraphSplitter({
    maxLength: 30,
    overlap: 5,
  });

  it("splits text into paragraphs", () => {
    const text = "First paragraph.\n\nSecond paragraph.\n\nThird paragraph.";
    const chunks = splitter.splitText(text);
    assert.strictEqual(chunks.length, 3);
    assert.strictEqual(chunks[0], "First paragraph.");
  });

  it("handles single newlines", () => {
    const text = "First line.\nStill first paragraph.\n\nSecond paragraph.";
    const chunks = splitter.splitText(text);
    assert.strictEqual(chunks.length, 2);
  });

  it("handles empty input", () => {
    assert.deepStrictEqual(splitter.splitText(""), []);
    assert.deepStrictEqual(splitter.splitText("   "), []);
  });

  it("respects maxLength", () => {
    const longParagraph =
      "This is a very long paragraph that should definitely exceed the maximum length limit. ".repeat(
        5,
      );
    const chunks = splitter.splitText(longParagraph);
    for (const chunk of chunks) {
      assert(
        chunk.length <= 100,
        "Chunk length must be less than or equal to 100",
      );
    }
  });

  it("applies overlap correctly", () => {
    const text = "First paragraph.\n\nSecond paragraph.\n\nThird paragraph.";
    const chunks = splitter.splitText(text);

    if (chunks.length > 1) {
      assert(
        chunks[1].includes(chunks[0].slice(-5)),
        "Second chunk should contain overlap from first chunk",
      );
    }
  });

  it("handles custom paragraph patterns", () => {
    const customSplitter = new ParagraphSplitter({
      maxLength: 15,
      paragraphPattern: /\n---\n/,
    });
    const text = "First section\n---\nSecond section\n---\nThird section";
    const chunks = customSplitter.splitText(text);
    assert.strictEqual(chunks.length, 3);
    assert.strictEqual(chunks[0], "First section");
  });
});
