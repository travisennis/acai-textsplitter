import { readFileSync } from "node:fs";
import { CharacterTextSplitter } from "./source/characterTextSplitter.ts";
import { RecursiveCharacterTextSplitter } from "./source/recursiveCharacterTextSplitter.ts";
import { TokenTextSplitter } from "./source/tokenTextSplitter.ts";
import { MarkdownTextSplitter } from "./source/markdownTextSplitter.ts";
import { LatexTextSplitter } from "./source/latexTextSplitter.ts";
import { Document } from "./source/document.ts";

// CharacterTextSplitter
const characterSplitter = new CharacterTextSplitter({
  chunkSize: 100,
  chunkOverlap: 20,
  separator: "\n",
});
const text = "This is a long text.\nIt will be split.\nInto smaller chunks.";
const characterChunks = characterSplitter.splitText(text);
console.log("Character Chunks:", characterChunks);
const characterDocuments = characterSplitter.createDocuments(
  [text],
  [{ source: "example.txt" }],
);
console.log("Character Documents:", characterDocuments);

// RecursiveCharacterTextSplitter (for Python)
const pythonSplitter = RecursiveCharacterTextSplitter.fromLanguage("python", {
  chunkSize: 50,
  chunkOverlap: 10,
});
const pythonCode = `
def my_function(x):
    if x > 10:
        return x * 2
    else:
        return x / 2

class MyClass:
    def __init__(self, value):
        self.value = value
`;
const pythonChunks = pythonSplitter.splitText(pythonCode);
console.log("Python Chunks:", pythonChunks);

// TokenTextSplitter
const tokenSplitter = new TokenTextSplitter({
  chunkSize: 10,
  chunkOverlap: 2,
  encodingName: "cl100k_base", // Example encoding
});

const tokenText = "This is a sentence to be tokenized.";
const tokenChunks = tokenSplitter.splitText(tokenText);
console.log("Token Chunks:", tokenChunks);

// MarkdownTextSplitter
const markdownSplitter = new MarkdownTextSplitter({
  chunkSize: 50,
  chunkOverlap: 10,
});
const markdownText = `# Heading 1

This is some text.

## Heading 2

More text here.`;
const markdownChunks = markdownSplitter.splitText(markdownText);
console.log("Markdown Chunks:", markdownChunks);

// LatexTextSplitter
const latexSplitter = new LatexTextSplitter({
  chunkSize: 50,
  chunkOverlap: 10,
});

const latexText = `\\section{Introduction}
This is the introduction.

\\section{Main Body}
This is the main body.`;
const latexChunks = latexSplitter.splitText(latexText);
console.log("LaTeX Chunks:", latexChunks);

// Example using createDocuments
const documents = characterSplitter.createDocuments(
  ["First text", "Second text"],
  [{ id: "doc1" }, { id: "doc2" }],
  { chunkHeader: "CHUNK: ", appendChunkOverlapHeader: true },
);
console.log(documents);

const splitter = new CharacterTextSplitter();
const docOutput = splitter.splitDocuments([
  new Document({ pageContent: "foo" }),
]);
console.log(docOutput);

const filePath = "./source/textSplitter.ts";
const fileContents = readFileSync(filePath, "utf-8");
const codeSplitter = RecursiveCharacterTextSplitter.fromLanguage("js", {
  chunkSize: 250,
  chunkOverlap: 25,
});

const c = codeSplitter.splitText(fileContents);
console.log("Chunk1", c[0]);
console.log("Chunk2", c[1]);
console.log("Chunk3", c[2]);
console.log("Chunk4", c[3]);
