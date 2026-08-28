'use client';

import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';

export default function Sparkline({ data }: { data: { day: string; accuracy: number }[] }) {
  const gradientId = `sparkline-gradient-${Math.random().toString(36).slice(2)}`;
  return (
    <div className="w-32 h-10">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0071e3" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#0071e3" stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis domain={[0, 1]} hide />
          <Area
            type="monotone"
            dataKey="accuracy"
            stroke="#0071e3"
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill={`url(#${gradientId})`}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
