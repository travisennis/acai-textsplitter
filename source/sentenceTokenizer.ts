type Token = string;

/**
 * Enhanced sentence tokenizer considering abbreviations and context.
 * @param text Input text to split into sentences.
 * @param abbreviations Set of lowercase abbreviations without trailing dot.
 * @returns Array of sentences.
 */
export function sentenceTokenizer(
  text: string,
  abbreviations: Set<string>,
): string[] {
  // Tokenize while preserving whitespace and punctuation
  const tokens: Token[] =
    text.match(/[\w'’]+|\.{2,}|[.,!?]+|\s+|[^\w\s]/g) || [];
  const sentences: string[] = [];
  let currentSentence: Token[] = [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];
    currentSentence.push(token);

    if (/[.!?]/.test(token)) {
      let isAbbreviation = false;
      let isNumber = false;

      // Check previous non-space tokens for abbreviation
      let j = currentSentence.length - 2;
      while (j >= 0 && /\s/.test(currentSentence[j])) {
        j--;
      }

      if (j >= 0) {
        // Check for abbreviation patterns
        console.log(currentSentence[j]);
        const prevToken = currentSentence[j].toLowerCase().replace(/\.$/, "");
        console.log(prevToken);
        isAbbreviation = abbreviations.has(prevToken);
        console.log(isAbbreviation);

        // Check for numbered items like "1."
        isNumber = /\d+/.test(currentSentence[j]);
      }

      // Check subsequent tokens for sentence start
      let k = i + 1;
      while (k < tokens.length && /\s/.test(tokens[k])) {
        k++;
      }

      if (k < tokens.length) {
        const nextToken = tokens[k];
        const nextIsCapital = /^[A-Z“"‘']/.test(nextToken);
        const nextIsQuote = /^[”’)]/.test(nextToken);
        const previousIsEOS = k === i + 1 && currentSentence.length > 3;

        // Handle different sentence end scenarios
        if ((nextIsCapital || nextIsQuote) && !isAbbreviation && !isNumber) {
          // Check for edge case like closing quotes
          if (nextIsQuote) {
            let quoteK = k + 1;
            while (quoteK < tokens.length && /\s/.test(tokens[quoteK])) {
              quoteK++;
            }
            if (quoteK < tokens.length && /^[A-Z]/.test(tokens[quoteK])) {
              sentences.push(currentSentence.join("").trim());
              currentSentence = [];
            }
          } else {
            sentences.push(currentSentence.join("").trim());
            currentSentence = [];
          }
        } else if (previousIsEOS && nextIsCapital) {
          sentences.push(currentSentence.join("").trim());
          currentSentence = [];
        }
      }
    }

    i++;
  }

  // Add remaining tokens as final sentence
  if (currentSentence.length > 0) {
    sentences.push(currentSentence.join("").trim());
  }

  return sentences.filter((s) => s.length > 0);
}

// Example usage
const commonAbbreviations = new Set([
  "mr",
  "mrs",
  "ms",
  "dr",
  "prof",
  "rev",
  "hon",
  "esq",
  "sr",
  "jr",
  "phd",
  "md",
  "usa",
  "uk",
  "etc",
  "viz",
  "ie",
  "eg",
  "approx",
  "apt",
  "dept",
  "univ",
  "vol",
  "ed",
  "eds",
  "repr",
  "trans",
  "p",
  "pp",
  "ch",
  "sec",
  "ex",
  "cf",
  "al",
  "nos",
  "n",
  "no",
  "v",
  "vs",
  "i.e",
  "e.g",
  "re",
  "fig",
  "para",
  "paras",
  "sec",
  "cf",
]);

const text =
  "Mr. Smith Jr. returned from Washington D.C. at 5 p.m. He said, “This is an example! Will it work?” I hope so!";
const sentences = sentenceTokenizer(text, commonAbbreviations);
console.log(sentences);
