'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingDown, CheckCircle2, MessageCircle, LayoutGrid, CalendarOff, Flag } from 'lucide-react';
import Sparkline from './Sparkline';
import StudentChat from './StudentChat';
import SessionHeatmap from './SessionHeatmap';
import { accuracyNearDate } from '@/lib/accuracy';
import type { StudentMetric } from '@/lib/types';

type SessionEvent = { word_index: number; is_correct: number; hesitation_ms: number };

export default function StudentCard({ student: s }: { student: StudentMetric }) {
  const [chatOpen, setChatOpen] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [sessionEvents, setSessionEvents] = useState<SessionEvent[] | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);

  const recentPct = Math.round(s.recentAccuracy * 100);
  const baselinePct = Math.round(s.baselineAccuracy * 100);
  const deltaPts = recentPct - baselinePct;

  async function toggleSession() {
    const opening = !sessionOpen;
    setSessionOpen(opening);
    if (opening && sessionEvents === null) {
      setSessionLoading(true);
      try {
        const res = await fetch(`/api/students/${s.studentId}/session`);
        const data = await res.json();
        setSessionEvents(res.ok ? data.events : []);
      } finally {
        setSessionLoading(false);
      }
    }
  }

  const beforeAccuracy = s.intervention ? accuracyNearDate(s.dailyAccuracy, s.intervention.createdAt) : null;
  const afterPct = recentPct;
  const beforePct = beforeAccuracy !== null ? Math.round(beforeAccuracy * 100) : null;

  return (
    <div className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <Link
            href={`/students/${s.studentId}`}
            className="font-medium text-ink hover:text-accent transition-colors"
          >
            {s.name}
          </Link>
          {s.flagged ? (
            <p className="text-sm text-ink-muted mt-0.5">
              {baselinePct}% <span className="text-ink-muted/60">→</span> {recentPct}%{' '}
              <span className={deltaPts < 0 ? 'text-amber-700' : 'text-emerald-700'}>
                ({deltaPts > 0 ? '+' : ''}{deltaPts}pts)
              </span>
            </p>
          ) : (
            <p className="text-sm text-ink-muted mt-0.5">{recentPct}% recent accuracy</p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Sparkline data={s.dailyAccuracy} />
          <div className="flex flex-wrap items-center gap-1.5 justify-end max-w-[9rem]">
            {s.intervention ? (
              <span className="text-xs font-medium bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full flex items-center gap-1 whitespace-nowrap">
                <CheckCircle2 size={13} strokeWidth={2} />
                Addressed {new Date(s.intervention.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
            ) : (
              s.flagged && (
                <span className="text-xs font-medium bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full flex items-center gap-1 whitespace-nowrap">
                  <TrendingDown size={13} strokeWidth={2} />
                  Trending down
                </span>
              )
            )}
            {s.readingLessOften && (
              <span className="text-xs font-medium bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full flex items-center gap-1 whitespace-nowrap">
                <CalendarOff size={13} strokeWidth={2} />
                Reading less often
              </span>
            )}
            {s.needsFollowup && (
              <span className="text-xs font-medium bg-orange-100 text-orange-800 px-2.5 py-1 rounded-full flex items-center gap-1 whitespace-nowrap">
                <Flag size={13} strokeWidth={2} />
                Follow-up
              </span>
            )}
          </div>
        </div>
      </div>
      {s.intervention && (
        <div className="mt-3 text-xs bg-emerald-50 rounded-xl px-3 py-2 text-emerald-900">
          Paired with <span className="font-medium">{s.intervention.bookTitle}</span>
          {s.intervention.note ? ` — ${s.intervention.note}` : ''}
          {beforePct !== null && (
            <span className="block mt-0.5">
              At intervention: {beforePct}% <span className="text-emerald-700">→</span> now: {afterPct}%
            </span>
          )}
        </div>
      )}
      {s.needsFollowup && (
        <div className="mt-3 text-xs bg-orange-50 rounded-xl px-3 py-2 text-orange-900">
          {s.needsFollowupReason ?? 'Flagged for a personal check-in.'}
        </div>
      )}
      {s.currentBook && (
        <div className="mt-3 text-xs text-ink-muted">
          Currently reading <span className="font-medium text-ink">{s.currentBook.title}</span>
        </div>
      )}
      <div className="flex items-center gap-4 mt-3">
        <button
          onClick={() => setChatOpen((v) => !v)}
          className="text-xs font-medium text-accent hover:text-accent-dark transition-colors flex items-center gap-1.5"
        >
          <MessageCircle size={14} strokeWidth={1.75} />
          {chatOpen ? 'Hide chat' : 'Ask about this student'}
        </button>
        {s.flagged && (
          <button
            onClick={toggleSession}
            className="text-xs font-medium text-accent hover:text-accent-dark transition-colors flex items-center gap-1.5"
          >
            <LayoutGrid size={14} strokeWidth={1.75} />
            {sessionOpen ? 'Hide last session' : 'See last session'}
          </button>
        )}
      </div>
      <AnimatePresence initial={false}>
        {chatOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <StudentChat studentId={s.studentId} />
          </motion.div>
        )}
        {sessionOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-black/[0.06]">
              {sessionLoading ? (
                <p className="text-xs text-ink-muted">Loading session…</p>
              ) : (
                <SessionHeatmap events={sessionEvents ?? []} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
