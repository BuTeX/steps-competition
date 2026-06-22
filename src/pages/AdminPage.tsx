import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  ArrowLeft,
  Download,
  FileArchive,
  Loader2,
  LogOut,
  Package,
  Pencil,
  Save,
  Search,
  Shield,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminAuth, useAdminBackups, useAdminRecords, type AdminRecord } from '@/hooks/useAdmin';

const PAGE_SIZE = 25;

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

function formatDate(iso: string) {
  try {
    return format(new Date(iso), 'dd.MM.yyyy HH:mm', { locale: ru });
  } catch {
    return iso;
  }
}

// ─── Login Form ─────────────────────────────────────────────────────
function LoginForm({ onLogin, loading, error }: {
  onLogin: (password: string) => void;
  loading: boolean;
  error: string | null;
}) {
  const [password, setPassword] = useState('');

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <Shield className="h-6 w-6" />
            <span className="font-semibold">Админ-панель</span>
          </div>
          <CardTitle className="text-2xl">Вход</CardTitle>
          <CardDescription>
            Введите пароль администратора
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onLogin(password);
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoFocus
              />
            </div>
            {error && (
              <div className="p-3 rounded-md bg-red-50 text-red-700 text-sm">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Войти
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Edit Dialog ────────────────────────────────────────────────────
function EditRecordDialog({
  record,
  open,
  onClose,
  onSave,
  saving,
}: {
  record: AdminRecord | null;
  open: boolean;
  onClose: () => void;
  onSave: (payload: {
    new_date?: string;
    steps?: number;
    notes?: string;
  }) => Promise<void>;
  saving: boolean;
}) {
  const [date, setDate] = useState('');
  const [steps, setSteps] = useState('');
  const [notes, setNotes] = useState('');

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Редактировать запись</DialogTitle>
          <DialogDescription>
            {record.DisplayName || record.Username} • {record.Date}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-date">Дата</Label>
            <Input
              id="edit-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-steps">Шаги</Label>
            <Input
              id="edit-steps"
              type="number"
              min={0}
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-notes">Примечания</Label>
            <Input
              id="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Необязательно"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Отмена
          </Button>
          <Button
            onClick={async () => {
              await onSave({
                new_date: date,
                steps: steps === '' ? undefined : Number(steps),
                notes: notes || undefined,
              });
            }}
            disabled={saving}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Admin Page ─────────────────────────────────────────────────────
export function AdminPage() {
  const { authenticated, loading: authLoading, error: authError, login, logout } = useAdminAuth();
  const {
    data,
    loading: recordsLoading,
    error: recordsError,
    fetchRecords,
    updateRecord,
    deleteRecord,
  } = useAdminRecords();
  const {
    backups,
    loading: backupsLoading,
    error: backupsError,
    fetchBackups,
    createBackup,
    downloadBackup,
  } = useAdminBackups();

  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [editRecord, setEditRecord] = useState<AdminRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminRecord | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (authenticated) {
      fetchRecords({ limit: PAGE_SIZE, offset, search });
    }
  }, [authenticated, offset, search, fetchRecords]);

  useEffect(() => {
    if (authenticated) {
      fetchBackups();
    }
  }, [authenticated, fetchBackups]);

  const debouncedSearch = useMemo(() => {
    return search;
  }, [search]);

  // reset pagination on search change
  useEffect(() => {
    setOffset(0);
  }, [debouncedSearch]);

  const handleSave = async (payload: {
    new_date?: string;
    steps?: number;
    notes?: string;
  }) => {
    if (!editRecord) return;
    setActionLoading(true);
    try {
      await updateRecord({
        timestamp: editRecord.Timestamp,
        user_id: Number(editRecord.UserID),
        old_date: editRecord.Date,
        ...payload,
      });
      setMessage('Запись обновлена');
      setEditRecord(null);
      fetchRecords({ limit: PAGE_SIZE, offset, search });
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Ошибка обновления');
    } finally {
      setActionLoading(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
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
    } finally {
      setActionLoading(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleCreateBackup = async () => {
    setActionLoading(true);
    try {
      await createBackup();
      setMessage('Бекап создан');
      fetchBackups();
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Ошибка создания бекапа');
    } finally {
      setActionLoading(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!authenticated) {
    return <LoginForm onLogin={login} loading={authLoading} error={authError} />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Админ-панель</h1>
                <p className="text-xs text-slate-500 hidden sm:block">
                  Управление записями и бекапами
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href="/" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">На дашборд</span>
                </a>
              </Button>
              <Button variant="outline" size="sm" onClick={logout} className="gap-2">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Выйти</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {message && (
          <div className={`mb-6 p-4 rounded-lg text-sm ${message.includes('Ошибка') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
            {message}
          </div>
        )}

        <Tabs defaultValue="records" className="space-y-6">
          <TabsList>
            <TabsTrigger value="records" className="gap-2">
              <Pencil className="h-4 w-4" />
              Записи
            </TabsTrigger>
            <TabsTrigger value="backups" className="gap-2">
              <Package className="h-4 w-4" />
              Бекапы
            </TabsTrigger>
          </TabsList>

          {/* Records tab */}
          <TabsContent value="records" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Записи шагов</CardTitle>
                <CardDescription>
                  Редактирование и удаление записей участников
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Поиск по имени, дате или шагам..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="max-w-sm"
                  />
                </div>

                {recordsError && (
                  <div className="p-3 rounded-md bg-red-50 text-red-700 text-sm">
                    {recordsError}
                  </div>
                )}

                {recordsLoading && !data ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="border rounded-md overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Участник</TableHead>
                            <TableHead>Дата</TableHead>
                            <TableHead>Шаги</TableHead>
                            <TableHead>Скриншот</TableHead>
                            <TableHead>Примечания</TableHead>
                            <TableHead className="text-right">Действия</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data?.records.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center text-slate-500 py-8">
                                Записи не найдены
                              </TableCell>
                            </TableRow>
                          )}
                          {data?.records.map((record) => (
                            <TableRow key={`${record.Timestamp}-${record.UserID}-${record.Date}`}>
                              <TableCell className="font-medium">
                                {record.DisplayName || record.Username || 'Unknown'}
                                <div className="text-xs text-slate-400">ID: {record.UserID}</div>
                              </TableCell>
                              <TableCell>{record.Date}</TableCell>
                              <TableCell>{Number(record.Steps).toLocaleString('ru-RU')}</TableCell>
                              <TableCell>
                                {record.ScreenshotURL ? (
                                  <Badge variant="outline" className="gap-1">
                                    <FileArchive className="h-3 w-3" />
                                    Есть
                                  </Badge>
                                ) : (
                                  <span className="text-slate-400 text-sm">—</span>
                                )}
                              </TableCell>
                              <TableCell className="max-w-xs truncate text-sm text-slate-600">
                                {record.Notes || '—'}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setEditRecord(record)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => setDeleteTarget(record)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {data && data.total > PAGE_SIZE && (
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-slate-500">
                          Показано {offset + 1}–{Math.min(offset + PAGE_SIZE, data.total)} из {data.total}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                            disabled={offset === 0}
                          >
                            Назад
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setOffset((o) => o + PAGE_SIZE)}
                            disabled={offset + PAGE_SIZE >= data.total}
                          >
                            Вперёд
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Backups tab */}
          <TabsContent value="backups" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Бекапы</CardTitle>
                <CardDescription>
                  Архивы данных и скриншотов в формате ZIP
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={handleCreateBackup} disabled={actionLoading || backupsLoading}>
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Package className="h-4 w-4 mr-2" />}
                  Создать бекап
                </Button>

                {backupsError && (
                  <div className="p-3 rounded-md bg-red-50 text-red-700 text-sm">
                    {backupsError}
                  </div>
                )}

                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Файл</TableHead>
                        <TableHead>Создан</TableHead>
                        <TableHead>Размер</TableHead>
                        <TableHead className="text-right">Действия</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {backups.length === 0 && !backupsLoading && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-slate-500 py-8">
                            Бекапов пока нет
                          </TableCell>
                        </TableRow>
                      )}
                      {backupsLoading && (
                        <TableRow>
                          <TableCell colSpan={4}>
                            <Skeleton className="h-10 w-full" />
                          </TableCell>
                        </TableRow>
                      )}
                      {backups.map((backup) => (
                        <TableRow key={backup.backup_id}>
                          <TableCell className="font-medium">
                            {backup.backup_id}
                          </TableCell>
                          <TableCell>{formatDate(backup.created_at)}</TableCell>
                          <TableCell>{formatBytes(backup.size)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => downloadBackup(backup.backup_id)}
                              className="gap-2"
                            >
                              <Download className="h-4 w-4" />
                              Скачать
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {editRecord && (
        <EditRecordDialog
          key={`${editRecord.Timestamp}-${editRecord.UserID}-${editRecord.Date}`}
          record={editRecord}
          open={!!editRecord}
          onClose={() => setEditRecord(null)}
          onSave={handleSave}
          saving={actionLoading}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить запись?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы собираетесь удалить запись{' '}
              <strong>{deleteTarget?.DisplayName || deleteTarget?.Username}</strong>{' '}
              за <strong>{deleteTarget?.Date}</strong>.{' '}
              {deleteTarget?.ScreenshotURL && 'Прикреплённый скриншот также будет удалён.'}
              Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={actionLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
