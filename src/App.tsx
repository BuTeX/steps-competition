import { Footprints, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useApiData } from '@/hooks/useApiData';
import { StatsCards } from '@/components/StatsCards';
import { Leaderboard } from '@/components/Leaderboard';
import { ActivityChart } from '@/components/ActivityChart';
import { RecentActivity } from '@/components/RecentActivity';
import { DailyMatrix } from '@/components/DailyMatrix';
import './App.css';

function App() {
  const {
    records,
    users,
    daily,
    matrix,
    stats,
    loading,
    error,
    refetch,
  } = useApiData();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Footprints className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Шагомер</h1>
                <p className="text-xs text-slate-500 hidden sm:block">
                  Конкурс шагов — рейтинг и статистика
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={refetch}
                disabled={loading}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Обновить</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Error */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">
            <p className="font-medium">Ошибка подключения</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Dashboard */}
        {stats && (
          <div className="space-y-6">
            {/* Stats */}
            <StatsCards
              totalSteps={stats.total_steps}
              totalParticipants={stats.total_participants}
              activeDays={stats.active_days}
              avgStepsPerDay={stats.avg_steps_per_day}
            />

            {/* Chart + Recent */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <ActivityChart dailyStats={daily} />
              </div>
              <div className="lg:col-span-1">
                <RecentActivity records={records} />
              </div>
            </div>

            {/* Daily matrix with screenshots */}
            <DailyMatrix matrix={matrix} />

            {/* Leaderboard */}
            <Leaderboard users={users} />

            {/* Footer */}
            <footer className="text-center text-xs text-slate-400 pt-4 pb-8">
              <p>
                Автообновление каждые 30 сек • Всего записей: {stats.total_records}
              </p>
            </footer>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
