import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatsCards } from '@/components/StatsCards';
import { Leaderboard } from '@/components/Leaderboard';
import { ActivityChart } from '@/components/ActivityChart';
import { RecentActivity } from '@/components/RecentActivity';
import { DailyMatrix } from '@/components/DailyMatrix';
import type {
  StepRecord,
  UserStat,
  DailyStat,
  DailyMatrixUser,
  GlobalStats,
} from '@/hooks/useApiData';



interface DashboardPageProps {
  records: StepRecord[];
  users: UserStat[];
  daily: DailyStat[];
  matrix: DailyMatrixUser[];
  stats: GlobalStats | null;
  loading: boolean;
  error: string | null;
}

export function DashboardPage({
  records,
  users,
  daily,
  matrix,
  stats,
  loading,
  error,
}: DashboardPageProps) {
  return (
    <div className="space-y-6">
      {/* Error */}
      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">
          <p className="font-medium">Ошибка подключения</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {stats && (
        <>
          {/* Stats */}
          <StatsCards
            totalSteps={stats.total_steps}
            totalParticipants={stats.total_participants}
            activeDays={stats.active_days}
          />

          {/* Daily matrix with screenshots */}
          <DailyMatrix matrix={matrix} />

          {/* Chart + Recent */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ActivityChart dailyStats={daily} />
            </div>
            <div className="lg:col-span-1">
              <RecentActivity records={records} />
            </div>
          </div>

          {/* Leaderboard */}
          <Leaderboard users={users} />

          {/* Footer */}
          <footer className="text-center text-xs text-slate-400 pt-4 pb-8">
            <p>
              Автообновление каждые 30 сек • Всего записей: {stats.total_records}
            </p>
          </footer>
        </>
      )}

      {!stats && !loading && !error && (
        <div className="text-center py-12 text-slate-500">
          Нет данных для отображения
        </div>
      )}
    </div>
  );
}

export function DashboardRefreshButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={loading}
      className="gap-2"
    >
      <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
      <span className="hidden sm:inline">Обновить</span>
    </Button>
  );
}
