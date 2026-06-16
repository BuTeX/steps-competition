import { useMemo, useState } from 'react';
import { Calendar, ImageOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { DailyMatrixUser, DailyMatrixEntry } from '@/hooks/useApiData';

interface DailyMatrixProps {
  matrix: DailyMatrixUser[];
}

interface SelectedCell {
  user: DailyMatrixUser;
  entry: DailyMatrixEntry;
}

export function DailyMatrix({ matrix }: DailyMatrixProps) {
  const [selected, setSelected] = useState<SelectedCell | null>(null);

  const dates = useMemo(() => {
    const dateSet = new Set<string>();
    matrix.forEach((user) => user.dates.forEach((d) => dateSet.add(d.date)));
    return Array.from(dateSet).sort();
  }, [matrix]);

  if (matrix.length === 0 || dates.length === 0) {
    return (
      <Card className="border border-slate-200">
        <CardHeader>
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-emerald-500" />
            Шаги по дням
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-slate-500">
            Пока нет данных для таблицы
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatDate = (dateStr: string) => {
    try {
      const [, month, day] = dateStr.split('-');
      return `${day}.${month}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <Card className="border border-slate-200">
      <CardHeader>
        <CardTitle className="text-xl font-bold flex items-center gap-2">
          <Calendar className="h-5 w-5 text-emerald-500" />
          Шаги по дням
        </CardTitle>
        <p className="text-sm text-slate-500">
          Нажми на число, чтобы посмотреть скриншот
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="sticky left-0 bg-white z-10 text-left px-3 py-2 font-semibold text-slate-700 min-w-[140px]">
                  Участник
                </th>
                {dates.map((date) => (
                  <th
                    key={date}
                    className="text-center px-2 py-2 font-medium text-slate-500 min-w-[64px]"
                  >
                    {formatDate(date)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((user) => (
                <tr key={user.user_id} className="border-b border-slate-100">
                  <td className="sticky left-0 bg-white z-10 px-3 py-2 font-medium text-slate-900">
                    {user.name}
                  </td>
                  {dates.map((date) => {
                    const entry = user.dates.find((d) => d.date === date);
                    const hasScreenshot = !!entry?.screenshot_url;

                    return (
                      <td key={date} className="px-1 py-1 text-center">
                        {entry ? (
                          hasScreenshot ? (
                            <button
                              onClick={() => setSelected({ user, entry })}
                              className="w-full px-2 py-1.5 rounded-md bg-blue-50 text-blue-700 font-semibold hover:bg-blue-100 transition-colors cursor-pointer"
                              title="Посмотреть скриншот"
                            >
                              {entry.steps.toLocaleString()}
                            </button>
                          ) : (
                            <span
                              className="block px-2 py-1.5 rounded-md bg-slate-50 text-slate-600 font-medium"
                              title="Скриншот не отправлен"
                            >
                              {entry.steps.toLocaleString()}
                            </span>
                          )
                        ) : (
                          <span className="block px-2 py-1.5 text-slate-300">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {selected?.user.name} — {selected && formatDate(selected.entry.date)}
            </DialogTitle>
            <DialogDescription>
              {selected?.entry.steps.toLocaleString()} шагов
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center min-h-[200px]">
            {selected?.entry.screenshot_url ? (
              <img
                src={selected.entry.screenshot_url}
                alt={`Скриншот ${selected.user.name}`}
                className="max-w-full h-auto max-h-[70vh] object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-400 py-12">
                <ImageOff className="h-10 w-10" />
                <span>Скриншот отсутствует</span>
              </div>
            )}
          </div>
          {selected?.entry.screenshot_url && (
            <a
              href={selected.entry.screenshot_url}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 hover:underline text-sm mt-2 inline-block"
            >
              Открыть оригинал
            </a>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
