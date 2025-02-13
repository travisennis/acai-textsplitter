import { TextSplitter, type TextSplitterParams } from "./textSplitter.ts";

// --- CharacterTextSplitter ---
export interface CharacterTextSplitterParams extends TextSplitterParams {
  separator: string;
}

export class CharacterTextSplitter
  extends TextSplitter
  implements CharacterTextSplitterParams
{
  separator: string;

  constructor(fields?: Partial<CharacterTextSplitterParams>) {
    super(fields);
    this.separator = fields?.separator ?? "\n\n";
  }

  splitText(text: string): string[] {
    // First we naively split the large input into a bunch of smaller ones.
    const splits = this.splitOnSeparator(text, this.separator);
    return this.mergeSplits(splits, this.keepSeparator ? "" : this.separator);
  }
}
