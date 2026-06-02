/**
 * Accumulates gloss words across short pauses into one sentence before translation.
 * Used when the signer produces multiple sign chunks in one utterance.
 */

const DEFAULT_PAUSE_MS = 1200;
const MAX_WORDS = 24;

export class GlossSentenceBuffer {
  private words: string[] = [];
  private lastAppendAt = 0;

  constructor(private readonly pauseMs = DEFAULT_PAUSE_MS) {}

  append(words: string[]): void {
    if (!words.length) return;
    const now = Date.now();
    if (this.words.length > 0 && now - this.lastAppendAt > this.pauseMs) {
      this.words = [];
    }
    for (const w of words) {
      const upper = w.toUpperCase();
      if (this.words[this.words.length - 1] !== upper) {
        this.words.push(upper);
      }
    }
    if (this.words.length > MAX_WORDS) {
      this.words = this.words.slice(-MAX_WORDS);
    }
    this.lastAppendAt = now;
  }

  getWords(): string[] {
    return [...this.words];
  }

  clear(): void {
    this.words = [];
    this.lastAppendAt = 0;
  }

  hasContent(): boolean {
    return this.words.length > 0;
  }
}
