import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

const API_BASE = '';

async function apiFetch(input: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE}${input}`, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
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
  login: (password: string) => Promise<void>;
  logout: () => Promise<void>;
  check: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async () => {
    setLoading(true);
    try {
      await apiFetch('/api/admin/me');
      setAuthenticated(true);
    } catch {
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  const login = useCallback(async (password: string) => {
    setLoading(true);
    setError(null);
    try {
      await apiFetch('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      setAuthenticated(true);
    } catch (err: unknown) {
      setAuthenticated(false);
      setError(err instanceof Error ? err.message : 'Ошибка входа');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await apiFetch('/api/admin/logout', { method: 'POST' });
    setAuthenticated(false);
  }, []);

  return (
    <AdminAuthContext.Provider value={{ authenticated, loading, error, login, logout, check }}>
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
