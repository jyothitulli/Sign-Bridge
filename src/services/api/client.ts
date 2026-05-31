const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(data.error ?? res.statusText, res.status);
  }
  return data as T;
}

export const api = {
  health: () => request<{ ok: boolean }>("/health"),

  register: (email: string, password: string, displayName?: string) =>
    request<{ token: string; user: { id: string; email: string; displayName: string } }>(
      "/api/auth/register",
      { method: "POST", body: JSON.stringify({ email, password, displayName }) }
    ),

  login: (email: string, password: string) =>
    request<{ token: string; user: { id: string; email: string; displayName: string } }>(
      "/api/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) }
    ),

  me: (token: string) =>
    request<{ user: { id: string; email: string; displayName: string } }>(
      "/api/auth/me",
      {},
      token
    ),

  syncPush: (
    token: string,
    sessions: { id: string; messages: unknown[]; createdAt: number; updatedAt: number }[]
  ) =>
    request<{ ok: boolean; upserted: number }>(
      "/api/sync/push",
      { method: "POST", body: JSON.stringify({ sessions }) },
      token
    ),

  syncPull: (token: string) =>
    request<{
      sessions: { id: string; messages: unknown[]; createdAt: number; updatedAt: number }[];
    }>("/api/sync/pull", {}, token),
};

export function getApiBaseUrl(): string {
  return API_BASE;
}
