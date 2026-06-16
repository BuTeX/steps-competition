import { Clock, Footprints } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { StepRecord } from '@/hooks/useApiData';

interface RecentActivityProps {
  records: StepRecord[];
}

export function RecentActivity({ records }: RecentActivityProps) {
  // Already sorted by API
  const recent = records.slice(0, 20);

  return (
    <Card className="border border-slate-200">
      <CardHeader>
        <CardTitle className="text-xl font-bold flex items-center gap-2">
          <Clock className="h-5 w-5 text-violet-500" />
          Последние записи
        </CardTitle>
      </CardHeader>
      <CardContent>
        {recent.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            Пока нет записей
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
            {recent.map((record, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Footprints className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-900 truncate">
                    {record.DisplayName || record.Username || 'Unknown'}
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatDate(record.Date)}
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="font-bold text-slate-900">
                    {parseInt(record.Steps || '0', 10).toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-500">шагов</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-');
    return `${day}.${month}.${year}`;
  } catch {
    return dateStr;
  }
}
