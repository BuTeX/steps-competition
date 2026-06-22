import { useCallback, useEffect, useState } from 'react';

const API_BASE = '';

export interface AdminRecord {
  Timestamp: string;
  Username: string;
  UserID: string;
  DisplayName: string;
  Date: string;
  Steps: string;
  ScreenshotURL: string;
  Verified: string;
  Notes: string;
}

export interface RecordsResponse {
  records: AdminRecord[];
  total: number;
  limit: number;
  offset: number;
}

export interface BackupInfo {
  backup_id: string;
  key: string;
  url: string;
  created_at: string;
  size: number;
}

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

export function useAdminAuth() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async () => {
    try {
      await apiFetch('/api/admin/me');
      setAuthenticated(true);
    } catch {
      setAuthenticated(false);
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
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await apiFetch('/api/admin/logout', { method: 'POST' });
    setAuthenticated(false);
  }, []);

  return { authenticated, loading, error, login, logout, check };
}

export function useAdminRecords() {
  const [data, setData] = useState<RecordsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecords = useCallback(async (params?: {
    limit?: number;
    offset?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (params?.limit) query.set('limit', String(params.limit));
      if (params?.offset !== undefined) query.set('offset', String(params.offset));
      if (params?.search) query.set('search', params.search);
      if (params?.sortBy) query.set('sort_by', params.sortBy);
      if (params?.sortOrder) query.set('sort_order', params.sortOrder);
      const res = await apiFetch(`/api/admin/records?${query.toString()}`);
      setData(res as RecordsResponse);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки записей');
    } finally {
      setLoading(false);
    }
  }, []);

  const updateRecord = useCallback(async (payload: {
    timestamp: string;
    user_id: number;
    old_date: string;
    new_date?: string;
    steps?: number;
    notes?: string;
  }) => {
    const res = await apiFetch('/api/admin/records', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return res;
  }, []);

  const deleteRecord = useCallback(async (payload: {
    timestamp: string;
    user_id: number;
    date: string;
  }) => {
    await apiFetch('/api/admin/records', {
      method: 'DELETE',
      body: JSON.stringify(payload),
    });
  }, []);

  return { data, loading, error, fetchRecords, updateRecord, deleteRecord };
}

export function useAdminBackups() {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBackups = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/admin/backups');
      setBackups(res as BackupInfo[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки бекапов');
    } finally {
      setLoading(false);
    }
  }, []);

  const createBackup = useCallback(async () => {
    const res = await apiFetch('/api/admin/backup', { method: 'POST' });
    return res as BackupInfo;
  }, []);

  const downloadBackup = useCallback((backupId: string) => {
    window.location.href = `${API_BASE}/api/admin/backup/download/${backupId}`;
  }, []);

  return { backups, loading, error, fetchBackups, createBackup, downloadBackup };
}
