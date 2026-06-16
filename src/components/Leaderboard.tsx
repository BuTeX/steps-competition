import { Trophy, Medal, Award } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { UserStat } from '@/hooks/useApiData';

interface LeaderboardProps {
  users: UserStat[];
}

export function Leaderboard({ users }: LeaderboardProps) {
  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-amber-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-slate-400" />;
    if (rank === 3) return <Award className="h-5 w-5 text-amber-700" />;
    return <span className="text-sm font-medium text-slate-400 w-5 text-center">{rank}</span>;
  };

  const getRankBg = (rank: number) => {
    if (rank === 1) return 'bg-amber-50 border-amber-200';
    if (rank === 2) return 'bg-slate-50 border-slate-200';
    if (rank === 3) return 'bg-orange-50 border-orange-200';
    return 'bg-white border-slate-100';
  };

  return (
    <Card className="border border-slate-200">
      <CardHeader>
        <CardTitle className="text-xl font-bold flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          Рейтинг участников
        </CardTitle>
      </CardHeader>
      <CardContent>
        {users.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            Пока нет данных. Стань первым!
          </div>
        ) : (
          <div className="space-y-2">
            {/* Header */}
            <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-medium text-slate-500 uppercase">
              <div className="col-span-1">#</div>
              <div className="col-span-4">Участник</div>
              <div className="col-span-2 text-right">Шаги</div>
              <div className="col-span-2 text-right">Дней</div>
              <div className="col-span-3 text-right">Среднее</div>
            </div>

            {/* Rows */}
            {users.map((user, idx) => {
              const rank = idx + 1;
              return (
                <div
                  key={user.user_id}
                  className={`grid grid-cols-12 gap-2 px-4 py-3 rounded-lg border ${getRankBg(rank)} items-center transition-all hover:shadow-sm`}
                >
                  <div className="col-span-1 flex items-center">
                    {getRankIcon(rank)}
                  </div>
                  <div className="col-span-4">
                    <div className="font-semibold text-slate-900 truncate">
                      {user.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      Лучший: {user.max_steps.toLocaleString()}
                    </div>
                  </div>
                  <div className="col-span-2 text-right">
                    <div className="font-bold text-slate-900">
                      {user.total_steps.toLocaleString()}
                    </div>
                  </div>
                  <div className="col-span-2 text-right">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                      {user.days}
                    </span>
                  </div>
                  <div className="col-span-3 text-right">
                    <div className="font-medium text-slate-700">
                      {user.avg_steps.toLocaleString()}/день
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
