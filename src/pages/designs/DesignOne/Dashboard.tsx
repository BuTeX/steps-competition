import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  Activity,
  Calendar,
  Clock,
  Footprints,
  Medal,
  RefreshCw,
  Search,
  Shield,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useApiData } from '@/hooks/useApiData';
import { BrandLogo } from '../shared/BrandLogo';
import { PatternBg } from '../shared/PatternBg';
import { DesignNav } from '../shared/DesignNav';
import './theme.css';

function formatNumber(num: number) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toLocaleString();
}

function formatDate(dateStr: string) {
  try {
    const [, month, day] = dateStr.split('-');
    return `${day}.${month}`;
  } catch {
    return dateStr;
  }
}

export default function Dashboard() {
  const { records, users, daily, matrix, stats, loading, error, refetch } = useApiData();
  const [selected, setSelected] = useState<{ user: any; entry: any } | null>(null);

  const avgPerPerson = stats && stats.total_participants > 0
    ? stats.total_steps / stats.total_participants
    : 0;
  const avgPerPersonPerDay = stats && stats.total_participants > 0 && stats.active_days > 0
    ? stats.total_steps / stats.total_participants / stats.active_days
    : 0;

  const chartData = useMemo(() => {
    if (!daily.length) return null;
    const maxSteps = Math.max(...daily.map((d) => d.total_steps));
    const width = 800;
    const height = 280;
    const padding = { top: 20, right: 20, bottom: 40, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const xScale = (i: number) =>
      padding.left + (i / Math.max(daily.length - 1, 1)) * chartWidth;
    const yScale = (steps: number) =>
      padding.top + chartHeight - (steps / Math.max(maxSteps, 1)) * chartHeight;

    const linePath = daily
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(d.total_steps)}`)
      .join(' ');
    const areaPath =
      linePath +
      ` L ${xScale(daily.length - 1)} ${padding.top + chartHeight}` +
      ` L ${padding.left} ${padding.top + chartHeight} Z`;

    const yTicks = [0, maxSteps * 0.25, maxSteps * 0.5, maxSteps * 0.75, maxSteps].map((v) => ({
      value: Math.round(v),
      y: yScale(v),
    }));

    const step = Math.ceil(daily.length / 8);
    const xLabels = daily
      .filter((_, i) => i % step === 0 || i === daily.length - 1)
      .map((d, i) => ({
        label: formatDate(d.date),
        x: xScale(Math.min(i * step, daily.length - 1)),
      }));

    return { width, height, padding, linePath, areaPath, yTicks, xLabels, maxSteps };
  }, [daily]);

  const matrixDates = useMemo(() => {
    const set = new Set<string>();
    matrix.forEach((u) => u.dates.forEach((d) => set.add(d.date)));
    return Array.from(set).sort();
  }, [matrix]);

  return (
    <div className="design-one min-h-screen bg-[var(--d1-bg)] text-[var(--d1-text)]">
      <PatternBg pattern="1" opacity={0.04} />

      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-[var(--d1-border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <BrandLogo className="h-9" />
              <div>
                <h1 className="text-lg font-bold leading-tight">Шагомер</h1>
                <p className="text-[10px] text-[var(--d1-muted)] uppercase tracking-wider">
                  Конкурс шагов
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={refetch}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium border border-[var(--d1-border)] hover:bg-[var(--d1-surface)] transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Обновить</span>
              </button>
              <Link
                to="/v1/admin"
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium bg-[var(--d1-primary)] text-[var(--d1-primary-text)] hover:opacity-90 transition-opacity"
              >
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">Админ</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {error && (
          <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-red-700">
            <p className="font-medium">Ошибка подключения</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {!stats && !loading && !error && (
          <div className="text-center py-20 text-[var(--d1-muted)]">Нет данных для отображения</div>
        )}

        {stats && (
          <>
            {/* Stats */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Всего шагов', value: formatNumber(stats.total_steps), icon: Footprints, color: 'bg-[#7856FF]/10 text-[#7856FF]' },
                { label: 'Участников', value: stats.total_participants.toString(), icon: Users, color: 'bg-[#00C1D4]/10 text-[#00C1D4]' },
                { label: 'Среднее на человека', value: formatNumber(Math.round(avgPerPerson)), icon: TrendingUp, color: 'bg-[#FE5500]/10 text-[#FE5500]' },
                { label: 'Среднее на человека в день', value: formatNumber(Math.round(avgPerPersonPerDay)), icon: Activity, color: 'bg-[#1B0B3B]/10 text-[#1B0B3B]' },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-[var(--d1-radius)] bg-[var(--d1-surface)] p-5 shadow-[var(--d1-shadow)] flex items-start justify-between"
                >
                  <div>
                    <p className="text-xs text-[var(--d1-muted)] uppercase tracking-wider mb-1">{s.label}</p>
                    <p className="text-2xl font-bold">{s.value}</p>
                  </div>
                  <div className={`p-2.5 rounded-xl ${s.color}`}>
                    <s.icon className="h-5 w-5" />
                  </div>
                </div>
              ))}
            </section>

            {/* Daily Matrix */}
            <section className="rounded-[var(--d1-radius)] bg-white border border-[var(--d1-border)] shadow-[var(--d1-shadow)] overflow-hidden">
              <div className="px-6 py-5 border-b border-[var(--d1-border)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-[#7856FF]/10 text-[#7856FF]">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">Шаги по дням</h2>
                    <p className="text-xs text-[var(--d1-muted)]">Нажми на число, чтобы открыть скриншот</p>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto p-2">
                {matrix.length === 0 ? (
                  <div className="text-center py-12 text-[var(--d1-muted)]">Пока нет данных</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--d1-border)]">
                        <th className="text-left px-4 py-3 font-semibold sticky left-0 bg-white min-w-[140px]">Участник</th>
                        {matrixDates.map((date) => (
                          <th key={date} className="text-center px-2 py-3 font-medium text-[var(--d1-muted)] min-w-[64px]">
                            {formatDate(date)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {matrix.map((user) => (
                        <tr key={user.user_id} className="border-b border-[var(--d1-border)]/50 last:border-0">
                          <td className="px-4 py-2 font-medium sticky left-0 bg-white">{user.name}</td>
                          {matrixDates.map((date) => {
                            const entry = user.dates.find((d) => d.date === date);
                            return (
                              <td key={date} className="px-1 py-1 text-center">
                                {entry ? (
                                  <button
                                    onClick={() => entry.screenshot_url && setSelected({ user, entry })}
                                    className={`w-full px-2 py-1.5 rounded-lg font-semibold transition-colors ${
                                      entry.screenshot_url
                                        ? 'bg-[#7856FF]/10 text-[#7856FF] hover:bg-[#7856FF]/20'
                                        : 'bg-[var(--d1-surface)] text-[var(--d1-text)]'
                                    }`}
                                  >
                                    {entry.steps.toLocaleString()}
                                  </button>
                                ) : (
                                  <span className="block px-2 py-1.5 text-[var(--d1-muted)]/30">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>

            {/* Chart + Recent */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 rounded-[var(--d1-radius)] bg-white border border-[var(--d1-border)] shadow-[var(--d1-shadow)] overflow-hidden">
                <div className="px-6 py-5 border-b border-[var(--d1-border)] flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-[#FE5500]/10 text-[#FE5500]">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <h2 className="text-lg font-bold">Активность по дням</h2>
                </div>
                <div className="p-4">
                  {!chartData ? (
                    <div className="text-center py-12 text-[var(--d1-muted)]">Недостаточно данных</div>
                  ) : (
                    <div className="w-full overflow-x-auto">
                      <svg viewBox={`0 0 ${chartData.width} ${chartData.height}`} className="w-full min-w-[600px]">
                        <defs>
                          <linearGradient id="d1Gradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#7856FF" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="#7856FF" stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        {chartData.yTicks.map((t, i) => (
                          <g key={i}>
                            <line
                              x1={chartData.padding.left}
                              y1={t.y}
                              x2={chartData.width - chartData.padding.right}
                              y2={t.y}
                              stroke="rgba(27,11,59,0.08)"
                              strokeDasharray="4,4"
                            />
                            <text x={chartData.padding.left - 10} y={t.y + 4} textAnchor="end" className="text-xs fill-[var(--d1-muted)]">
                              {formatNumber(t.value)}
                            </text>
                          </g>
                        ))}
                        <path d={chartData.areaPath} fill="url(#d1Gradient)" />
                        <path d={chartData.linePath} fill="none" stroke="#7856FF" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                        {daily.map((d, i) => {
                          const x = chartData.padding.left + (i / Math.max(daily.length - 1, 1)) * (chartData.width - chartData.padding.left - chartData.padding.right);
                          const y = chartData.padding.top + (chartData.height - chartData.padding.top - chartData.padding.bottom) - (d.total_steps / Math.max(chartData.maxSteps, 1)) * (chartData.height - chartData.padding.top - chartData.padding.bottom);
                          return (
                            <g key={i}>
                              <circle cx={x} cy={y} r={5} fill="#7856FF" stroke="white" strokeWidth={2} />
                              <title>{formatDate(d.date)}: {d.total_steps.toLocaleString()} шагов ({d.participants} участников)</title>
                            </g>
                          );
                        })}
                        {chartData.xLabels.map((l, i) => (
                          <text
                            key={i}
                            x={l.x}
                            y={chartData.height - 10}
                            textAnchor="middle"
                            className="text-xs fill-[var(--d1-muted)]"
                            transform={`rotate(-30, ${l.x}, ${chartData.height - 10})`}
                          >
                            {l.label}
                          </text>
                        ))}
                      </svg>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-[var(--d1-radius)] bg-white border border-[var(--d1-border)] shadow-[var(--d1-shadow)] overflow-hidden">
                <div className="px-6 py-5 border-b border-[var(--d1-border)] flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-[#00C1D4]/10 text-[#00C1D4]">
                    <Clock className="h-5 w-5" />
                  </div>
                  <h2 className="text-lg font-bold">Последние записи</h2>
                </div>
                <div className="p-4 space-y-2 max-h-[360px] overflow-y-auto">
                  {records.slice(0, 20).map((r, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--d1-surface)]">
                      <div className="h-10 w-10 rounded-full bg-[#7856FF]/10 flex items-center justify-center text-[#7856FF]">
                        <Footprints className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{r.DisplayName || r.Username || 'Unknown'}</div>
                        <div className="text-xs text-[var(--d1-muted)]">{r.Date}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{parseInt(r.Steps || '0', 10).toLocaleString()}</div>
                        <div className="text-[10px] text-[var(--d1-muted)]">шагов</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Leaderboard */}
            <section className="rounded-[var(--d1-radius)] bg-white border border-[var(--d1-border)] shadow-[var(--d1-shadow)] overflow-hidden">
              <div className="px-6 py-5 border-b border-[var(--d1-border)] flex items-center gap-3">
                <div className="p-2 rounded-xl bg-[#FE5500]/10 text-[#FE5500]">
                  <Medal className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-bold">Рейтинг участников</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--d1-surface)]">
                    <tr>
                      <th className="text-left px-6 py-3 font-semibold">Место</th>
                      <th className="text-left px-6 py-3 font-semibold">Участник</th>
                      <th className="text-right px-6 py-3 font-semibold">Шагов</th>
                      <th className="text-right px-6 py-3 font-semibold">Дней</th>
                      <th className="text-right px-6 py-3 font-semibold">Среднее</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u, i) => (
                      <tr key={u.user_id} className="border-b border-[var(--d1-border)]/50 last:border-0">
                        <td className="px-6 py-3">
                          {i < 3 ? (
                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                              i === 0 ? 'bg-[#FE5500] text-white' : i === 1 ? 'bg-[#7856FF] text-white' : 'bg-[#00C1D4] text-white'
                            }`}>
                              {i + 1}
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium text-[var(--d1-muted)]">
                              {i + 1}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3 font-medium">{u.name}</td>
                        <td className="px-6 py-3 text-right font-bold">{u.total_steps.toLocaleString()}</td>
                        <td className="px-6 py-3 text-right">{u.days}</td>
                        <td className="px-6 py-3 text-right text-[var(--d1-muted)]">{Math.round(u.avg_steps).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <footer className="text-center text-xs text-[var(--d1-muted)] pt-4 pb-8">
              Автообновление каждые 30 сек • Всего записей: {stats.total_records}
            </footer>
          </>
        )}
      </main>

      {/* Screenshot modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">{selected.user.name} — {formatDate(selected.entry.date)}</h3>
              <button onClick={() => setSelected(null)} className="p-1 rounded-lg hover:bg-[var(--d1-surface)]">
                <Search className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-[var(--d1-muted)] mb-4">{selected.entry.steps.toLocaleString()} шагов</p>
            {selected.entry.screenshot_url && (
              <img src={selected.entry.screenshot_url} alt="Скриншот" className="w-full rounded-xl" />
            )}
          </div>
        </div>
      )}

      <DesignNav />
    </div>
  );
}
