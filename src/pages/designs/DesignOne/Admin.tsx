import { useEffect, useState } from 'react';
import { ArrowLeft, Eye, Loader2, LogOut, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Link } from 'react-router';
import {
  useAdminAuth,
  useAdminRecords,
  type AdminRecord,
} from '@/hooks/useAdmin';
import { BrandLogo } from '../shared/BrandLogo';
import { PatternBg } from '../shared/PatternBg';
import './theme.css';

const PAGE_SIZE = 25;

export default function Admin() {
  const { authenticated, loading: authLoading, logout } = useAdminAuth();
  const { data, loading, error, fetchRecords, deleteRecord } = useAdminRecords();
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminRecord | null>(null);
  const [viewUrl, setViewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (authenticated) fetchRecords({ limit: PAGE_SIZE, offset, search });
  }, [authenticated, offset, search, fetchRecords]);

  useEffect(() => {
    setOffset(0);
  }, [search]);

  if (authLoading) {
    return (
      <div className="design-one min-h-screen bg-[var(--d1-bg)] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#7856FF]" />
      </div>
    );
  }

  if (!authenticated) {
    return null;
  }

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteRecord({
        timestamp: deleteTarget.Timestamp,
        user_id: Number(deleteTarget.UserID),
        date: deleteTarget.Date,
      });
      setMessage('Запись удалена');
      setDeleteTarget(null);
      fetchRecords({ limit: PAGE_SIZE, offset, search });
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Ошибка удаления');
    }
    setTimeout(() => setMessage(null), 3000);
  };

  return (
    <div className="design-one min-h-screen bg-[var(--d1-bg)] text-[var(--d1-text)]">
      <PatternBg pattern="1" opacity={0.04} />

      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-[var(--d1-border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <BrandLogo className="h-9" />
              <div>
                <h1 className="text-lg font-bold leading-tight">Админ-панель</h1>
                <p className="text-[10px] text-[var(--d1-muted)] uppercase tracking-wider">Управление записями</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/v1"
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium border border-[var(--d1-border)] hover:bg-[var(--d1-surface)] transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">На дашборд</span>
              </Link>
              <button
                onClick={logout}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium bg-[var(--d1-primary)] text-[var(--d1-primary-text)] hover:opacity-90 transition-opacity"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Выйти</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {message && (
          <div className={`rounded-2xl p-4 text-sm ${message.includes('Ошибка') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
            {message}
          </div>
        )}

        <div className="rounded-[var(--d1-radius)] bg-white border border-[var(--d1-border)] shadow-[var(--d1-shadow)] overflow-hidden">
          <div className="px-6 py-5 border-b border-[var(--d1-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-lg font-bold">Записи шагов</h2>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--d1-muted)]" />
                <input
                  type="text"
                  placeholder="Поиск..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 rounded-full border border-[var(--d1-border)] bg-[var(--d1-surface)] text-sm outline-none focus:ring-2 focus:ring-[#7856FF]/30"
                />
              </div>
              <button className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium bg-[var(--d1-primary)] text-[var(--d1-primary-text)] hover:opacity-90 transition-opacity">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Добавить</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="px-6 py-4 text-sm text-red-700 bg-red-50">{error}</div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--d1-surface)]">
                <tr>
                  <th className="text-left px-6 py-3 font-semibold">Участник</th>
                  <th className="text-left px-6 py-3 font-semibold">Дата</th>
                  <th className="text-right px-6 py-3 font-semibold">Шаги</th>
                  <th className="text-center px-6 py-3 font-semibold">Скрин</th>
                  <th className="text-right px-6 py-3 font-semibold">Действия</th>
                </tr>
              </thead>
              <tbody>
                {loading && !data ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-[#7856FF]" />
                    </td>
                  </tr>
                ) : data?.records.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-[var(--d1-muted)]">Записи не найдены</td>
                  </tr>
                ) : (
                  data?.records.map((record) => (
                    <tr key={`${record.Timestamp}-${record.UserID}-${record.Date}`} className="border-b border-[var(--d1-border)]/50 last:border-0">
                      <td className="px-6 py-3 font-medium">
                        {record.DisplayName || record.Username || 'Unknown'}
                        <div className="text-xs text-[var(--d1-muted)]">ID: {record.UserID}</div>
                      </td>
                      <td className="px-6 py-3">{record.Date}</td>
                      <td className="px-6 py-3 text-right font-bold">{Number(record.Steps).toLocaleString('ru-RU')}</td>
                      <td className="px-6 py-3 text-center">
                        {record.ScreenshotURL ? (
                          <button
                            onClick={() => setViewUrl(record.ScreenshotURL)}
                            className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium bg-[#7856FF]/10 text-[#7856FF] hover:bg-[#7856FF]/20"
                          >
                            <Eye className="h-3 w-3" />
                            Есть
                          </button>
                        ) : (
                          <span className="text-[var(--d1-muted)]">—</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button className="p-2 rounded-lg hover:bg-[var(--d1-surface)] text-[var(--d1-muted)]">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(record)}
                            className="p-2 rounded-lg hover:bg-red-50 text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {data && data.total > PAGE_SIZE && (
            <div className="px-6 py-4 border-t border-[var(--d1-border)] flex items-center justify-between">
              <button
                onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                disabled={offset === 0}
                className="text-sm font-medium text-[var(--d1-primary)] disabled:opacity-40"
              >
                Назад
              </button>
              <span className="text-sm text-[var(--d1-muted)]">
                {offset + 1}–{Math.min(offset + PAGE_SIZE, data.total)} из {data.total}
              </span>
              <button
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
                disabled={offset + PAGE_SIZE >= data.total}
                className="text-sm font-medium text-[var(--d1-primary)] disabled:opacity-40"
              >
                Вперёд
              </button>
            </div>
          )}
        </div>
      </main>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-2">Удалить запись?</h3>
            <p className="text-sm text-[var(--d1-muted)] mb-6">
              {deleteTarget.DisplayName || deleteTarget.Username} — {deleteTarget.Date}, {Number(deleteTarget.Steps).toLocaleString()} шагов
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl border border-[var(--d1-border)] text-sm font-medium hover:bg-[var(--d1-surface)]"
              >
                Отмена
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {viewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setViewUrl(null)}>
          <div className="max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            <img
              src={`/api/admin/screenshots/view?url=${encodeURIComponent(viewUrl)}`}
              alt="Скриншот"
              className="w-full rounded-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
