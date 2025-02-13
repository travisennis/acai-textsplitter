import { TextSplitter, type TextSplitterParams } from "./textSplitter.ts";

export interface ParagraphSplitterParams extends TextSplitterParams {
  minLength?: number;
  maxLength?: number;
  overlap?: number;
  /**
   * Pattern to use for paragraph splitting
   * Defaults to two or more newlines: "\\n{2,}"
   */
  paragraphPattern?: RegExp;
}

// --- ParagraphSplitter Implementation ---

export class ParagraphSplitter
  extends TextSplitter
  implements ParagraphSplitterParams
{
  readonly minLength: number;
  readonly maxLength: number;
  readonly paragraphPattern: RegExp;

  constructor(fields?: Partial<ParagraphSplitterParams>) {
    super({
      chunkSize: fields?.maxLength ?? 1000,
      chunkOverlap: fields?.overlap ?? 0,
      keepSeparator: true,
      ...fields,
    });

    this.minLength = fields?.minLength ?? 0;
    this.maxLength = fields?.maxLength ?? 1000;
    this.paragraphPattern = fields?.paragraphPattern ?? /\n\s*\n/
  }

  splitText(text: string): string[] {
    // Handle empty or whitespace-only text
    if (!text || text.trim().length === 0) {
      return [];
    }

    // Split text into paragraphs
    const paragraphs = text
      .split(this.paragraphPattern)
      .filter((p) => p.trim().length > 0)
      .map((p) => p.trim());

    // Merge short paragraphs and split long ones
    const normalizedParagraphs: string[] = [];
    let currentChunk = "";

    for (const paragraph of paragraphs) {
      const potentialChunk = currentChunk
        ? `${currentChunk}\n\n${paragraph}`
        : paragraph;

      if (this.lengthFunction(paragraph) > this.maxLength) {
        // Split long paragraph into smaller chunks
        let remainingText = paragraph;
        while (remainingText.length > 0) {
          const chunk = remainingText.slice(0, this.maxLength);
          const lastSpaceIndex = chunk.lastIndexOf(' ');
          const splitIndex = lastSpaceIndex > 0 ? lastSpaceIndex : this.maxLength;
          normalizedParagraphs.push(remainingText.slice(0, splitIndex));
          remainingText = remainingText.slice(splitIndex).trim();
        }
        currentChunk = '';
      } else if (currentChunk && this.lengthFunction(potentialChunk) <= this.maxLength) {
        currentChunk = potentialChunk;
      } else {
        if (currentChunk) {
          normalizedParagraphs.push(currentChunk);
        }
        currentChunk = paragraph;
      }
    }

    if (currentChunk) {
      normalizedParagraphs.push(currentChunk);
    }

    // Apply overlap if specified
    if (this.chunkOverlap > 0) {
      return this.mergeSplits(normalizedParagraphs, "\n\n");
    }

    return normalizedParagraphs;
  }
}
