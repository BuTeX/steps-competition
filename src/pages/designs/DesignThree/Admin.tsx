import { useEffect, useState } from 'react';
import { ArrowLeft, Eye, Image, Loader2, LogOut, Pencil, Plus, Save, Search, Trash2, Upload, Users, X } from 'lucide-react';
import { Link } from 'react-router';
import {
  useAdminAuth,
  useAdminRecords,
  useAdminParticipants,
  type AdminRecord,
  type AdminParticipant,
} from '@/hooks/useAdmin';
import { BrandLogo } from '../shared/BrandLogo';
import { PatternBg } from '../shared/PatternBg';
import './theme.css';

const PAGE_SIZE = 25;

interface AdminProps {
  basePath?: string;
}

export default function Admin({ basePath = '/v3' }: AdminProps) {
  const dashboardPath = basePath;
  const { authenticated, loading: authLoading, logout } = useAdminAuth();
  const { data, loading, error, fetchRecords, deleteRecord, updateRecord, uploadScreenshot, deleteScreenshot } = useAdminRecords();
  const { participants, fetchParticipants, updateParticipant } = useAdminParticipants();
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminRecord | null>(null);
  const [viewUrl, setViewUrl] = useState<string | null>(null);

  // Screenshot management
  const [replaceTarget, setReplaceTarget] = useState<AdminRecord | null>(null);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [screenshotLoading, setScreenshotLoading] = useState(false);

  // Edit record
  const [editRecord, setEditRecord] = useState<AdminRecord | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editSteps, setEditSteps] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [savingRecord, setSavingRecord] = useState(false);

  // Rename participants
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [editedParticipants, setEditedParticipants] = useState<Record<string, { displayName: string; username: string }>>({});
  const [savingParticipants, setSavingParticipants] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (authenticated) {
      fetchRecords({ limit: PAGE_SIZE, offset, search });
      fetchParticipants();
    }
  }, [authenticated, offset, search, fetchRecords, fetchParticipants]);

  useEffect(() => {
    setOffset(0);
  }, [search]);

  useEffect(() => {
    if (editRecord) {
      setEditDate(editRecord.Date);
      setEditSteps(editRecord.Steps);
      setEditNotes(editRecord.Notes || '');
    }
  }, [editRecord]);

  if (authLoading) {
    return (
      <div className="design-three min-h-screen bg-[var(--d3-bg)] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#7856FF]" />
      </div>
    );
  }

  if (!authenticated) {
    return null;
  }

  const showMessage = (text: string, isError = false) => {
    setMessage(isError ? `Ошибка: ${text}` : text);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteRecord({
        timestamp: deleteTarget.Timestamp,
        user_id: Number(deleteTarget.UserID),
        date: deleteTarget.Date,
      });
      showMessage('Запись удалена');
      setDeleteTarget(null);
      fetchRecords({ limit: PAGE_SIZE, offset, search });
    } catch (err: unknown) {
      showMessage(err instanceof Error ? err.message : 'Ошибка удаления', true);
    }
  };

  const handleSaveRecord = async () => {
    if (!editRecord) return;
    setSavingRecord(true);
    try {
      await updateRecord({
        timestamp: editRecord.Timestamp,
        user_id: Number(editRecord.UserID),
        old_date: editRecord.Date,
        new_date: editDate,
        steps: editSteps === '' ? undefined : Number(editSteps),
        notes: editNotes,
      });
      showMessage('Запись обновлена');
      setEditRecord(null);
      fetchRecords({ limit: PAGE_SIZE, offset, search });
    } catch (err: unknown) {
      showMessage(err instanceof Error ? err.message : 'Ошибка обновления', true);
    } finally {
      setSavingRecord(false);
    }
  };

  const handleReplaceScreenshot = async () => {
    if (!replaceTarget || !replaceFile) return;
    setScreenshotLoading(true);
    try {
      await uploadScreenshot(
        replaceTarget.Timestamp,
        Number(replaceTarget.UserID),
        replaceTarget.Date,
        replaceFile,
      );
      showMessage('Скриншот обновлён');
      setReplaceTarget(null);
      setReplaceFile(null);
      fetchRecords({ limit: PAGE_SIZE, offset, search });
    } catch (err: unknown) {
      showMessage(err instanceof Error ? err.message : 'Ошибка замены скриншота', true);
    } finally {
      setScreenshotLoading(false);
    }
  };

  const handleDeleteScreenshot = async (record: AdminRecord) => {
    try {
      await deleteScreenshot(record.Timestamp, Number(record.UserID), record.Date);
      showMessage('Скриншот удалён');
      fetchRecords({ limit: PAGE_SIZE, offset, search });
    } catch (err: unknown) {
      showMessage(err instanceof Error ? err.message : 'Ошибка удаления скриншота', true);
    }
  };

  const handleParticipantChange = (p: AdminParticipant, field: 'displayName' | 'username', value: string) => {
    setEditedParticipants((prev) => ({
      ...prev,
      [p.UserID]: {
        displayName: field === 'displayName' ? value : (prev[p.UserID]?.displayName ?? p.DisplayName),
        username: field === 'username' ? value : (prev[p.UserID]?.username ?? p.Username),
      },
    }));
  };

  const handleSaveParticipant = async (p: AdminParticipant) => {
    const changes = editedParticipants[p.UserID];
    if (!changes) return;
    setSavingParticipants((prev) => new Set(prev).add(p.UserID));
    try {
      await updateParticipant(p.UserID, changes.displayName, changes.username);
      showMessage('Участник обновлён');
      await fetchParticipants();
      await fetchRecords({ limit: PAGE_SIZE, offset, search });
      setEditedParticipants((prev) => {
        const next = { ...prev };
        delete next[p.UserID];
        return next;
      });
    } catch (err: unknown) {
      showMessage(err instanceof Error ? err.message : 'Ошибка обновления', true);
    } finally {
      setSavingParticipants((prev) => {
        const next = new Set(prev);
        next.delete(p.UserID);
        return next;
      });
    }
  };

  return (
    <div className="design-three min-h-screen bg-[var(--d3-bg)] text-[var(--d3-text)]">
      <PatternBg pattern="1" opacity={0.04} />

      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-[var(--d3-border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <BrandLogo className="h-9" />
              <div>
                <h1 className="text-lg font-bold leading-tight">Админ-панель</h1>
                <p className="text-[10px] text-[var(--d3-muted)] uppercase tracking-wider">Управление записями</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to={dashboardPath}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium border border-[var(--d3-border)] hover:bg-[var(--d3-surface)] transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">На дашборд</span>
              </Link>
              <button
                onClick={logout}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium bg-[var(--d3-primary)] text-[var(--d3-primary-text)] hover:opacity-90 transition-opacity"
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

        <div className="rounded-[var(--d3-radius)] bg-white border border-[var(--d3-border)] shadow-[var(--d3-shadow)] overflow-hidden">
          <div className="px-6 py-5 border-b border-[var(--d3-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-lg font-bold">Записи шагов</h2>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--d3-muted)]" />
                <input
                  type="text"
                  placeholder="Поиск..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 rounded-full border border-[var(--d3-border)] bg-[var(--d3-surface)] text-sm outline-none focus:ring-2 focus:ring-[#7856FF]/30"
                />
              </div>
              <button
                onClick={() => setParticipantsOpen(true)}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium border border-[var(--d3-border)] hover:bg-[var(--d3-surface)] transition-colors"
              >
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Участники</span>
              </button>
              <button className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium bg-[var(--d3-primary)] text-[var(--d3-primary-text)] hover:opacity-90 transition-opacity">
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
              <thead className="bg-[var(--d3-surface)]">
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
                    <td colSpan={5} className="text-center py-12 text-[var(--d3-muted)]">Записи не найдены</td>
                  </tr>
                ) : (
                  data?.records.map((record) => (
                    <tr key={`${record.Timestamp}-${record.UserID}-${record.Date}`} className="border-b border-[var(--d3-border)]/50 last:border-0">
                      <td className="px-6 py-3 font-medium">
                        {record.DisplayName || record.Username || 'Unknown'}
                        <div className="text-xs text-[var(--d3-muted)]">ID: {record.UserID}</div>
                      </td>
                      <td className="px-6 py-3">{record.Date}</td>
                      <td className="px-6 py-3 text-right font-bold">{Number(record.Steps).toLocaleString('ru-RU')}</td>
                      <td className="px-6 py-3 text-center">
                        {record.ScreenshotURL ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setViewUrl(record.ScreenshotURL)}
                              className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium bg-[#7856FF]/10 text-[#7856FF] hover:bg-[#7856FF]/20"
                            >
                              <Eye className="h-3 w-3" />
                              Есть
                            </button>
                            <button
                              onClick={() => setReplaceTarget(record)}
                              className="p-1.5 rounded-full hover:bg-[var(--d3-surface)] text-[var(--d3-muted)]"
                              title="Заменить скриншот"
                            >
                              <Upload className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteScreenshot(record)}
                              className="p-1.5 rounded-full hover:bg-red-50 text-red-600"
                              title="Удалить скриншот"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setReplaceTarget(record)}
                            className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium bg-[var(--d3-surface)] text-[var(--d3-muted)] hover:bg-[#7856FF]/10 hover:text-[#7856FF]"
                          >
                            <Image className="h-3 w-3" />
                            Загрузить
                          </button>
                        )}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditRecord(record)}
                            className="p-2 rounded-lg hover:bg-[var(--d3-surface)] text-[var(--d3-muted)]"
                          >
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
            <div className="px-6 py-4 border-t border-[var(--d3-border)] flex items-center justify-between">
              <button
                onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                disabled={offset === 0}
                className="text-sm font-medium text-[var(--d3-primary)] disabled:opacity-40"
              >
                Назад
              </button>
              <span className="text-sm text-[var(--d3-muted)]">
                {offset + 1}–{Math.min(offset + PAGE_SIZE, data.total)} из {data.total}
              </span>
              <button
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
                disabled={offset + PAGE_SIZE >= data.total}
                className="text-sm font-medium text-[var(--d3-primary)] disabled:opacity-40"
              >
                Вперёд
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Edit record modal */}
      {editRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditRecord(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Редактировать запись</h3>
              <button onClick={() => setEditRecord(null)} className="p-1 rounded-lg hover:bg-[var(--d3-surface)]">
                <X className="h-5 w-5 text-[var(--d3-muted)]" />
              </button>
            </div>
            <p className="text-sm text-[var(--d3-muted)] mb-4">
              {editRecord.DisplayName || editRecord.Username || 'Unknown'} • {editRecord.Date}
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Дата</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full rounded-xl border border-[var(--d3-border)] bg-[var(--d3-surface)] px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#7856FF]/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Шаги</label>
                <input
                  type="number"
                  min={0}
                  value={editSteps}
                  onChange={(e) => setEditSteps(e.target.value)}
                  className="w-full rounded-xl border border-[var(--d3-border)] bg-[var(--d3-surface)] px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#7856FF]/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Примечания</label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full rounded-xl border border-[var(--d3-border)] bg-[var(--d3-surface)] px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#7856FF]/30"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditRecord(null)}
                className="px-4 py-2 rounded-xl border border-[var(--d3-border)] text-sm font-medium hover:bg-[var(--d3-surface)]"
              >
                Отмена
              </button>
              <button
                onClick={handleSaveRecord}
                disabled={savingRecord}
                className="px-4 py-2 rounded-xl bg-[var(--d3-primary)] text-[var(--d3-primary-text)] text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
              >
                {savingRecord && <Loader2 className="h-4 w-4 animate-spin" />}
                <Save className="h-4 w-4" />
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Participants rename modal */}
      {participantsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setParticipantsOpen(false)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-[var(--d3-border)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-[#7856FF]/10 text-[#7856FF]">
                  <Users className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold">Участники</h3>
              </div>
              <button onClick={() => setParticipantsOpen(false)} className="p-1 rounded-lg hover:bg-[var(--d3-surface)]">
                <X className="h-5 w-5 text-[var(--d3-muted)]" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--d3-surface)]">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">ID</th>
                    <th className="text-left px-4 py-3 font-semibold">Имя</th>
                    <th className="text-left px-4 py-3 font-semibold">Username</th>
                    <th className="text-right px-4 py-3 font-semibold"></th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map((p) => {
                    const draft = editedParticipants[p.UserID] || { displayName: p.DisplayName, username: p.Username };
                    const changed = draft.displayName !== p.DisplayName || draft.username !== p.Username;
                    return (
                      <tr key={p.UserID} className="border-b border-[var(--d3-border)]/50 last:border-0">
                        <td className="px-4 py-3 text-[var(--d3-muted)]">{p.UserID}</td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={draft.displayName}
                            onChange={(e) => handleParticipantChange(p, 'displayName', e.target.value)}
                            className="w-full rounded-lg border border-[var(--d3-border)] bg-[var(--d3-surface)] px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#7856FF]/30"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={draft.username}
                            onChange={(e) => handleParticipantChange(p, 'username', e.target.value)}
                            className="w-full rounded-lg border border-[var(--d3-border)] bg-[var(--d3-surface)] px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#7856FF]/30"
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleSaveParticipant(p)}
                            disabled={!changed || savingParticipants.has(p.UserID)}
                            className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium bg-[var(--d3-primary)] text-[var(--d3-primary-text)] hover:opacity-90 disabled:opacity-40"
                          >
                            {savingParticipants.has(p.UserID) ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                            Сохранить
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {replaceTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => { setReplaceTarget(null); setReplaceFile(null); }}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-2">Заменить скриншот</h3>
            <p className="text-sm text-[var(--d3-muted)] mb-4">
              {replaceTarget.DisplayName || replaceTarget.Username || 'Unknown'} • {replaceTarget.Date}
            </p>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setReplaceFile(e.target.files?.[0] || null)}
              className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-[#7856FF]/10 file:text-[#7856FF] hover:file:bg-[#7856FF]/20"
            />
            {replaceFile && (
              <p className="text-xs text-[var(--d3-muted)] mt-2">Выбран: {replaceFile.name}</p>
            )}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setReplaceTarget(null); setReplaceFile(null); }}
                className="px-4 py-2 rounded-xl border border-[var(--d3-border)] text-sm font-medium hover:bg-[var(--d3-surface)]"
              >
                Отмена
              </button>
              <button
                onClick={handleReplaceScreenshot}
                disabled={!replaceFile || screenshotLoading}
                className="px-4 py-2 rounded-xl bg-[var(--d3-primary)] text-[var(--d3-primary-text)] text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
              >
                {screenshotLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                <Upload className="h-4 w-4" />
                Заменить
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-2">Удалить запись?</h3>
            <p className="text-sm text-[var(--d3-muted)] mb-6">
              {deleteTarget.DisplayName || deleteTarget.Username} — {deleteTarget.Date}, {Number(deleteTarget.Steps).toLocaleString()} шагов
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl border border-[var(--d3-border)] text-sm font-medium hover:bg-[var(--d3-surface)]"
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
