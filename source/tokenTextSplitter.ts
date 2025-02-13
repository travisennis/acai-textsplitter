import { type TiktokenEncoding, type Tiktoken, getEncoding } from "js-tiktoken";
import { TextSplitter, type TextSplitterParams } from "./textSplitter.ts";

// --- TokenTextSplitter ---

export interface TokenTextSplitterParams extends TextSplitterParams {
  encodingName: TiktokenEncoding;
  allowedSpecial: "all" | string[];
  disallowedSpecial: "all" | string[];
}
export class TokenTextSplitter
  extends TextSplitter
  implements TokenTextSplitterParams
{
  encodingName: TiktokenEncoding;
  allowedSpecial: "all" | string[];
  disallowedSpecial: "all" | string[];
  private tokenizer: Tiktoken;

  constructor(fields?: Partial<TokenTextSplitterParams>) {
    super(fields);

    this.encodingName = fields?.encodingName ?? "gpt2";
    this.allowedSpecial = fields?.allowedSpecial ?? [];
    this.disallowedSpecial = fields?.disallowedSpecial ?? "all";
    this.tokenizer = getEncoding(this.encodingName);
  }

  splitText(text: string): string[] {
    const splits: string[] = [];
    const inputIds = this.tokenizer.encode(
      text,
      this.allowedSpecial,
      this.disallowedSpecial,
    );

    let startIdx = 0;
    while (startIdx < inputIds.length) {
      if (startIdx > 0) {
        startIdx -= this.chunkOverlap; // Correctly apply overlap
      }
      const endIdx = Math.min(startIdx + this.chunkSize, inputIds.length);
      const chunkIds = inputIds.slice(startIdx, endIdx);
      splits.push(this.tokenizer.decode(chunkIds));
      startIdx = endIdx;
    }

    return splits;
  }
}
