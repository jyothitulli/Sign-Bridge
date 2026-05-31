import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthUser, ConversationSession } from "@/types";
import { api } from "@/services/api/client";

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  syncStatus: "idle" | "syncing" | "success" | "error";
  syncMessage: string | null;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => void;
  syncToCloud: (sessions: ConversationSession[]) => Promise<void>;
  pullFromCloud: () => Promise<ConversationSession[]>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      syncStatus: "idle",
      syncMessage: null,

      login: async (email, password) => {
        const { token, user } = await api.login(email, password);
        set({ token, user: { id: user.id, email: user.email, displayName: user.displayName } });
      },

      register: async (email, password, displayName) => {
        const { token, user } = await api.register(email, password, displayName);
        set({ token, user: { id: user.id, email: user.email, displayName: user.displayName } });
      },

      logout: () => set({ user: null, token: null, syncStatus: "idle", syncMessage: null }),

      syncToCloud: async (sessions) => {
        const { token } = get();
        if (!token) throw new Error("Not logged in");
        set({ syncStatus: "syncing", syncMessage: null });
        try {
          const payload = sessions.map((s) => ({
            id: s.id,
            messages: s.messages,
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
          }));
          const res = await api.syncPush(token, payload);
          set({
            syncStatus: "success",
            syncMessage: `Synced ${res.upserted} conversation(s)`,
          });
        } catch (err) {
          set({
            syncStatus: "error",
            syncMessage: err instanceof Error ? err.message : "Sync failed",
          });
          throw err;
        }
      },

      pullFromCloud: async () => {
        const { token } = get();
        if (!token) throw new Error("Not logged in");
        set({ syncStatus: "syncing", syncMessage: null });
        try {
          const res = await api.syncPull(token);
          const sessions = res.sessions.map((s) => ({
            id: s.id,
            messages: s.messages as ConversationSession["messages"],
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
          }));
          set({ syncStatus: "success", syncMessage: `Downloaded ${sessions.length} conversation(s)` });
          return sessions;
        } catch (err) {
          set({
            syncStatus: "error",
            syncMessage: err instanceof Error ? err.message : "Pull failed",
          });
          throw err;
        }
      },
    }),
    {
      name: "signbridge-auth",
      partialize: (s) => ({ user: s.user, token: s.token }),
    }
  )
);
