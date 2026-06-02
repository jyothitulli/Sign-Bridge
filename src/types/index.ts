// src/types/index.ts
// All shared TypeScript types for SignBridge

// ─── Landmarks ───────────────────────────────────────────────────────────────

export interface Point3D {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface LandmarkFrame {
  poseLandmarks: Point3D[];
  leftHandLandmarks: Point3D[];
  rightHandLandmarks: Point3D[];
  faceLandmarks: Point3D[];
  timestamp: number;
}

export interface FlatFeatureVector {
  features: Float32Array; // 1629 values: 543 points × 3 coords
  timestamp: number;
}

// ─── Face / Expression ───────────────────────────────────────────────────────

export type QuestionType = "WH" | "YES_NO" | "STATEMENT";

export type FacialGrammarTag =
  | "YES_NO_Q"
  | "WH_Q"
  | "NEGATION"
  | "TOPIC"
  | "RHETORICAL"
  | "NEUTRAL";

export interface FaceExpressionResult {
  questionType: QuestionType;
  eyebrowHeight: number;   // positive = raised, negative = furrowed
  confidence: number;      // 0-1
}

// ─── Translation ─────────────────────────────────────────────────────────────

export interface DetectedSign {
  word: string;
  confidence: number;
  startFrame: number;
  endFrame: number;
}

export interface TranslationResult {
  id: string;
  rawWords: string[];           // ["YOU", "NAME", "WHAT"]
  correctedSentence: string;    // "What is your name?"
  questionType: QuestionType;
  confidence: number;
  timestamp: number;
  duration: number;             // ms
  engine?: "lstm" | "tcn" | "classifier" | "dtw";
  facialTags?: FacialGrammarTag[];
  translationSource?: "index" | "grammar" | "hybrid";
}

// ─── Grammar Engine ──────────────────────────────────────────────────────────

export interface GrammarContext {
  questionType: QuestionType;
  hasTimeMarker: boolean;
  timeMarker?: string;
  subject?: string;
}

export interface GrammarRule {
  name: string;
  priority: number;
  condition: (words: string[], context: GrammarContext) => boolean;
  transform: (words: string[], context: GrammarContext) => string[];
}

// ─── Conversation History ────────────────────────────────────────────────────

export interface ConversationMessage {
  id: string;
  type: "signed" | "typed";
  rawWords?: string[];
  sentence: string;
  timestamp: number;
  confidence?: number;
}

export interface ConversationSession {
  id: string;
  messages: ConversationMessage[];
  createdAt: number;
  updatedAt: number;
}

// ─── Reverse Mode ────────────────────────────────────────────────────────────

export interface SignAnimationFrame {
  landmarks: Point3D[];
  duration: number; // ms for this frame
}

export interface SignAnimation {
  word: string;
  frames: SignAnimationFrame[];
  totalDuration: number;
}

export interface ReverseTranslation {
  inputSentence: string;
  signGloss: string[];          // ["YOU", "NAME", "WHAT"]
  animations: SignAnimation[];
}

// ─── App State ───────────────────────────────────────────────────────────────

export type AppMode = "translate" | "reverse" | "history" | "settings";
export type ModelStatus = "not_loaded" | "loading" | "ready" | "error";
export type RecordingState = "idle" | "recording" | "processing" | "done";

export interface ModelLoadProgress {
  mediapipe: number;   // 0-100
  lstm: number;        // 0-100
  overall: number;     // 0-100
}

export interface AppSettings {
  theme: "dark" | "light" | "system";
  cameraResolution: "480x360" | "640x480" | "1280x720";
  showSkeletonOverlay: boolean;
  showFaceOverlay: boolean;
  showRawWords: boolean;
  autoSpeak: boolean;             // text-to-speech
  recordingDuration: number;      // seconds, 3-8
  avatarSpeed: number;            // 0.5, 1.0, 1.5
  signLanguage: "ASL" | "BSL" | "ISL";
  showLivePreview: boolean;       // live word hints while signing
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "dark",
  cameraResolution: "640x480",
  showSkeletonOverlay: true,
  showFaceOverlay: true,
  showRawWords: true,
  autoSpeak: false,
  recordingDuration: 5,
  avatarSpeed: 1.0,
  signLanguage: "ASL",
  showLivePreview: true,
};

// ─── Auth / Cloud ────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
}