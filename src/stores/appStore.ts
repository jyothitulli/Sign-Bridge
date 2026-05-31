// src/stores/appStore.ts
// Global state management using Zustand

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AppSettings,
  ConversationMessage,
  ConversationSession,
  ModelLoadProgress,
  ModelStatus,
  RecordingState,
  TranslationResult,
} from "@/types";
import { DEFAULT_SETTINGS as DEFAULTS } from "@/types";

// ─── Translation Slice ────────────────────────────────────────────────────────

interface TranslationState {
  recordingState: RecordingState;
  currentTranslation: TranslationResult | null;
  recentTranslations: TranslationResult[];
  mediapipeStatus: ModelStatus;
  lstmStatus: ModelStatus;
  modelProgress: ModelLoadProgress;

  setRecordingState: (state: RecordingState) => void;
  setCurrentTranslation: (result: TranslationResult) => void;
  addTranslation: (result: TranslationResult) => void;
  setMediapipeStatus: (status: ModelStatus) => void;
  setLstmStatus: (status: ModelStatus) => void;
  setModelProgress: (progress: Partial<ModelLoadProgress>) => void;
  clearTranslations: () => void;
}

// ─── Conversation Slice ───────────────────────────────────────────────────────

interface ConversationState {
  sessions: ConversationSession[];
  activeSession: ConversationSession | null;

  startNewSession: () => void;
  addMessage: (message: ConversationMessage) => void;
  deleteSession: (id: string) => void;
  clearAllSessions: () => void;
}

// ─── Settings Slice ───────────────────────────────────────────────────────────

interface SettingsState {
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => void;
  resetSettings: () => void;
}

// ─── Combined Store ───────────────────────────────────────────────────────────

type AppStore = TranslationState & ConversationState & SettingsState;

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      // ── Translation ──
      recordingState: "idle",
      currentTranslation: null,
      recentTranslations: [],
      mediapipeStatus: "not_loaded",
      lstmStatus: "not_loaded",
      modelProgress: { mediapipe: 0, lstm: 0, overall: 0 },

      setRecordingState: (state) => set({ recordingState: state }),

      setCurrentTranslation: (result) => set({ currentTranslation: result }),

      addTranslation: (result) =>
        set((s) => ({
          recentTranslations: [result, ...s.recentTranslations].slice(0, 50),
        })),

      setMediapipeStatus: (status) => set({ mediapipeStatus: status }),

      setLstmStatus: (status) => set({ lstmStatus: status }),

      setModelProgress: (progress) =>
        set((s) => {
          const next = { ...s.modelProgress, ...progress };
          next.overall = Math.round((next.mediapipe + next.lstm) / 2);
          return { modelProgress: next };
        }),

      clearTranslations: () =>
        set({ recentTranslations: [], currentTranslation: null }),

      // ── Conversation ──
      sessions: [],
      activeSession: null,

      startNewSession: () => {
        const session: ConversationSession = {
          id: crypto.randomUUID(),
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((s) => ({
          sessions: [session, ...s.sessions],
          activeSession: session,
        }));
      },

      addMessage: (message) =>
        set((s) => {
          if (!s.activeSession) return s;
          const updated: ConversationSession = {
            ...s.activeSession,
            messages: [...s.activeSession.messages, message],
            updatedAt: Date.now(),
          };
          return {
            activeSession: updated,
            sessions: s.sessions.map((sess) =>
              sess.id === updated.id ? updated : sess
            ),
          };
        }),

      deleteSession: (id) =>
        set((s) => ({
          sessions: s.sessions.filter((sess) => sess.id !== id),
          activeSession:
            s.activeSession?.id === id ? null : s.activeSession,
        })),

      clearAllSessions: () => set({ sessions: [], activeSession: null }),

      // ── Settings ──
      settings: DEFAULTS,

      updateSettings: (partial) =>
        set((s) => ({ settings: { ...s.settings, ...partial } })),

      resetSettings: () => set({ settings: DEFAULTS }),
    }),
    {
      name: "signbridge-store",
      // Only persist settings and conversation history, not live translation state
      partialize: (state) => ({
        settings: state.settings,
        sessions: state.sessions,
      }),
    }
  )
);