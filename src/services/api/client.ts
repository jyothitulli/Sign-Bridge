const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

type RequestOptions = RequestInit & {
  token?: string | null;
  skipRefresh?: boolean;
};

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return null;
      return (data as { token?: string }).token ?? null;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
  onTokenRefreshed?: (token: string) => void
): Promise<T> {
  const { token, skipRefresh, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(fetchOptions.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    ...fetchOptions,
    headers,
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && token && !skipRefresh && !path.includes("/auth/refresh")) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      onTokenRefreshed?.(newToken);
      return request<T>(path, { ...options, token: newToken, skipRefresh: true }, onTokenRefreshed);
    }
  }

  if (!res.ok) {
    throw new ApiError((data as { error?: string }).error ?? res.statusText, res.status);
  }
  return data as T;
}

function withAuth(onTokenRefreshed?: (token: string) => void) {
  return <T>(path: string, options: RequestOptions = {}) => {
    const { token, ...rest } = options;
    return request<T>(path, { ...rest, token }, onTokenRefreshed);
  };
}

export function createApiClient(getToken: () => string | null, setToken: (t: string) => void) {
  const authed = withAuth(setToken);

  return {
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

    refresh: () => refreshAccessToken(),

    logout: (token: string) =>
      authed<{ ok: boolean }>("/api/auth/logout", { method: "POST", token }),

    me: (token: string) =>
      authed<{ user: { id: string; email: string; displayName: string; avatarUrl?: string } }>(
        "/api/auth/me",
        { token }
      ),

    updateProfile: (token: string, body: { displayName?: string; avatarUrl?: string }) =>
      authed<{ user: { id: string; email: string; displayName: string; avatarUrl?: string } }>(
        "/api/users/me",
        { method: "PATCH", body: JSON.stringify(body), token }
      ),

    forgotPassword: (email: string) =>
      request<{ ok: boolean; message: string }>("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      }),

    resetPassword: (token: string, password: string) =>
      request<{ ok: boolean }>("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      }),

    syncPush: (
      token: string,
      sessions: { id: string; messages: unknown[]; createdAt: number; updatedAt: number }[]
    ) =>
      authed<{ ok: boolean; upserted: number }>("/api/sync/push", {
        method: "POST",
        body: JSON.stringify({ sessions }),
        token,
      }),

    syncPull: (token: string) =>
      authed<{
        sessions: { id: string; messages: unknown[]; createdAt: number; updatedAt: number }[];
      }>("/api/sync/pull", { token }),

    historyList: (token: string, limit = 50) =>
      authed<{ sessions: { id: string; messages: unknown[]; createdAt: number; updatedAt: number }[] }>(
        `/api/history?limit=${limit}`,
        { token }
      ),

    historyAppend: (
      token: string,
      sessionId: string,
      message: {
        id: string;
        type: string;
        sentence: string;
        rawWords?: string[];
        timestamp: number;
        confidence?: number;
      }
    ) =>
      authed<{ ok: boolean }>("/api/history/message", {
        method: "POST",
        body: JSON.stringify({ sessionId, message }),
        token,
      }),
  };
}

export function getApiBaseUrl(): string {
  return API_BASE;
}
