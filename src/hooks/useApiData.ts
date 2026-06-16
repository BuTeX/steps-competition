import { useState, useEffect, useCallback } from 'react';

export interface StepRecord {
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

export interface UserStat {
  name: string;
  user_id: string;
  total_steps: number;
  days: number;
  avg_steps: number;
  max_steps: number;
}

export interface DailyStat {
  date: string;
  total_steps: number;
  participants: number;
}

export interface DailyMatrixEntry {
  date: string;
  steps: number;
  screenshot_url: string;
}

export interface DailyMatrixUser {
  user_id: number;
  name: string;
  dates: DailyMatrixEntry[];
}

export interface GlobalStats {
  total_steps: number;
  total_participants: number;
  total_records: number;
  active_days: number;
  avg_steps_per_day: number;
}

interface UseApiDataReturn {
  records: StepRecord[];
  users: UserStat[];
  daily: DailyStat[];
  matrix: DailyMatrixUser[];
  stats: GlobalStats | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// API URL: если дашборд на том же домене — используем относительный путь
function getApiUrl(): string {
  // Для Railway: дашборд и API на одном домене
  return '';
}

export function useApiData(): UseApiDataReturn {
  const [records, setRecords] = useState<StepRecord[]>([]);
  const [users, setUsers] = useState<UserStat[]>([]);
  const [daily, setDaily] = useState<DailyStat[]>([]);
  const [matrix, setMatrix] = useState<DailyMatrixUser[]>([]);
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const base = getApiUrl();

      const [statsRes, boardRes, dailyRes, recordsRes, matrixRes] = await Promise.all([
        fetch(`${base}/api/stats`),
        fetch(`${base}/api/leaderboard`),
        fetch(`${base}/api/daily`),
        fetch(`${base}/api/records?limit=100`),
        fetch(`${base}/api/daily-matrix`),
      ]);

      if (!statsRes.ok) throw new Error(`API ошибка: ${statsRes.status}`);

      const [statsData, boardData, dailyData, recordsData, matrixData] = await Promise.all([
        statsRes.json(),
        boardRes.json(),
        dailyRes.json(),
        recordsRes.json(),
        matrixRes.json(),
      ]);

      setStats(statsData);
      setUsers(boardData);
      setDaily(dailyData);
      setRecords(recordsData);
      setMatrix(matrixData);
    } catch (err: any) {
      setError(err.message || 'Ошибка подключения к API');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  return {
    records,
    users,
    daily,
    matrix,
    stats,
    loading,
    error,
    refetch: fetchAll,
  };
}
