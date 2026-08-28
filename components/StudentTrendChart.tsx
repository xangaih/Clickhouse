'use client';

import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';

type DailyPoint = { day: string; accuracy: number };

const PROJECTION_LOOKBACK_DAYS = 7;
const PROJECTION_FORWARD_DAYS = 10; // ~2 school weeks

// Simple least-squares slope over the last week of real data, extrapolated
// forward — clearly labeled as "if this trend continues," not a forecast.
function buildProjection(data: DailyPoint[]) {
  if (data.length < 2) return [];
  const recent = data.slice(-PROJECTION_LOOKBACK_DAYS);
  const n = recent.length;
  const xs = recent.map((_, i) => i);
  const ys = recent.map((d) => d.accuracy);
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (ys[i] - yMean);
    den += (xs[i] - xMean) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;

  const lastDay = new Date(data[data.length - 1].day);
  const lastAccuracy = data[data.length - 1].accuracy;
  const points: DailyPoint[] = [];
  for (let i = 1; i <= PROJECTION_FORWARD_DAYS; i++) {
    const d = new Date(lastDay);
    d.setDate(d.getDate() + i);
    const value = Math.min(1, Math.max(0, lastAccuracy + slope * i));
    points.push({ day: d.toISOString().slice(0, 10), accuracy: value });
  }
  return points;
}

export default function StudentTrendChart({ data }: { data: DailyPoint[] }) {
  const projection = buildProjection(data);
  const bridge = data.length > 0 ? [{ day: data[data.length - 1].day, projectedAccuracy: data[data.length - 1].accuracy }] : [];
  const merged = [
    ...data.map((d) => ({ day: d.day, accuracy: d.accuracy })),
    ...bridge,
    ...projection.map((d) => ({ day: d.day, projectedAccuracy: d.accuracy })),
  ];

  return (
    <div>
      <div className="w-full h-56 mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={merged} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="student-trend-gradient" x1="0" y1="0" x2="0" y2="1">
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
              formatter={(value: number, name: string) => [
                `${Math.round(value * 100)}%`,
                name === 'projectedAccuracy' ? 'Projected' : 'Accuracy',
              ]}
              labelFormatter={(d) => d}
            />
            <Area
              type="monotone"
              dataKey="accuracy"
              stroke="#0071e3"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              fill="url(#student-trend-gradient)"
              dot={false}
              connectNulls
            />
            <Area
              type="monotone"
              dataKey="projectedAccuracy"
              stroke="#0071e3"
              strokeWidth={2}
              strokeDasharray="4 4"
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeOpacity={0.55}
              fill="none"
              dot={false}
              connectNulls
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-ink-muted/70 mt-1">
        Dashed: projected ~2 weeks forward from the last week's trend, if it continues — not a prediction.
      </p>
    </div>
  );
}
