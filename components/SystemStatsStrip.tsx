import { Database, Users, Zap } from 'lucide-react';

interface Stats {
  totalEvents: number;
  studentsTracked: number;
  declineQueryMs: number;
}

export default function SystemStatsStrip({ stats }: { stats: Stats | null }) {
  if (!stats) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-xs text-ink-muted mt-4 px-1">
      <span className="flex items-center gap-1.5">
        <Database size={13} strokeWidth={1.75} className="text-accent" />
        {stats.totalEvents.toLocaleString()} reading events analyzed
      </span>
      <span className="flex items-center gap-1.5">
        <Users size={13} strokeWidth={1.75} className="text-accent" />
        {stats.studentsTracked} students tracked
      </span>
      <span className="flex items-center gap-1.5">
        <Zap size={13} strokeWidth={1.75} className="text-accent" />
        Decline analysis across {stats.totalEvents.toLocaleString()}+ events: {stats.declineQueryMs}ms
      </span>
      <span className="text-ink-muted/60 basis-full sm:basis-auto">
        Powered by ClickHouse Cloud (analytics) + Postgres managed by ClickHouse (roster) + Claude (agent)
      </span>
    </div>
  );
}
