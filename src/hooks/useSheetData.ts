import { useState, useEffect, useCallback } from 'react';

export interface StepRecord {
  Timestamp: string;
  Username: string;
  'User ID': string;
  'Display Name': string;
  Date: string;
  Steps: string;
  Screenshot: string;
  Verified: string;
  Notes: string;
}

export interface UserStats {
  name: string;
  totalSteps: number;
  days: number;
  avgSteps: number;
  maxSteps: number;
  records: StepRecord[];
}

export interface DailyStats {
  date: string;
  totalSteps: number;
  participants: number;
}

interface UseSheetDataReturn {
  records: StepRecord[];
  userStats: UserStats[];
  dailyStats: DailyStats[];
  totalSteps: number;
  totalParticipants: number;
  avgStepsPerDay: number;
  activeDays: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  sheetUrl: string;
}

// Default sheet ID - will be overridden by env or input
const DEFAULT_SHEET_ID = '';

function getSheetUrl(sheetId: string): string {
  if (!sheetId) return '';
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=0`;
}

function parseCSV(csvText: string): StepRecord[] {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const records: StepRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < 6) continue;

    const record: any = {};
    headers.forEach((header, idx) => {
      record[header] = values[idx] || '';
    });

    records.push(record as StepRecord);
  }

  return records;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());

  return result;
}

function aggregateUserStats(records: StepRecord[]): UserStats[] {
  const userMap = new Map<string, UserStats>();

  for (const record of records) {
    const name = record['Display Name'] || record.Username || 'Unknown';
    const steps = parseInt(record.Steps, 10) || 0;
    
    if (!userMap.has(name)) {
      userMap.set(name, {
        name,
        totalSteps: 0,
        days: 0,
        avgSteps: 0,
        maxSteps: 0,
        records: [],
      });
    }

    const stats = userMap.get(name)!;
    stats.totalSteps += steps;
    stats.days += 1;
    stats.maxSteps = Math.max(stats.maxSteps, steps);
    stats.records.push(record);
  }

  for (const stats of userMap.values()) {
    stats.avgSteps = stats.days > 0 ? Math.round(stats.totalSteps / stats.days) : 0;
  }

  return Array.from(userMap.values()).sort((a, b) => b.totalSteps - a.totalSteps);
}

function aggregateDailyStats(records: StepRecord[]): DailyStats[] {
  const dateMap = new Map<string, DailyStats>();

  for (const record of records) {
    const date = record.Date;
    const steps = parseInt(record.Steps, 10) || 0;
    
    if (!dateMap.has(date)) {
      dateMap.set(date, { date, totalSteps: 0, participants: 0 });
    }

    const stats = dateMap.get(date)!;
    stats.totalSteps += steps;
    stats.participants += 1;
  }

  return Array.from(dateMap.values())
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function useSheetData(sheetId: string = DEFAULT_SHEET_ID): UseSheetDataReturn {
  const [records, setRecords] = useState<StepRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!sheetId) {
      setError('Введите ID Google Sheet');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const url = getSheetUrl(sheetId);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Не удалось загрузить данные. Проверьте ID таблицы и права доступа.');
      }

      const csvText = await response.text();
      const parsedRecords = parseCSV(csvText);
      
      setRecords(parsedRecords);
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  }, [sheetId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const userStats = aggregateUserStats(records);
  const dailyStats = aggregateDailyStats(records);
  
  const totalSteps = records.reduce((sum, r) => sum + (parseInt(r.Steps, 10) || 0), 0);
  const totalParticipants = userStats.length;
  const activeDays = dailyStats.length;
  const avgStepsPerDay = activeDays > 0 ? Math.round(totalSteps / activeDays) : 0;

  return {
    records,
    userStats,
    dailyStats,
    totalSteps,
    totalParticipants,
    avgStepsPerDay,
    activeDays,
    loading,
    error,
    refetch: fetchData,
    sheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId}`,
  };
}
