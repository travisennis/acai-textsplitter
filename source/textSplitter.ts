import { type TiktokenEncoding, type Tiktoken, getEncoding } from "js-tiktoken";

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

export interface DocumentInterface<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Metadata extends Record<string, any> = Record<string, any>,
> {
  pageContent: string;

  metadata: Metadata;

  /**
   * An optional identifier for the document.
   *
   * Ideally this should be unique across the document collection and formatted
   * as a UUID, but this will not be enforced.
   */
  id?: string;
}

export class Document<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Metadata extends Record<string, any> = Record<string, any>,
> implements DocumentInterface
{
  pageContent: string;

  metadata: Metadata;

  // The ID field is optional at the moment.
  // It will likely become required in a future major release after
  // it has been adopted by enough vectorstore implementations.
  /**
   * An optional identifier for the document.
   *
   * Ideally this should be unique across the document collection and formatted
   * as a UUID, but this will not be enforced.
   */
  id: string | undefined;

  constructor(fields: {
    pageContent: string;
    metadata?: Metadata;
    id?: string;
  }) {
    this.pageContent =
      fields.pageContent !== undefined ? fields.pageContent.toString() : "";
    this.metadata = fields.metadata ?? ({} as Metadata);
    this.id = fields.id;
  }
}

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

// --- RecursiveCharacterTextSplitter ---
export interface RecursiveCharacterTextSplitterParams
  extends TextSplitterParams {
  separators: string[];
}

export const SupportedTextSplitterLanguages = [
  "cpp",
  "go",
  "java",
  "js",
  "php",
  "proto",
  "python",
  "rst",
  "ruby",
  "rust",
  "scala",
  "swift",
  "markdown",
  "latex",
  "html",
  "sol",
] as const;

export type SupportedTextSplitterLanguage =
  (typeof SupportedTextSplitterLanguages)[number];

export class RecursiveCharacterTextSplitter
  extends TextSplitter
  implements RecursiveCharacterTextSplitterParams
{
  separators: string[] = ["\n\n", "\n", " ", ""];

  constructor(fields?: Partial<RecursiveCharacterTextSplitterParams>) {
    super(fields);
    this.separators = fields?.separators ?? this.separators;
    this.keepSeparator = fields?.keepSeparator ?? true;
  }

  private _splitText(text: string, separators: string[]): string[] {
    const finalChunks: string[] = [];

    // Get appropriate separator to use
    let separator: string = separators[separators.length - 1];
    let newSeparators: string[] | undefined;
    for (let i = 0; i < separators.length; i += 1) {
      const s = separators[i];
      if (s === "") {
        separator = s;
        break;
      }
      if (text.includes(s)) {
        separator = s;
        newSeparators = separators.slice(i + 1);
        break;
      }
    }

    // Now that we have the separator, split the text
    const splits = this.splitOnSeparator(text, separator);

    // Now go merging things, recursively splitting longer texts.
    let goodSplits: string[] = [];
    const _separator = this.keepSeparator ? "" : separator;

    for (const s of splits) {
      if (this.lengthFunction(s) < this.chunkSize) {
        goodSplits.push(s);
      } else {
        if (goodSplits.length > 0) {
          const mergedText = this.mergeSplits(goodSplits, _separator);
          finalChunks.push(...mergedText);
          goodSplits = [];
        }
        if (newSeparators) {
          const otherInfo = this._splitText(s, newSeparators);
          finalChunks.push(...otherInfo);
        } else {
          finalChunks.push(s);
        }
      }
    }

    if (goodSplits.length > 0) {
      const mergedText = this.mergeSplits(goodSplits, _separator);
      finalChunks.push(...mergedText);
    }

    return finalChunks;
  }

  splitText(text: string): string[] {
    return this._splitText(text, this.separators);
  }

  static fromLanguage(
    language: SupportedTextSplitterLanguage,
    options?: Partial<RecursiveCharacterTextSplitterParams>,
  ): RecursiveCharacterTextSplitter {
    return new RecursiveCharacterTextSplitter({
      ...options,
      separators:
        RecursiveCharacterTextSplitter.getSeparatorsForLanguage(language),
    });
  }

  static getSeparatorsForLanguage(
    language: SupportedTextSplitterLanguage,
  ): string[] {
    //copy this function from the original code
    if (language === "cpp") {
      return [
        // Split along class definitions
        "\nclass ",
        // Split along function definitions
        "\nvoid ",
        "\nint ",
        "\nfloat ",
        "\ndouble ",
        // Split along control flow statements
        "\nif ",
        "\nfor ",
        "\nwhile ",
        "\nswitch ",
        "\ncase ",
        // Split by the normal type of lines
        "\n\n",
        "\n",
        " ",
        "",
      ];
    }
    if (language === "go") {
      return [
        // Split along function definitions
        "\nfunc ",
        "\nvar ",
        "\nconst ",
        "\ntype ",
        // Split along control flow statements
        "\nif ",
        "\nfor ",
        "\nswitch ",
        "\ncase ",
        // Split by the normal type of lines
        "\n\n",
        "\n",
        " ",
        "",
      ];
    }
    if (language === "java") {
      return [
        // Split along class definitions
        "\nclass ",
        // Split along method definitions
        "\npublic ",
        "\nprotected ",
        "\nprivate ",
        "\nstatic ",
        // Split along control flow statements
        "\nif ",
        "\nfor ",
        "\nwhile ",
        "\nswitch ",
        "\ncase ",
        // Split by the normal type of lines
        "\n\n",
        "\n",
        " ",
        "",
      ];
    }
    if (language === "js") {
      return [
        // Split along function definitions
        "\nfunction ",
        "\nconst ",
        "\nlet ",
        "\nvar ",
        "\nclass ",
        // Split along control flow statements
        "\nif ",
        "\nfor ",
        "\nwhile ",
        "\nswitch ",
        "\ncase ",
        "\ndefault ",
        // Split by the normal type of lines
        "\n\n",
        "\n",
        " ",
        "",
      ];
    }
    if (language === "php") {
      return [
        // Split along function definitions
        "\nfunction ",
        // Split along class definitions
        "\nclass ",
        // Split along control flow statements
        "\nif ",
        "\nforeach ",
        "\nwhile ",
        "\ndo ",
        "\nswitch ",
        "\ncase ",
        // Split by the normal type of lines
        "\n\n",
        "\n",
        " ",
        "",
      ];
    }
    if (language === "proto") {
      return [
        // Split along message definitions
        "\nmessage ",
        // Split along service definitions
        "\nservice ",
        // Split along enum definitions
        "\nenum ",
        // Split along option definitions
        "\noption ",
        // Split along import statements
        "\nimport ",
        // Split along syntax declarations
        "\nsyntax ",
        // Split by the normal type of lines
        "\n\n",
        "\n",
        " ",
        "",
      ];
    }
    if (language === "python") {
      return [
        // First, try to split along class definitions
        "\nclass ",
        "\ndef ",
        "\n\tdef ",
        // Now split by the normal type of lines
        "\n\n",
        "\n",
        " ",
        "",
      ];
    }
    if (language === "rst") {
      return [
        // Split along section titles
        "\n===\n",
        "\n---\n",
        "\n***\n",
        // Split along directive markers
        "\n.. ",
        // Split by the normal type of lines
        "\n\n",
        "\n",
        " ",
        "",
      ];
    }
    if (language === "ruby") {
      return [
        // Split along method definitions
        "\ndef ",
        "\nclass ",
        // Split along control flow statements
        "\nif ",
        "\nunless ",
        "\nwhile ",
        "\nfor ",
        "\ndo ",
        "\nbegin ",
        "\nrescue ",
        // Split by the normal type of lines
        "\n\n",
        "\n",
        " ",
        "",
      ];
    }
    if (language === "rust") {
      return [
        // Split along function definitions
        "\nfn ",
        "\nconst ",
        "\nlet ",
        // Split along control flow statements
        "\nif ",
        "\nwhile ",
        "\nfor ",
        "\nloop ",
        "\nmatch ",
        "\nconst ",
        // Split by the normal type of lines
        "\n\n",
        "\n",
        " ",
        "",
      ];
    }
    if (language === "scala") {
      return [
        // Split along class definitions
        "\nclass ",
        "\nobject ",
        // Split along method definitions
        "\ndef ",
        "\nval ",
        "\nvar ",
        // Split along control flow statements
        "\nif ",
        "\nfor ",
        "\nwhile ",
        "\nmatch ",
        "\ncase ",
        // Split by the normal type of lines
        "\n\n",
        "\n",
        " ",
        "",
      ];
    }
    if (language === "swift") {
      return [
        // Split along function definitions
        "\nfunc ",
        // Split along class definitions
        "\nclass ",
        "\nstruct ",
        "\nenum ",
        // Split along control flow statements
        "\nif ",
        "\nfor ",
        "\nwhile ",
        "\ndo ",
        "\nswitch ",
        "\ncase ",
        // Split by the normal type of lines
        "\n\n",
        "\n",
        " ",
        "",
      ];
    }
    if (language === "markdown") {
      return [
        // First, try to split along Markdown headings (starting with level 2)
        "\n## ",
        "\n### ",
        "\n#### ",
        "\n##### ",
        "\n###### ",
        // Note the alternative syntax for headings (below) is not handled here
        // Heading level 2
        // ---------------
        // End of code block
        "```\n\n",
        // Horizontal lines
        "\n\n***\n\n",
        "\n\n---\n\n",
        "\n\n___\n\n",
        // Note that this splitter doesn't handle horizontal lines defined
        // by *three or more* of ***, ---, or ___, but this is not handled
        "\n\n",
        "\n",
        " ",
        "",
      ];
    }
    if (language === "latex") {
      return [
        // First, try to split along Latex sections
        "\n\\chapter{",
        "\n\\section{",
        "\n\\subsection{",
        "\n\\subsubsection{",

        // Now split by environments
        "\n\\begin{enumerate}",
        "\n\\begin{itemize}",
        "\n\\begin{description}",
        "\n\\begin{list}",
        "\n\\begin{quote}",
        "\n\\begin{quotation}",
        "\n\\begin{verse}",
        "\n\\begin{verbatim}",

        // Now split by math environments
        "\n\\begin{align}",
        "$$",
        "$",

        // Now split by the normal type of lines
        "\n\n",
        "\n",
        " ",
        "",
      ];
    }
    if (language === "html") {
      return [
        // First, try to split along HTML tags
        "<body>",
        "<div>",
        "<p>",
        "<br>",
        "<li>",
        "<h1>",
        "<h2>",
        "<h3>",
        "<h4>",
        "<h5>",
        "<h6>",
        "<span>",
        "<table>",
        "<tr>",
        "<td>",
        "<th>",
        "<ul>",
        "<ol>",
        "<header>",
        "<footer>",
        "<nav>",
        // Head
        "<head>",
        "<style>",
        "<script>",
        "<meta>",
        "<title>",
        // Normal type of lines
        " ",
        "",
      ];
    }
    if (language === "sol") {
      return [
        // Split along compiler informations definitions
        "\npragma ",
        "\nusing ",
        // Split along contract definitions
        "\ncontract ",
        "\ninterface ",
        "\nlibrary ",
        // Split along method definitions
        "\nconstructor ",
        "\ntype ",
        "\nfunction ",
        "\nevent ",
        "\nmodifier ",
        "\nerror ",
        "\nstruct ",
        "\nenum ",
        // Split along control flow statements
        "\nif ",
        "\nfor ",
        "\nwhile ",
        "\ndo while ",
        "\nassembly ",
        // Split by the normal type of lines
        "\n\n",
        "\n",
        " ",
        "",
      ];
    }
    throw new Error(`Language ${language} is not supported.`);
  }
}

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

// --- LatexTextSplitter ---

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

// Re-export splitters
export * from "./splitters";
