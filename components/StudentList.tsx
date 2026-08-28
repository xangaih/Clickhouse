'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import StudentCard from './StudentCard';
import type { StudentMetric } from '@/lib/types';

type SortKey = 'name' | 'recent' | 'decline';

function sortStudents(students: StudentMetric[], sortKey: SortKey): StudentMetric[] {
  const sorted = [...students];
  switch (sortKey) {
    case 'name':
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case 'recent':
      return sorted.sort((a, b) => a.recentAccuracy - b.recentAccuracy);
    case 'decline':
      return sorted.sort(
        (a, b) => (a.recentAccuracy - a.baselineAccuracy) - (b.recentAccuracy - b.baselineAccuracy)
      );
  }
}

export default function StudentList({ students }: { students: StudentMetric[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('decline');
  const [grouped, setGrouped] = useState(true);

  const { flagged, steady } = useMemo(() => {
    const flagged = sortStudents(students.filter((s) => s.flagged), sortKey);
    const steady = sortStudents(students.filter((s) => !s.flagged), sortKey);
    return { flagged, steady };
  }, [students, sortKey]);

  const flat = useMemo(() => sortStudents(students, sortKey), [students, sortKey]);

  return (
    <section>
      <div className="flex items-center justify-between mb-4 gap-4">
        <h2 className="text-[17px] font-semibold tracking-tight text-ink">Students</h2>
        <div className="flex items-center gap-3 text-sm">
          <label className="flex items-center gap-1.5 text-ink-muted">
            <input
              type="checkbox"
              checked={grouped}
              onChange={(e) => setGrouped(e.target.checked)}
              className="accent-accent"
            />
            Group by status
          </label>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="bg-white shadow-card border-0 rounded-full px-3 py-1.5 text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
          >
            <option value="decline">Sort: Decline (largest first)</option>
            <option value="recent">Sort: Recent accuracy (low to high)</option>
            <option value="name">Sort: Name (A-Z)</option>
          </select>
        </div>
      </div>

      {grouped ? (
        <div className="space-y-6">
          {flagged.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-2">
                Flagged ({flagged.length})
              </h3>
              <div className="space-y-3">
                {flagged.map((s, i) => (
                  <motion.div
                    key={s.studentId}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.03, ease: 'easeOut' }}
                    className="bg-white rounded-2xl shadow-elevated"
                  >
                    <StudentCard student={s} />
                  </motion.div>
                ))}
              </div>
            </div>
          )}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted/70 mb-2">
              Steady ({steady.length})
            </h3>
            <div className="divide-y divide-black/[0.04] bg-white rounded-2xl shadow-card">
              {steady.map((s) => (
                <StudentCard key={s.studentId} student={s} />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-black/[0.04] bg-white rounded-2xl shadow-card">
          {flat.map((s) => (
            <StudentCard key={s.studentId} student={s} />
          ))}
        </div>
      )}
    </section>
  );
}
