'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BellRing } from 'lucide-react';
import BookCard from './BookCard';
import MarkAddressed from './MarkAddressed';
import type { AgentAlert } from '@/lib/types';

export default function AlertsPanel() {
  const [alerts, setAlerts] = useState<AgentAlert[]>([]);
  const [loading, setLoading] = useState(false);

  async function runAgent() {
    setLoading(true);
    try {
      const res = await fetch('/api/agent/run', { method: 'POST' });
      const data = await res.json();
      setAlerts(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="bg-white/80 backdrop-blur rounded-2xl shadow-card p-6 sm:p-8">
      <div className="flex items-center justify-between mb-4 gap-4">
        <h2 className="text-[17px] font-semibold tracking-tight text-ink flex items-center gap-2">
          <BellRing size={18} className="text-accent" strokeWidth={1.75} />
          Alerts
        </h2>
        <button
          onClick={runAgent}
          disabled={loading}
          className="text-sm font-medium bg-accent text-white px-4 py-2 rounded-full hover:bg-accent-dark transition-colors disabled:opacity-50 shrink-0"
        >
          {loading ? 'Running…' : 'Run agent'}
        </button>
      </div>
      {alerts.length === 0 ? (
        <p className="text-ink-muted text-sm">No alerts yet — click "Run agent".</p>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {alerts.map((a, i) => (
              <motion.div
                key={a.studentId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.04, ease: 'easeOut' }}
                className="rounded-2xl bg-canvas/60 p-4"
              >
                <p className="text-[15px] text-ink">{a.alertText}</p>
                <BookCard book={a.recommendedBook} reason={a.reason} />
                <MarkAddressed studentId={a.studentId} bookId={a.recommendedBookId} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}
