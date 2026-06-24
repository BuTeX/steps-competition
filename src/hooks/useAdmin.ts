import { useCallback, useState } from 'react';
import { useAdminAuth as useAdminAuthContext } from '@/contexts/AdminAuthContext';

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

async function multipartFetch(
  input: string,
  formData: FormData,
  init?: RequestInit,
  csrfToken?: string | null
) {
  const headers: Record<string, string> = {};
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  const res = await fetch(`${API_BASE}${input}`, {
    credentials: 'include',
    ...init,
    body: formData,
    headers: {
      ...headers,
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => 'Ошибка запроса');
    throw new Error(text);
  }
  return res.json();
}

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

export interface AdminParticipant {
  UserID: string;
  Username: string;
  DisplayName: string;
  JoinedAt: string;
  Active: string;
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

export interface ReminderResult {
  sent: number;
  failed: number;
}

export function useAdminAuth() {
  return useAdminAuthContext();
}

export function useAdminParticipants() {
  const { csrfToken } = useAdminAuthContext();
  const [participants, setParticipants] = useState<AdminParticipant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchParticipants = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/admin/participants', undefined, csrfToken);
      setParticipants((res as AdminParticipant[]) || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки участников');
    } finally {
      setLoading(false);
    }
  }, [csrfToken]);

  const updateParticipant = useCallback(async (userId: string, displayName: string, username: string = '') => {
    const res = await apiFetch(
      `/api/admin/participants/${userId}`,
      {
        method: 'PUT',
        body: JSON.stringify({ display_name: displayName, username }),
      },
      csrfToken
    );
    return res as { success: boolean };
  }, [csrfToken]);

  return { participants, loading, error, fetchParticipants, updateParticipant };
}

export function useAdminRecords() {
  const { csrfToken } = useAdminAuthContext();
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
      const res = await apiFetch(`/api/admin/records?${query.toString()}`, undefined, csrfToken);
      setData(res as RecordsResponse);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки записей');
    } finally {
      setLoading(false);
    }
  }, [csrfToken]);

  const createRecord = useCallback(async (payload: {
    user_id: number;
    display_name: string;
    username?: string;
    date: string;
    steps: number;
    notes?: string;
  }) => {
    const res = await apiFetch('/api/admin/records', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, csrfToken);
    return res as { success: boolean; record: AdminRecord };
  }, [csrfToken]);

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
    }, csrfToken);
    return res as { success: boolean; record: AdminRecord };
  }, [csrfToken]);

  const uploadScreenshot = useCallback(async (
    timestamp: string,
    user_id: number,
    date: string,
    file: File
  ) => {
    const formData = new FormData();
    formData.append('screenshot', file);
    const res = await multipartFetch(
      `/api/admin/records/${encodeURIComponent(timestamp)}/screenshot?user_id=${user_id}&date=${encodeURIComponent(date)}`,
      formData,
      { method: 'PUT' },
      csrfToken
    );
    return res as { success: boolean; record: AdminRecord };
  }, [csrfToken]);

  const deleteScreenshot = useCallback(async (
    timestamp: string,
    user_id: number,
    date: string
  ) => {
    const res = await apiFetch(
      `/api/admin/records/${encodeURIComponent(timestamp)}/screenshot?user_id=${user_id}&date=${encodeURIComponent(date)}`,
      { method: 'DELETE' },
      csrfToken
    );
    return res as { success: boolean; record: AdminRecord };
  }, [csrfToken]);

  const deleteRecord = useCallback(async (payload: {
    timestamp: string;
    user_id: number;
    date: string;
  }) => {
    await apiFetch('/api/admin/records', {
      method: 'DELETE',
      body: JSON.stringify(payload),
    }, csrfToken);
  }, [csrfToken]);

  return {
    data,
    loading,
    error,
    fetchRecords,
    createRecord,
    updateRecord,
    uploadScreenshot,
    deleteScreenshot,
    deleteRecord,
  };
}

export function useAdminBackups() {
  const { csrfToken } = useAdminAuthContext();
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBackups = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/admin/backups', undefined, csrfToken);
      setBackups(res as BackupInfo[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки бекапов');
    } finally {
      setLoading(false);
    }
  }, [csrfToken]);

  const createBackup = useCallback(async () => {
    const res = await apiFetch('/api/admin/backup', { method: 'POST' }, csrfToken);
    return res as BackupInfo;
  }, [csrfToken]);

  const downloadBackup = useCallback((backupId: string) => {
    const headers: Record<string, string> = {};
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }
    fetch(`${API_BASE}/api/admin/backup/download/${backupId}`, {
      credentials: 'include',
      headers,
    })
      .then((res) => {
        if (!res.ok) throw new Error('Ошибка скачивания бекапа');
        return res.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = backupId;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      })
      .catch((err) => {
        console.error(err);
        alert(err instanceof Error ? err.message : 'Ошибка скачивания');
      });
  }, [csrfToken]);

  return { backups, loading, error, fetchBackups, createBackup, downloadBackup };
}

export function useAdminReminders() {
  const { csrfToken } = useAdminAuthContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendReminder = useCallback(async (message: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/admin/send-reminder', {
        method: 'POST',
        body: JSON.stringify({ message }),
      }, csrfToken);
      return res as ReminderResult;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ошибка отправки напоминания';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, [csrfToken]);

  return { loading, error, sendReminder };
}
