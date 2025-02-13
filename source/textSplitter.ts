import { Document } from "./document.ts";

// --- Interfaces and Types ---

export interface TextSplitterParams {
  chunkSize: number;
  chunkOverlap: number;
  keepSeparator: boolean;
  lengthFunction?: (text: string) => number; // No async here
}

export type TextSplitterChunkHeaderOptions = {
  chunkHeader?: string;
  chunkOverlapHeader?: string;
  appendChunkOverlapHeader?: boolean;
};

// --- Abstract TextSplitter Class ---

export abstract class TextSplitter implements TextSplitterParams {
  chunkSize: number;
  chunkOverlap: number;
  keepSeparator: boolean;
  lengthFunction: (text: string) => number;

  constructor(fields?: Partial<TextSplitterParams>) {
    this.chunkSize = fields?.chunkSize ?? 1000;
    this.chunkOverlap = fields?.chunkOverlap ?? 200;
    this.keepSeparator = fields?.keepSeparator ?? false;
    this.lengthFunction =
      fields?.lengthFunction ?? ((text: string) => text.length);

    if (this.chunkOverlap >= this.chunkSize) {
      throw new Error("Cannot have chunkOverlap >= chunkSize");
    }
  }

  abstract splitText(text: string): string[]; // No async

  protected splitOnSeparator(text: string, separator: string): string[] {
    let splits: string[];
    if (separator) {
      if (this.keepSeparator) {
        const regexEscapedSeparator = separator.replace(
          /[/\-\\^$*+?.()|[\]{}]/g,
          "\\$&",
        );
        splits = text.split(new RegExp(`(?=${regexEscapedSeparator})`));
      } else {
        splits = text.split(separator);
      }
    } else {
      splits = text.split("");
    }
    return splits.filter((s) => s !== "");
  }

  createDocuments(
    texts: string[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadatas: Record<string, any>[] = [],
    chunkHeaderOptions: TextSplitterChunkHeaderOptions = {},
  ): Document[] {
    // if no metadata is provided, we create an empty one for each text
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const _metadatas: Record<string, any>[] =
      metadatas.length > 0
        ? metadatas
        : [...new Array(texts.length)].map(() => ({}));
    const {
      chunkHeader = "",
      chunkOverlapHeader = "(cont'd) ",
      appendChunkOverlapHeader = false,
    } = chunkHeaderOptions;
    const documents = new Array<Document>();
    for (let i = 0; i < texts.length; i += 1) {
      const text = texts[i];
      let lineCounterIndex = 1;
      let prevChunk: string | null = null;
      let indexPrevChunk = -1;
      for (const chunk of this.splitText(text)) {
        let pageContent = chunkHeader;

        // we need to count the \n that are in the text before getting removed by the splitting
        const indexChunk = text.indexOf(chunk, indexPrevChunk + 1);
        if (prevChunk === null) {
          const newLinesBeforeFirstChunk = this.numberOfNewLines(
            text,
            0,
            indexChunk,
          );
          lineCounterIndex += newLinesBeforeFirstChunk;
        } else {
          const indexEndPrevChunk =
            indexPrevChunk + this.lengthFunction(prevChunk);
          if (indexEndPrevChunk < indexChunk) {
            const numberOfIntermediateNewLines = this.numberOfNewLines(
              text,
              indexEndPrevChunk,
              indexChunk,
            );
            lineCounterIndex += numberOfIntermediateNewLines;
          } else if (indexEndPrevChunk > indexChunk) {
            const numberOfIntermediateNewLines = this.numberOfNewLines(
              text,
              indexChunk,
              indexEndPrevChunk,
            );
            lineCounterIndex -= numberOfIntermediateNewLines;
          }
          if (appendChunkOverlapHeader) {
            pageContent += chunkOverlapHeader;
          }
        }
        const newLinesCount = this.numberOfNewLines(chunk);

        const loc =
          _metadatas[i].loc && typeof _metadatas[i].loc === "object"
            ? { ..._metadatas[i].loc }
            : {};
        loc.lines = {
          from: lineCounterIndex,
          to: lineCounterIndex + newLinesCount,
        };
        const metadataWithLinesNumber = {
          ..._metadatas[i],
          loc,
        };

        pageContent += chunk;
        documents.push(
          new Document({
            pageContent,
            metadata: metadataWithLinesNumber,
          }),
        );
        lineCounterIndex += newLinesCount;
        prevChunk = chunk;
        indexPrevChunk = indexChunk;
      }
    }
    return documents;
  }

  private numberOfNewLines(text: string, start?: number, end?: number) {
    const textSection = text.slice(start, end);
    return (textSection.match(/\n/g) || []).length;
  }

  splitDocuments(
    documents: Document[],
    chunkHeaderOptions: TextSplitterChunkHeaderOptions = {},
  ): Document[] {
    const selectedDocuments = documents.filter(
      (doc) => doc.pageContent !== undefined,
    );
    const texts = selectedDocuments.map((doc) => doc.pageContent);
    const metadatas = selectedDocuments.map((doc) => doc.metadata);
    return this.createDocuments(texts, metadatas, chunkHeaderOptions);
  }

  private joinDocs(docs: string[], separator: string): string | null {
    const text = docs.join(separator).trim();
    return text === "" ? null : text;
  }

  mergeSplits(splits: string[], separator: string): string[] {
    const docs: string[] = [];
    const currentDoc: string[] = [];
    let total = 0;

    for (const d of splits) {
      const _len = this.lengthFunction(d);
      if (
        total + _len + (currentDoc.length > 0 ? separator.length : 0) >
        this.chunkSize
      ) {
        if (total > this.chunkSize) {
          console.warn(
            `Created a chunk of size ${total}, which is longer than the specified ${this.chunkSize}`,
          );
        }
        if (currentDoc.length > 0) {
          const doc = this.joinDocs(currentDoc, separator);
          if (doc !== null) {
            docs.push(doc);
          }

          // Keep the last few items for overlap
          while (currentDoc.length > 0 && total > this.chunkOverlap) {
            const firstLen = this.lengthFunction(currentDoc[0]);
            total -= firstLen;
            currentDoc.shift();
          }
        }
      }
      currentDoc.push(d);
      total += _len;
    }

    // Handle the last chunk
    const doc = this.joinDocs(currentDoc, separator);
    if (doc !== null) {
      docs.push(doc);
    }

    return docs;
  }
}
