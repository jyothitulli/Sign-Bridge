// src/features/grammar/GrammarEngine.ts
// The core of SignBridge — converts ASL gloss word sequences into natural English.
// Input:  ["YOU", "NAME", "WHAT"]
// Output: "What is your name?"

import type { GrammarContext, GrammarRule, QuestionType } from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const WH_WORDS = new Set(["WHAT", "WHERE", "WHEN", "WHY", "WHO", "HOW", "WHICH"]);

const TIME_MARKERS = new Set(["YESTERDAY", "TODAY", "TOMORROW", "BEFORE", "AFTER", "LATER", "RECENTLY", "SOON"]);

const DESTINATIONS = new Set([
  "STORE", "SCHOOL", "HOSPITAL", "WORK", "HOME", "PARK", "LIBRARY",
  "RESTAURANT", "CHURCH", "MARKET", "OFFICE", "GYM", "BANK",
]);

const MOTION_VERBS = new Set(["GO", "COME", "WALK", "DRIVE", "FLY", "RUN", "TRAVEL"]);

const IRREGULAR_PAST: Record<string, string> = {
  GO: "went", COME: "came", EAT: "ate", SEE: "saw", BUY: "bought",
  HAVE: "had", DO: "did", MAKE: "made", TAKE: "took", GIVE: "gave",
  GET: "got", KNOW: "knew", THINK: "thought", FEEL: "felt",
  FIND: "found", TELL: "told", BECOME: "became", LEAVE: "left",
  MEET: "met", RUN: "ran", BRING: "brought", DRINK: "drank",
  WRITE: "wrote", READ: "read", SLEEP: "slept", DRIVE: "drove",
  FLY: "flew", FALL: "fell", SEND: "sent", SPEAK: "spoke",
  UNDERSTAND: "understood", WAKE: "woke",
};

// Nouns that take "a"/"an" article
const COUNTABLE_NOUNS = new Set([
  "HEADACHE", "DOG", "CAT", "CAR", "HOUSE", "BOOK", "DOCTOR", "STORE",
  "RESTAURANT", "PROBLEM", "QUESTION", "IDEA", "DREAM", "JOB", "CLASS",
  "FRIEND", "BROTHER", "SISTER", "TEACHER", "MEETING", "PLAN",
]);

const PRONOUN_MAP: Record<string, Record<string, string>> = {
  YOU: { subject: "you", object: "you", possessive: "your" },
  I:   { subject: "I",   object: "me",  possessive: "my"   },
  ME:  { subject: "I",   object: "me",  possessive: "my"   },
  HE:  { subject: "he",  object: "him", possessive: "his"  },
  SHE: { subject: "she", object: "her", possessive: "her"  },
  WE:  { subject: "we",  object: "us",  possessive: "our"  },
  THEY:{ subject: "they",object: "them",possessive:"their" },
  IT:  { subject: "it",  object: "it",  possessive: "its"  },
};

// ─── Helper functions ─────────────────────────────────────────────────────────

function toLower(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function capitalize(sentence: string): string {
  if (!sentence) return "";
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

function addPunctuation(sentence: string, questionType: QuestionType): string {
  const trimmed = sentence.trim();
  if (!trimmed) return trimmed;
  if (questionType === "WH" || questionType === "YES_NO") {
    return trimmed.endsWith("?") ? trimmed : trimmed + "?";
  }
  return trimmed.endsWith(".") ? trimmed : trimmed + ".";
}



// ─── Grammar Rules (applied in priority order) ───────────────────────────────

const GRAMMAR_RULES: GrammarRule[] = [

  // ── Rule 1: Extract and move time markers to front ──────────────────────────
  {
    name: "time_marker_to_front",
    priority: 1,
    condition: (words) =>
      words.some((w) => TIME_MARKERS.has(w)) &&
      words.length > 0 &&
      !TIME_MARKERS.has(words[0]),
    transform: (words) => {
      const markers = words.filter(w => TIME_MARKERS.has(w));
      const rest = words.filter(w => !TIME_MARKERS.has(w));
      return [...markers, ...rest];
    },
  },

  // ── Rule 2: Move WH-word to front (ASL puts it at end, English at front) ───
  {
    name: "wh_word_to_front",
    priority: 2,
    condition: (words) => {
      const whIndex = words.findIndex(w => WH_WORDS.has(w));
      return whIndex > 0; // WH word exists but not already at front
    },
    transform: (words) => {
      const whWord = words.find(w => WH_WORDS.has(w))!;
      const rest = words.filter(w => w !== whWord);
      return [whWord, ...rest];
    },
  },

  // ── Rule 3: Fix "VERY" placement (ASL: "HOT VERY" → English: "VERY HOT") ──
  {
    name: "fix_very_placement",
    priority: 3,
    condition: (words) => {
      const idx = words.indexOf("VERY");
      return idx > 0; // VERY exists but not at start
    },
    transform: (words) => {
      const result = [...words];
      const veryIdx = result.indexOf("VERY");
      if (veryIdx > 0) {
        result.splice(veryIdx, 1); // remove VERY
        result.splice(veryIdx - 1, 0, "VERY"); // insert before previous word
      }
      return result;
    },
  },

  // ── Rule 4: Apply past tense when time marker is YESTERDAY ─────────────────
  {
    name: "past_tense_from_yesterday",
    priority: 4,
    condition: (words, ctx) => ctx.hasTimeMarker && ctx.timeMarker === "YESTERDAY",
    transform: (words) => {
      return words.map(w => {
        if (IRREGULAR_PAST[w]) return IRREGULAR_PAST[w].toUpperCase();
        // Regular verbs: just mark them (we'll handle casing in finalize)
        if (w.length > 3 && !WH_WORDS.has(w) && !TIME_MARKERS.has(w) &&
            !Object.values(PRONOUN_MAP).some(p => Object.values(p).map(v => v.toUpperCase()).includes(w))) {
          // Simple past: add -ED for regular verbs (only verbs, roughly)
          const verbSet = new Set(["WALK", "TALK", "WORK", "PLAY", "WATCH", "HELP", "CALL", "VISIT", "CLEAN", "COOK"]);
          if (verbSet.has(w)) return w + "ED";
        }
        return w;
      });
    },
  },

  // ── Rule 5: Move adjective after subject (ASL: "TIRED I" → "I TIRED") ─────
  {
    name: "subject_before_adjective",
    priority: 5,
    condition: (words): boolean => {
  const adjectives = new Set(["TIRED", "HUNGRY", "SICK", "HAPPY", "SAD", "ANGRY", "EXCITED", "SCARED", "BORED", "COLD", "HOT"]);
  const pronouns = new Set(Object.keys(PRONOUN_MAP));
  const adjIdx = words.findIndex(w => adjectives.has(w));
  const pronounIdx = words.findIndex(w => pronouns.has(w));
  return adjIdx >= 0 && pronounIdx >= 0 && pronounIdx > adjIdx;
},
    transform: (words) => {
      const adjectives = new Set(["TIRED", "HUNGRY", "SICK", "HAPPY", "SAD", "ANGRY", "EXCITED", "SCARED", "BORED", "COLD", "HOT"]);
      const pronouns = new Set(Object.keys(PRONOUN_MAP));
      const adjIdx = words.findIndex(w => adjectives.has(w));
      const pronounIdx = words.findIndex(w => pronouns.has(w));
      if (adjIdx < 0 || pronounIdx < 0) return words;
      const result = [...words];
      // Swap: move pronoun before adjective
      const [pronoun] = result.splice(pronounIdx, 1);
      result.splice(adjIdx, 0, pronoun);
      return result;
    },
  },

  // ── Rule 6: Add "TO" before destination nouns ──────────────────────────────
  {
    name: "add_to_for_destination",
    priority: 6,
    condition: (words) => {
      const hasMotion = words.some(w => MOTION_VERBS.has(w));
      const hasDest = words.some(w => DESTINATIONS.has(w));
      return hasMotion && hasDest;
    },
    transform: (words) => {
      const result: string[] = [];
      for (let i = 0; i < words.length; i++) {
        result.push(words[i]);
        if (DESTINATIONS.has(words[i]) && i > 0 && !["TO", "THE", "A", "AN"].includes(words[i - 1])) {
          // insert "TO" before this destination by popping last and re-inserting
          result.splice(result.length - 1, 0, "TO");
        }
      }
      return result;
    },
  },

];

// ─── Context Builder ──────────────────────────────────────────────────────────

function buildContext(words: string[], questionType: QuestionType): GrammarContext {
  const timeMarkerWord = words.find(w => TIME_MARKERS.has(w));
  return {
    questionType,
    hasTimeMarker: !!timeMarkerWord,
    timeMarker: timeMarkerWord,
    subject: words.find(w => Object.keys(PRONOUN_MAP).includes(w)),
  };
}

// ─── Sentence Finalizer ───────────────────────────────────────────────────────
// Converts processed word array into natural English string

function finalizeToEnglish(words: string[], context: GrammarContext): string {
  const result: string[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const lower = word.toLowerCase();

    // Skip removed markers (already placed at front)
    if (word === "__SKIP__") continue;

    // ── Pronouns with case ──
    if (PRONOUN_MAP[word]) {
      const map = PRONOUN_MAP[word];
      const nextWord = words[i + 1];
      if (nextWord && (COUNTABLE_NOUNS.has(nextWord) || ["NAME", "FRIEND", "FAMILY", "WORK", "HOUSE", "CAR"].includes(nextWord))) {
        result.push(map.possessive);
      } else {
        result.push(map.subject);
      }
      continue;
    }

    // ── Time markers → lowercase natural form ──
    if (TIME_MARKERS.has(word)) {
      result.push(lower);
      continue;
    }

    // ── WH words → lowercase ──
    if (WH_WORDS.has(word)) {
      result.push(lower);
      continue;
    }

    // ── Add articles before countable nouns ──
    if (COUNTABLE_NOUNS.has(word)) {
      const prev = result[result.length - 1];
      const needsArticle = prev && !["a", "an", "the", "my", "your", "his", "her", "our", "their", "its", "this", "that"].includes(prev.toLowerCase());
      if (needsArticle) {
        const article = ["a", "e", "i", "o", "u"].includes(lower[0]) ? "an" : "a";
        result.push(article);
      }
      result.push(toLower(word));
      continue;
    }

    // ── Verbs: handle irregular past (already converted to WENT etc) ──
    const irregularValues = Object.values(IRREGULAR_PAST).map(v => v.toUpperCase());
    if (irregularValues.includes(word)) {
      result.push(lower);
      continue;
    }

    // ── Verbs ending in ED (regular past) ──
    if (word.endsWith("ED") && word.length > 4) {
      result.push(lower);
      continue;
    }

    // ── Default: just lowercase the word ──
    result.push(lower);
  }

  // ── Add auxiliary verb for questions ──
  let sentence = result.join(" ");
  sentence = addAuxiliary(sentence, words, context);

  return sentence;
}

// ─── Auxiliary Verb Insertion ─────────────────────────────────────────────────

function addAuxiliary(sentence: string, originalWords: string[], context: GrammarContext): string {
  const words = sentence.split(" ");

  if (context.questionType === "WH") {
    // WH-question: "what your name" → "what is your name"
    const whWords = ["what", "where", "when", "why", "who", "how", "which"];
    const firstWord = words[0]?.toLowerCase();
    if (whWords.includes(firstWord) && words[1] !== "is" && words[1] !== "are" && words[1] !== "do" && words[1] !== "does" && words[1] !== "did") {
      // Determine "is" vs "are" based on subject
      const subject = words.find(w => ["i", "you", "he", "she", "it", "we", "they"].includes(w));
      let aux = "is";
      if (subject === "i") aux = "am";
      else if (["you", "we", "they"].includes(subject || "")) aux = "are";
      else if (context.hasTimeMarker && context.timeMarker === "YESTERDAY") aux = "did";
      words.splice(1, 0, aux);
    }
  } else if (context.questionType === "YES_NO") {
    // YES/NO question: "you hungry" → "are you hungry?"
    const firstWord = words[0]?.toLowerCase();
    const auxiliaries = ["are", "is", "am", "do", "does", "did", "have", "has", "had", "will", "would", "can", "could"];
    if (!auxiliaries.includes(firstWord)) {
      const subject = words.find(w => ["i", "you", "he", "she", "it", "we", "they"].includes(w));
      let aux = "are";
      if (subject === "i") aux = "am";
      else if (["he", "she", "it"].includes(subject || "")) aux = "is";
      else if (context.hasTimeMarker && context.timeMarker === "YESTERDAY") aux = "did";
      words.unshift(aux);
    }
  }

  return words.join(" ");
}

// ─── Main Export: Grammar Engine ─────────────────────────────────────────────

export class GrammarEngine {
  /**
   * Convert ASL gloss word array to natural English sentence.
   * @param rawWords  - e.g. ["YOU", "NAME", "WHAT"]
   * @param questionType - detected from face expression analysis
   * @returns Natural English string: "What is your name?"
   */
  static correct(rawWords: string[], questionType: QuestionType = "STATEMENT"): string {
    if (!rawWords || rawWords.length === 0) return "";

    // Clean input
    let words = rawWords
      .map(w => w.trim().toUpperCase())
      .filter(w => w.length > 0);

    // Build context
    const context = buildContext(words, questionType);

    // Apply rules in priority order
    const sortedRules = [...GRAMMAR_RULES].sort((a, b) => a.priority - b.priority);
    for (const rule of sortedRules) {
      try {
        if (rule.condition(words, context)) {
          words = rule.transform(words, context);
        }
      } catch {
        // Rule failed silently — don't crash the whole engine
        console.warn(`[GrammarEngine] Rule "${rule.name}" failed, skipping`);
      }
    }

    // Finalize to natural English
    const sentence = finalizeToEnglish(words, context);

    // Capitalize and add punctuation
    return addPunctuation(capitalize(sentence), questionType);
  }

  /**
   * Test the engine with all example pairs from the project spec.
   * Run this in browser console to verify correctness.
   */
  static runTests(): void {
    const testCases: [string[], QuestionType, string][] = [
      [["YOU", "NAME", "WHAT"],           "WH",        "What is your name?"],
      [["YOU", "EAT", "WHAT"],            "WH",        "What did you eat?"],
      [["TODAY", "WEATHER", "HOT"],       "STATEMENT", "Today the weather is hot."],
      [["YESTERDAY", "I", "GO", "STORE"], "STATEMENT", "Yesterday I went to the store."],
      [["YOU", "HUNGRY"],                 "YES_NO",    "Are you hungry?"],
      [["I", "FEEL", "HEADACHE"],         "STATEMENT", "I feel a headache."],
      [["TIME", "WHAT"],                  "WH",        "What is the time?"],
      [["I", "TIRED", "VERY"],            "STATEMENT", "I am very tired."],
    ];

    console.group("[GrammarEngine] Test Results");
    let passed = 0;
    for (const [input, qType, expected] of testCases) {
      const result = GrammarEngine.correct(input, qType);
      const ok = result.toLowerCase() === expected.toLowerCase();
      if (ok) passed++;
      console.log(`${ok ? "✅" : "⚠️"} [${qType}] ${JSON.stringify(input)}\n   → "${result}"\n   expected: "${expected}"`);
    }
    console.log(`\nPassed: ${passed}/${testCases.length}`);
    console.groupEnd();
  }
}

// Convenience export for direct use
export function correctGloss(words: string[], questionType: QuestionType = "STATEMENT"): string {
  return GrammarEngine.correct(words, questionType);
}