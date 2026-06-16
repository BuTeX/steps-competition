import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DailyStat } from '@/hooks/useApiData';
import { Activity } from 'lucide-react';

interface ActivityChartProps {
  dailyStats: DailyStat[];
}

export function ActivityChart({ dailyStats }: ActivityChartProps) {
  const chartData = useMemo(() => {
    if (dailyStats.length === 0) return null;

    const maxSteps = Math.max(...dailyStats.map(d => d.total_steps));
    const padding = { top: 20, right: 20, bottom: 40, left: 60 };
    const width = 800;
    const height = 300;
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const xScale = (index: number) => 
      padding.left + (index / Math.max(dailyStats.length - 1, 1)) * chartWidth;
    
    const yScale = (steps: number) => 
      padding.top + chartHeight - (steps / Math.max(maxSteps, 1)) * chartHeight;

    // Area path
    const areaPath = dailyStats.map((d, i) => {
      const x = xScale(i);
      const y = yScale(d.total_steps);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ') + 
    ` L ${xScale(dailyStats.length - 1)} ${padding.top + chartHeight}` +
    ` L ${padding.left} ${padding.top + chartHeight} Z`;

    // Line path
    const linePath = dailyStats.map((d, i) => {
      const x = xScale(i);
      const y = yScale(d.total_steps);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

    // Y-axis ticks
    const yTicks = [0, maxSteps * 0.25, maxSteps * 0.5, maxSteps * 0.75, maxSteps].map(v => ({
      value: Math.round(v),
      y: yScale(v),
    }));

    // X-axis labels
    const step = Math.ceil(dailyStats.length / 8);
    const xLabels = dailyStats.filter((_, i) => i % step === 0 || i === dailyStats.length - 1).map((d, i) => {
      const originalIndex = i * step;
      return {
        label: formatDate(d.date),
        x: xScale(Math.min(originalIndex, dailyStats.length - 1)),
      };
    });

    return { 
      width, height, areaPath, linePath, yTicks, xLabels, padding, 
      dots: dailyStats.map((d, i) => ({ 
        x: xScale(i), 
        y: yScale(d.total_steps), 
        steps: d.total_steps, 
        participants: d.participants 
      })) 
    };
  }, [dailyStats]);

  if (!chartData || dailyStats.length === 0) {
    return (
      <Card className="border border-slate-200">
        <CardHeader>
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-500" />
            Активность по дням
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-slate-500">
            Недостаточно данных для графика
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-slate-200">
      <CardHeader>
        <CardTitle className="text-xl font-bold flex items-center gap-2">
          <Activity className="h-5 w-5 text-blue-500" />
          Активность по дням
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="w-full overflow-x-auto">
          <svg 
            viewBox={`0 0 ${chartData.width} ${chartData.height}`} 
            className="w-full min-w-[600px]"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Grid lines */}
            {chartData.yTicks.map((tick, i) => (
              <g key={i}>
                <line
                  x1={chartData.padding.left}
                  y1={tick.y}
                  x2={chartData.width - chartData.padding.right}
                  y2={tick.y}
                  stroke="#e2e8f0"
                  strokeDasharray="4,4"
                />
              </g>
            ))}

            {/* Area */}
            <path
              d={chartData.areaPath}
              fill="url(#areaGradient)"
              opacity={0.3}
            />

            {/* Line */}
            <path
              d={chartData.linePath}
              fill="none"
              stroke="#3b82f6"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Data points */}
            {chartData.dots.map((dot, i) => (
              <g key={i}>
                <circle
                  cx={dot.x}
                  cy={dot.y}
                  r={4}
                  fill="#3b82f6"
                  stroke="white"
                  strokeWidth={2}
                />
                <title>
                  {formatDate(dailyStats[i].date)}: {dot.steps.toLocaleString()} шагов ({dot.participants} участников)
                </title>
              </g>
            ))}

            {/* Y-axis labels */}
            {chartData.yTicks.map((tick, i) => (
              <text
                key={i}
                x={chartData.padding.left - 10}
                y={tick.y + 4}
                textAnchor="end"
                className="text-xs fill-slate-500"
              >
                {formatNumber(tick.value)}
              </text>
            ))}

            {/* X-axis labels */}
            {chartData.xLabels.map((label, i) => (
              <text
                key={i}
                x={label.x}
                y={chartData.height - 10}
                textAnchor="middle"
                className="text-xs fill-slate-500"
                transform={`rotate(-30, ${label.x}, ${chartData.height - 10})`}
              >
                {label.label}
              </text>
            ))}

            {/* Gradient */}
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05} />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}

function formatDate(dateStr: string): string {
  try {
    const parts = dateStr.split('-');
    return `${parts[2]}.${parts[1]}`;
  } catch {
    return dateStr;
  }
}

function formatNumber(num: number): string {
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}
