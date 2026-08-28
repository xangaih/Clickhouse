'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { BookEffectiveness } from '@/lib/types';

type SortKey = 'recovery_delta' | 'title' | 'reading_level';

export default function LibraryTable({ books }: { books: BookEffectiveness[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('recovery_delta');

  const sorted = useMemo(() => {
    const copy = [...books];
    switch (sortKey) {
      case 'title':
        return copy.sort((a, b) => a.title.localeCompare(b.title));
      case 'reading_level':
        return copy.sort((a, b) => a.reading_level - b.reading_level);
      case 'recovery_delta':
      default:
        return copy.sort((a, b) => b.recovery_delta - a.recovery_delta);
    }
  }, [books, sortKey]);

  return (
    <div>
      <div className="flex items-center justify-end mb-3">
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="bg-white shadow-card border-0 rounded-full px-3 py-1.5 text-sm text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
        >
          <option value="recovery_delta">Sort: Recovery (best first)</option>
          <option value="title">Sort: Title (A-Z)</option>
          <option value="reading_level">Sort: Reading level</option>
        </select>
      </div>
      <div className="overflow-x-auto bg-white/80 backdrop-blur rounded-2xl shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink-muted">
              <th className="p-4 pb-3 font-medium">Title</th>
              <th className="p-4 pb-3 font-medium">Level</th>
              <th className="p-4 pb-3 font-medium">Tags</th>
              <th className="p-4 pb-3 font-medium">First week</th>
              <th className="p-4 pb-3 font-medium">Recent</th>
              <th className="p-4 pb-3 font-medium">Recovery</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((b, i) => (
              <motion.tr
                key={b.book_id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: i * 0.02, ease: 'easeOut' }}
                className="border-t border-black/[0.04]"
              >
                <td className="p-4 font-medium text-ink">{b.title}</td>
                <td className="p-4 text-ink-muted">{b.reading_level.toFixed(1)}</td>
                <td className="p-4">
                  <div className="flex flex-wrap gap-1">
                    {b.topic_tags.map((tag) => (
                      <span key={tag} className="text-xs bg-canvas text-ink-muted px-2 py-0.5 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="p-4 text-ink-muted">{Math.round(b.avg_first_week_accuracy * 100)}%</td>
                <td className="p-4 text-ink-muted">{Math.round(b.avg_recent_accuracy * 100)}%</td>
                <td className="p-4">
                  <span
                    className={`font-medium flex items-center gap-1 whitespace-nowrap ${
                      b.recovery_delta >= 0 ? 'text-emerald-700' : 'text-red-700'
                    }`}
                  >
                    {b.recovery_delta >= 0 ? (
                      <TrendingUp size={14} strokeWidth={2} />
                    ) : (
                      <TrendingDown size={14} strokeWidth={2} />
                    )}
                    {b.recovery_delta >= 0 ? '+' : ''}
                    {Math.round(b.recovery_delta * 100)}pts
                  </span>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
