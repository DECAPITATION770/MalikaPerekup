/**
 * Tiny success-tinted sparkline for the «Прибыль сегодня» KPI footer.
 *
 * Extracted out of Today.tsx so the recharts bundle (~40 KB) stays out of the
 * Today route's initial paint — Today lazy-imports this module only when the
 * 7-day series has at least one non-zero point. Same component, same render
 * — just a separate chunk.
 */
import { Area, AreaChart, ResponsiveContainer } from 'recharts';

export interface ProfitSparkPoint {
  day: string;
  profit: number;
}

export function ProfitSpark({ data }: { data: ProfitSparkPoint[] }) {
  return (
    <div className="-mx-1 h-9">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 0 }}>
          <defs>
            <linearGradient id="today-spark" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(var(--c-success))" stopOpacity={0.4} />
              <stop offset="100%" stopColor="rgb(var(--c-success))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="profit"
            stroke="rgb(var(--c-success))"
            strokeWidth={2}
            fill="url(#today-spark)"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
