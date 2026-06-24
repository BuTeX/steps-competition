import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  ArrowLeft,
  Download,
  Eye,
  FileArchive,
  Image,
  Loader2,
  LogOut,
  Package,
  Pencil,
  Plus,
  Save,
  Search,
  Send,
  Shield,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  useAdminAuth,
  useAdminBackups,
  useAdminParticipants,
  useAdminRecords,
  useAdminReminders,
  type AdminRecord,
  type AdminParticipant,
} from '@/hooks/useAdmin';

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

function filenameFromUrl(url: string) {
  try {
    const decoded = decodeURIComponent(url);
    return decoded.split('/').pop() || url;
  } catch {
    return url;
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

// ─── Create Record Dialog ───────────────────────────────────────────
function CreateRecordDialog({
  open,
  onClose,
  onSave,
  saving,
  participants,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (payload: {
    user_id: number;
    display_name: string;
    username: string;
    date: string;
    steps: number;
    notes: string;
  }) => Promise<void>;
  saving: boolean;
  participants: AdminParticipant[];
}) {
  const [useExisting, setUseExisting] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [userId, setUserId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [date, setDate] = useState('');
  const [steps, setSteps] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      setUseExisting(true);
      setSelectedUserId(participants.length ? participants[0].UserID : '');
      setUserId('');
      setDisplayName('');
      setUsername('');
      setDate('');
      setSteps('');
      setNotes('');
    }
  }, [open, participants]);

  const selectedParticipant = useMemo(() => {
    return participants.find((p) => p.UserID === selectedUserId);
  }, [participants, selectedUserId]);

  const handleSubmit = async () => {
    const payload = useExisting && selectedParticipant
      ? {
          user_id: Number(selectedParticipant.UserID),
          display_name: selectedParticipant.DisplayName,
          username: selectedParticipant.Username,
          date,
          steps: steps === '' ? 0 : Number(steps),
          notes,
        }
      : {
          user_id: userId === '' ? 0 : Number(userId),
          display_name: displayName,
          username,
          date,
          steps: steps === '' ? 0 : Number(steps),
          notes,
        };
    await onSave(payload);
  };

  const canSubmit = useExisting
    ? selectedUserId && date && steps !== ''
    : userId && displayName && date && steps !== '';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Добавить запись</DialogTitle>
          <DialogDescription>
            Создание записи о шагах участника
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="use-existing">Выбрать участника</Label>
            <Switch
              id="use-existing"
              checked={useExisting}
              onCheckedChange={setUseExisting}
            />
          </div>

          {useExisting ? (
            <div className="space-y-2">
              <Label>Участник</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Выберите участника" />
                </SelectTrigger>
                <SelectContent>
                  {participants.map((p) => (
                    <SelectItem key={p.UserID} value={p.UserID}>
                      {p.DisplayName || p.Username || `ID ${p.UserID}`}
                      <span className="text-muted-foreground ml-2 text-xs">ID: {p.UserID}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="create-user-id">User ID</Label>
                <Input
                  id="create-user-id"
                  type="number"
                  min={1}
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="123456789"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-display-name">Имя</Label>
                <Input
                  id="create-display-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Иван Иванов"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-username">Username (опционально)</Label>
                <Input
                  id="create-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="@username"
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="create-date">Дата</Label>
            <Input
              id="create-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-steps">Шаги</Label>
            <Input
              id="create-steps"
              type="number"
              min={0}
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              placeholder="10000"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-notes">Примечания</Label>
            <Input
              id="create-notes"
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
          <Button onClick={handleSubmit} disabled={saving || !canSubmit}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            Создать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Screenshot Viewer Dialog ───────────────────────────────────────
function ScreenshotViewerDialog({
  url,
  open,
  onClose,
}: {
  url: string | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!url) return null;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Скриншот</DialogTitle>
          <DialogDescription className="break-all">
            {filenameFromUrl(url)}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-center bg-slate-100 rounded-md overflow-hidden max-h-[70vh]">
          <img
            src={`/api/admin/screenshots/view?url=${encodeURIComponent(url)}`}
            alt="Скриншот"
            className="max-w-full max-h-[70vh] object-contain"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Закрыть
          </Button>
          <Button asChild>
            <a href={url} target="_blank" rel="noopener noreferrer">
              Открыть оригинал
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Replace Screenshot Dialog ──────────────────────────────────────
function ReplaceScreenshotDialog({
  record,
  open,
  onClose,
  onUpload,
  saving,
}: {
  record: AdminRecord | null;
  open: boolean;
  onClose: () => void;
  onUpload: (file: File) => Promise<void>;
  saving: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (open) setFile(null);
  }, [open]);

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Заменить скриншот</DialogTitle>
          <DialogDescription>
            {record.DisplayName || record.Username} • {record.Date}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          {file && (
            <div className="text-sm text-slate-600">
              Выбран: {file.name} ({formatBytes(file.size)})
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Отмена
          </Button>
          <Button
            onClick={async () => {
              if (file) await onUpload(file);
            }}
            disabled={saving || !file}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
            Заменить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Dialog ────────────────────────────────────────────────────
function EditRecordDialog({
  record,
  open,
  onClose,
  onSave,
  onUploadScreenshot,
  onDeleteScreenshot,
  onViewScreenshot,
  saving,
}: {
  record: AdminRecord | null;
  open: boolean;
  onClose: () => void;
  onSave: (payload: {
    new_date?: string;
    steps?: number;
    notes?: string;
  }) => Promise<{ record: AdminRecord }>;
  onUploadScreenshot: (record: AdminRecord, file: File) => Promise<{ record: AdminRecord }>;
  onDeleteScreenshot: (record: AdminRecord) => Promise<{ record: AdminRecord }>;
  onViewScreenshot: (url: string) => void;
  saving: boolean;
}) {
  const [date, setDate] = useState('');
  const [steps, setSteps] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [localRecord, setLocalRecord] = useState<AdminRecord | null>(null);

  useEffect(() => {
    if (record) {
      setDate(record.Date);
      setSteps(record.Steps);
      setNotes(record.Notes);
      setFile(null);
      setLocalRecord(record);
    }
  }, [record]);

  if (!record || !localRecord) return null;

  const handleSave = async () => {
    try {
      const updated = await onSave({
        new_date: date,
        steps: steps === '' ? undefined : Number(steps),
        notes: notes || undefined,
      });

      let finalRecord = updated.record;

      if (file) {
        const uploaded = await onUploadScreenshot(finalRecord, file);
        finalRecord = uploaded.record;
      }

      setLocalRecord(finalRecord);
      setFile(null);
      onClose();
    } catch {
      // Ошибки уже показаны в onSave / onUploadScreenshot
    }
  };

  const handleDeleteScreenshot = async () => {
    const updated = await onDeleteScreenshot(localRecord);
    setLocalRecord(updated.record);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Редактировать запись</DialogTitle>
          <DialogDescription>
            {localRecord.DisplayName || localRecord.Username} • {localRecord.Date}
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

          <div className="space-y-2">
            <Label>Скриншот</Label>
            {localRecord.ScreenshotURL ? (
              <div className="flex items-center gap-2 p-2 border rounded-md bg-slate-50">
                <FileArchive className="h-4 w-4 text-slate-500" />
                <span className="text-sm truncate flex-1">
                  {filenameFromUrl(localRecord.ScreenshotURL)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onViewScreenshot(localRecord.ScreenshotURL)}
                  title="Просмотр"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleDeleteScreenshot}
                  disabled={saving}
                  title="Удалить скриншот"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="text-sm text-slate-400">Скриншот не прикреплён</div>
            )}
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            {file && (
              <div className="text-sm text-slate-600">
                Новый файл: {file.name} ({formatBytes(file.size)})
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={saving}>
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
    createRecord,
    updateRecord,
    uploadScreenshot,
    deleteScreenshot,
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
  const { participants, fetchParticipants } = useAdminParticipants();
  const { sendReminder, loading: reminderLoading } = useAdminReminders();

  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [reminderText, setReminderText] = useState('');
  const [reminderResult, setReminderResult] = useState<{ sent: number; failed: number } | null>(null);
  const [editRecord, setEditRecord] = useState<AdminRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminRecord | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [replaceTarget, setReplaceTarget] = useState<AdminRecord | null>(null);
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (authenticated) {
      fetchRecords({ limit: PAGE_SIZE, offset, search });
      fetchParticipants();
    }
  }, [authenticated, offset, search, fetchRecords, fetchParticipants]);

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

  const showMessage = (text: string, isError = false) => {
    setMessage(isError ? `Ошибка: ${text}` : text);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleCreate = async (payload: {
    user_id: number;
    display_name: string;
    username: string;
    date: string;
    steps: number;
    notes: string;
  }) => {
    setActionLoading(true);
    try {
      await createRecord(payload);
      showMessage('Запись создана');
      setCreateOpen(false);
      fetchRecords({ limit: PAGE_SIZE, offset, search });
    } catch (err: unknown) {
      showMessage(err instanceof Error ? err.message : 'Ошибка создания', true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSave = async (payload: {
    new_date?: string;
    steps?: number;
    notes?: string;
  }) => {
    if (!editRecord) throw new Error('Нет записи для сохранения');
    setActionLoading(true);
    try {
      const res = await updateRecord({
        timestamp: editRecord.Timestamp,
        user_id: Number(editRecord.UserID),
        old_date: editRecord.Date,
        ...payload,
      });
      showMessage('Запись обновлена');
      fetchRecords({ limit: PAGE_SIZE, offset, search });
      return res;
    } catch (err: unknown) {
      showMessage(err instanceof Error ? err.message : 'Ошибка обновления', true);
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const handleUploadScreenshot = async (record: AdminRecord, file: File) => {
    const res = await uploadScreenshot(
      record.Timestamp,
      Number(record.UserID),
      record.Date,
      file
    );
    showMessage('Скриншот обновлён');
    fetchRecords({ limit: PAGE_SIZE, offset, search });
    return res;
  };

  const handleDeleteScreenshot = async (record: AdminRecord) => {
    const res = await deleteScreenshot(
      record.Timestamp,
      Number(record.UserID),
      record.Date
    );
    showMessage('Скриншот удалён');
    fetchRecords({ limit: PAGE_SIZE, offset, search });
    return res;
  };

  const handleReplaceScreenshot = async (file: File) => {
    if (!replaceTarget) return;
    setActionLoading(true);
    try {
      await uploadScreenshot(
        replaceTarget.Timestamp,
        Number(replaceTarget.UserID),
        replaceTarget.Date,
        file
      );
      showMessage('Скриншот заменён');
      setReplaceTarget(null);
      fetchRecords({ limit: PAGE_SIZE, offset, search });
    } catch (err: unknown) {
      showMessage(err instanceof Error ? err.message : 'Ошибка замены скриншота', true);
    } finally {
      setActionLoading(false);
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
      showMessage('Запись удалена');
      setDeleteTarget(null);
      fetchRecords({ limit: PAGE_SIZE, offset, search });
    } catch (err: unknown) {
      showMessage(err instanceof Error ? err.message : 'Ошибка удаления', true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    setActionLoading(true);
    try {
      await createBackup();
      showMessage('Бекап создан');
      fetchBackups();
    } catch (err: unknown) {
      showMessage(err instanceof Error ? err.message : 'Ошибка создания бекапа', true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendReminder = async () => {
    const text = reminderText.trim();
    if (!text) {
      showMessage('Введите текст сообщения', true);
      return;
    }
    try {
      const result = await sendReminder(text);
      setReminderResult(result);
      showMessage(`Отправлено ${result.sent} участникам${result.failed > 0 ? `, ошибок: ${result.failed}` : ''}`);
    } catch (err: unknown) {
      showMessage(err instanceof Error ? err.message : 'Ошибка отправки', true);
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
            <TabsTrigger value="reminders" className="gap-2">
              <Send className="h-4 w-4" />
              Рассылка
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
                  Создание, редактирование и удаление записей участников
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Поиск по имени, дате или шагам..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="max-w-sm"
                    />
                  </div>
                  <Button onClick={() => setCreateOpen(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Добавить запись
                  </Button>
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
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-1"
                                    onClick={() => {
                                      setViewUrl(record.ScreenshotURL);
                                      setViewOpen(true);
                                    }}
                                  >
                                    <Eye className="h-3 w-3" />
                                    Есть
                                  </Button>
                                ) : (
                                  <span className="text-slate-400 text-sm">—</span>
                                )}
                              </TableCell>
                              <TableCell className="max-w-xs truncate text-sm text-slate-600">
                                {record.Notes || '—'}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setEditRecord(record)}
                                    title="Редактировать"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setReplaceTarget(record)}
                                    title="Заменить скриншот"
                                  >
                                    <Image className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => setDeleteTarget(record)}
                                    title="Удалить"
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

          {/* Reminders tab */}
          <TabsContent value="reminders" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Рассылка напоминаний</CardTitle>
                <CardDescription>
                  Отправьте сообщение всем участникам через Telegram-бота. Поддерживаются эмодзи.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reminder-text">Текст сообщения</Label>
                  <Textarea
                    id="reminder-text"
                    value={reminderText}
                    onChange={(e) => setReminderText(e.target.value)}
                    placeholder="Например: 👋 Не забудьте заполнить шаги за сегодня!"
                    rows={5}
                    maxLength={4000}
                  />
                  <div className="text-xs text-slate-500 text-right">
                    {reminderText.length} / 4000
                  </div>
                </div>

                {reminderResult && (
                  <div className="p-3 rounded-md bg-emerald-50 text-emerald-700 text-sm border border-emerald-200">
                    ✅ Отправлено: <strong>{reminderResult.sent}</strong>{' '}
                    {reminderResult.failed > 0 && (
                      <span className="text-red-600">| Ошибок: <strong>{reminderResult.failed}</strong></span>
                    )}
                  </div>
                )}

                <Button
                  onClick={handleSendReminder}
                  disabled={reminderLoading || !reminderText.trim()}
                  className="gap-2"
                >
                  {reminderLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Отправить всем участникам
                </Button>
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

      <CreateRecordDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSave={handleCreate}
        saving={actionLoading}
        participants={participants}
      />

      {editRecord && (
        <EditRecordDialog
          key={`${editRecord.Timestamp}-${editRecord.UserID}-${editRecord.Date}`}
          record={editRecord}
          open={!!editRecord}
          onClose={() => setEditRecord(null)}
          onSave={handleSave}
          onUploadScreenshot={handleUploadScreenshot}
          onDeleteScreenshot={handleDeleteScreenshot}
          onViewScreenshot={(url) => {
            setViewUrl(url);
            setViewOpen(true);
          }}
          saving={actionLoading}
        />
      )}

      <ReplaceScreenshotDialog
        record={replaceTarget}
        open={!!replaceTarget}
        onClose={() => setReplaceTarget(null)}
        onUpload={handleReplaceScreenshot}
        saving={actionLoading}
      />

      <ScreenshotViewerDialog
        url={viewUrl}
        open={viewOpen}
        onClose={() => {
          setViewOpen(false);
          setViewUrl(null);
        }}
      />

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
