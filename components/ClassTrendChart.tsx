'use client';

import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

export default function ClassTrendChart({ data }: { data: { day: string; accuracy: number }[] }) {
  return (
    <section className="bg-white/80 backdrop-blur rounded-2xl shadow-card p-6 sm:p-8">
      <h2 className="text-[17px] font-semibold tracking-tight text-ink mb-1">Class average — last 6 weeks</h2>
      <p className="text-sm text-ink-muted mb-4">
        Whole-class daily reading accuracy, for context before drilling into individuals.
      </p>
      <div className="w-full h-52">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="class-trend-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0071e3" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#0071e3" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="day"
              tick={{ fontSize: 11, fill: '#6e6e73' }}
              tickFormatter={(d) => d.slice(5)}
              interval="preserveStartEnd"
              axisLine={{ stroke: '#e5e5e7' }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 1]}
              tick={{ fontSize: 11, fill: '#6e6e73' }}
              tickFormatter={(v) => `${Math.round(v * 100)}%`}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 13 }}
              formatter={(value: number) => [`${Math.round(value * 100)}%`, 'Accuracy']}
              labelFormatter={(d) => d}
            />
            <Area
              type="monotone"
              dataKey="accuracy"
              stroke="#0071e3"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              fill="url(#class-trend-gradient)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
