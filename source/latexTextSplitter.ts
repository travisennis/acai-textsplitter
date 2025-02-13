// --- LatexTextSplitter ---

import { RecursiveCharacterTextSplitter } from "./recursiveCharacterTextSplitter.ts";
import type { TextSplitterParams } from "./textSplitter.ts";

export type LatexTextSplitterParams = TextSplitterParams;

export class LatexTextSplitter
  extends RecursiveCharacterTextSplitter
  implements LatexTextSplitterParams
{
  constructor(fields?: Partial<LatexTextSplitterParams>) {
    super({
      ...fields,
      separators:
        RecursiveCharacterTextSplitter.getSeparatorsForLanguage("latex"),
    });
  }
}
