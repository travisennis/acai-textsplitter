import { TextSplitter, type TextSplitterParams } from "./textSplitter.ts";

export interface SentenceSplitterParams extends TextSplitterParams {
  minLength?: number;
  maxLength?: number;
  overlap?: number;
  /**
   * List of abbreviations to handle (e.g., "Mr.", "Dr.", "etc.")
   * These will be treated as non-sentence boundaries
   */
  abbreviations?: Set<string>;
}

// --- SentenceSplitter Implementation ---

export class SentenceSplitter
  extends TextSplitter
  implements SentenceSplitterParams
{
  readonly minLength: number;
  readonly maxLength: number;
  readonly abbreviations: Set<string>;
  readonly sentencePattern: RegExp;

  constructor(fields?: Partial<SentenceSplitterParams>) {
    super({
      chunkSize: fields?.maxLength ?? 1000,
      chunkOverlap: fields?.overlap ?? 0,
      keepSeparator: true,
      ...fields,
    });

    this.minLength = fields?.minLength ?? 0;
    this.maxLength = fields?.maxLength ?? 1000;
    this.abbreviations = new Set(
      fields?.abbreviations ?? [
        "Mr.",
        "Mrs.",
        "Ms.",
        "Dr.",
        "Prof.",
        "Sr.",
        "Jr.",
        "etc.",
        "vs.",
        "i.e.",
        "e.g.",
        "a.m.",
        "p.m.",
        "U.S.",
        "U.K.",
        "B.C.",
        "A.D.",
        "Ph.D.",
        "M.D.",
        "St.",
      ],
    );

    // Build regex pattern that excludes abbreviations
    const abbreviationPattern = Array.from(this.abbreviations)
      .map((abbr) => abbr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|");

    const basePattern = `(?<!\\b(?:${abbreviationPattern}))([.!?])\\s+(?=[A-Z])`;

    this.sentencePattern = new RegExp(basePattern, "g");
  }

  splitText(text: string): string[] {
    // Handle empty or whitespace-only text
    if (!text || text.trim().length === 0) {
      return [];
    }

    // Pre-process text to normalize spaces and protect abbreviations
    let processedText = text.replace(/\s+/g, ' ').trim();
    
    // Handle abbreviations before splitting
    for (const abbr of this.abbreviations) {
        const regex = new RegExp(`${abbr.replace(/\./g, '\\.')}\\s+`, 'g');
        processedText = processedText.replace(regex, `${abbr} `);
    }

    // Split into sentences
    const sentences = processedText
        .split(this.sentencePattern)
        .filter(s => s.trim().length > 0)
        .map(s => s.trim());

    // Merge sentences that are too short and split ones that are too long
    const normalizedSentences: string[] = [];
    let currentChunk = "";

    for (const sentence of sentences) {
      if (this.lengthFunction(sentence) > this.maxLength) {
        // Split long sentence into smaller chunks
        let remainingText = sentence;
        while (remainingText.length > 0) {
          const chunk = remainingText.slice(0, this.maxLength);
          const lastSpaceIndex = chunk.lastIndexOf(' ');
          const splitIndex = lastSpaceIndex > 0 ? lastSpaceIndex : this.maxLength;
          normalizedSentences.push(remainingText.slice(0, splitIndex));
          remainingText = remainingText.slice(splitIndex).trim();
        }
        currentChunk = '';
      } else if (currentChunk && this.lengthFunction(`${currentChunk} ${sentence}`) <= this.maxLength) {
        currentChunk += ` ${sentence}`;
      } else {
        if (currentChunk) {
          normalizedSentences.push(currentChunk.trim());
        }
        currentChunk = sentence;
      }
    }

    if (currentChunk) {
      normalizedSentences.push(currentChunk.trim());
    }

    // Apply overlap if specified
    if (this.chunkOverlap > 0) {
      return this.mergeSplits(normalizedSentences, " ");
    }

    return normalizedSentences;
  }
}
