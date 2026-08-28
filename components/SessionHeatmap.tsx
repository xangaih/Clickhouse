'use client';

type SessionEvent = { word_index: number; is_correct: number; hesitation_ms: number };

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export default function SessionHeatmap({ events }: { events: SessionEvent[] }) {
  if (events.length === 0) {
    return <p className="text-xs text-ink-muted">No session data.</p>;
  }

  const hesitationMedian = median(events.map((e) => e.hesitation_ms));

  function colorFor(e: SessionEvent): string {
    if (!e.is_correct) return 'bg-red-400/80';
    return e.hesitation_ms > hesitationMedian ? 'bg-amber-400/80' : 'bg-emerald-400/80';
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1">
        {events.map((e) => (
          <div
            key={e.word_index}
            title={`word ${e.word_index} · ${e.hesitation_ms}ms`}
            className={`w-3.5 h-3.5 rounded ${colorFor(e)}`}
          />
        ))}
      </div>
      <div className="flex items-center gap-3 mt-3 text-xs text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-emerald-400/80 inline-block" /> correct &amp; quick
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-amber-400/80 inline-block" /> correct but slow
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-red-400/80 inline-block" /> incorrect
        </span>
      </div>
    </div>
  );
}
