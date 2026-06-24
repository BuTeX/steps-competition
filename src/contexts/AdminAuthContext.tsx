import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

const API_BASE = '';

async function apiFetch(input: string, init?: RequestInit, csrfToken?: string | null) {
  const headers: Record<string, string> = {};
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }
  const body = init?.body;
  if (body && typeof body === 'string') {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${input}`, {
    credentials: 'include',
    ...init,
    headers: {
      ...headers,
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => 'Ошибка запроса');
    throw new Error(text);
  }
  if (res.status === 204) return null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json();
  }
  return res.blob();
}

interface AdminAuthContextValue {
  authenticated: boolean | null;
  loading: boolean;
  error: string | null;
  csrfToken: string | null;
  login: (password: string) => Promise<void>;
  logout: () => Promise<void>;
  check: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  const check = useCallback(async () => {
    setLoading(true);
    try {
      await apiFetch('/api/admin/me', undefined, csrfToken);
      setAuthenticated(true);
    } catch {
      setAuthenticated(false);
      setCsrfToken(null);
    } finally {
      setLoading(false);
    }
  }, [csrfToken]);

  useEffect(() => {
    check();
  }, [check]);

  const login = useCallback(async (password: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = (await apiFetch('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
      })) as { success: boolean; csrf_token?: string };
      setAuthenticated(true);
      if (res.csrf_token) {
        setCsrfToken(res.csrf_token);
      }
    } catch (err: unknown) {
      setAuthenticated(false);
      setCsrfToken(null);
      setError(err instanceof Error ? err.message : 'Ошибка входа');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await apiFetch('/api/admin/logout', { method: 'POST' }, csrfToken);
    setAuthenticated(false);
    setCsrfToken(null);
  }, [csrfToken]);

  return (
    <AdminAuthContext.Provider value={{ authenticated, loading, error, csrfToken, login, logout, check }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) {
    throw new Error('useAdminAuth must be used within AdminAuthProvider');
  }
  return ctx;
}
