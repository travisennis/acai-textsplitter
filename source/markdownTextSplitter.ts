import { RecursiveCharacterTextSplitter } from "./recursiveCharacterTextSplitter.ts";
import type { TextSplitterParams } from "./textSplitter.ts";

// --- MarkdownTextSplitter ---
export type MarkdownTextSplitterParams = TextSplitterParams;

export class MarkdownTextSplitter
  extends RecursiveCharacterTextSplitter
  implements MarkdownTextSplitterParams
{
  constructor(fields?: Partial<MarkdownTextSplitterParams>) {
    super({
      ...fields,
      separators:
        RecursiveCharacterTextSplitter.getSeparatorsForLanguage("markdown"),
    });
  }
}
