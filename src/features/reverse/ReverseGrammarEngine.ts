// English sentence → ASL gloss order (inverse of GrammarEngine).
// "What is your name?" → ["YOU", "NAME", "WHAT"]

const WH_WORDS = new Set(["what", "where", "when", "why", "who", "how", "which"]);

const AUXILIARIES = new Set([
  "is", "are", "am", "was", "were", "be", "been", "being",
  "do", "does", "did", "have", "has", "had",
  "will", "would", "shall", "should", "can", "could", "may", "might", "must",
]);

const ARTICLES = new Set(["a", "an", "the"]);

const ENGLISH_TO_GLOSS: Record<string, string> = {
  you: "YOU",
  your: "YOUR",
  yours: "YOUR",
  i: "I",
  me: "ME",
  my: "MY",
  we: "WE",
  our: "WE",
  they: "THEY",
  their: "THEY",
  he: "HE",
  she: "SHE",
  it: "IT",
  what: "WHAT",
  where: "WHERE",
  when: "WHEN",
  why: "WHY",
  who: "WHO",
  how: "HOW",
  name: "NAME",
  go: "GO",
  went: "GO",
  eat: "EAT",
  ate: "EAT",
  store: "STORE",
  school: "SCHOOL",
  hungry: "HUNGRY",
  tired: "TIRED",
  hot: "HOT",
  cold: "COLD",
  hello: "HELLO",
  thank: "THANK",
  thanks: "THANK",
  yes: "YES",
  no: "NO",
  very: "VERY",
  today: "TODAY",
  yesterday: "YESTERDAY",
  tomorrow: "TOMORROW",
  weather: "WEATHER",
  time: "TIME",
  feel: "FEEL",
  headache: "HEADACHE",
  from: "FROM",
  the: "",
  are: "",
  is: "",
  am: "",
  was: "",
  were: "",
  be: "",
  have: "",
  has: "",
  had: "",
  will: "",
  would: "",
  can: "",
  could: "",
  should: "",
  a: "",
  an: "",
  which: "WHICH",
  want: "WANT",
  need: "NEED",
  help: "HELP",
  water: "WATER",
  know: "KNOW",
  understand: "UNDERSTAND",
  buy: "BUY",
  see: "SEE",
  come: "COME",
  good: "GOOD",
  bad: "BAD",
  happy: "HAPPY",
  sad: "SAD",
};

function tokenize(sentence: string): string[] {
  return sentence
    .toLowerCase()
    .replace(/[?!.,;:'"]/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

function toGlossToken(word: string): string | null {
  if (ARTICLES.has(word) || AUXILIARIES.has(word)) return null;
  if (ENGLISH_TO_GLOSS[word] !== undefined) {
    const mapped = ENGLISH_TO_GLOSS[word];
    return mapped || null;
  }
  if (WH_WORDS.has(word)) return word.toUpperCase();
  return word.toUpperCase();
}

export class ReverseGrammarEngine {
  /**
   * Convert natural English to ASL gloss word order.
   */
  static toGloss(sentence: string): string[] {
    if (!sentence.trim()) return [];

    const tokens = tokenize(sentence);
    const whTokens: string[] = [];
    const contentTokens: string[] = [];

    for (const token of tokens) {
      const gloss = toGlossToken(token);
      if (!gloss) continue;

      if (WH_WORDS.has(token)) {
        whTokens.push(gloss);
      } else {
        contentTokens.push(gloss);
      }
    }

    // Possessive fix: YOUR NAME → YOU NAME (ASL points at person + signs NAME)
    const normalized = contentTokens.map((w) => (w === "YOUR" ? "YOU" : w === "MY" ? "I" : w));

    // WH-words at end (ASL grammar)
    return [...normalized, ...whTokens];
  }
}

export function englishToGloss(sentence: string): string[] {
  return ReverseGrammarEngine.toGloss(sentence);
}
