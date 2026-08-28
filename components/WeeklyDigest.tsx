'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';

export default function WeeklyDigest() {
  const [digest, setDigest] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch('/api/agent/digest', { method: 'POST' });
      const data = await res.json();
      setDigest(res.ok ? data.digest : "Couldn't generate the briefing just now.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="bg-white/80 backdrop-blur rounded-2xl shadow-card p-6 sm:p-8">
      <div className="flex items-center justify-between mb-2 gap-4">
        <h2 className="text-[17px] font-semibold tracking-tight text-ink flex items-center gap-2">
          <Sparkles size={18} className="text-accent" strokeWidth={1.75} />
          Monday briefing
        </h2>
        <button
          onClick={generate}
          disabled={loading}
          className="text-sm font-medium bg-accent text-white px-4 py-2 rounded-full hover:bg-accent-dark transition-colors disabled:opacity-50 shrink-0"
        >
          {loading ? 'Generating…' : 'Generate briefing'}
        </button>
      </div>
      <AnimatePresence mode="wait">
        {digest ? (
          <motion.p
            key="digest"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="text-[15px] text-ink/80 leading-relaxed mt-2"
          >
            {digest}
          </motion.p>
        ) : (
          !loading && (
            <p className="text-sm text-ink-muted mt-2">
              A 15-second summary before class: who's new to the flagged list, who's recovering, and the overall class trend.
            </p>
          )
        )}
      </AnimatePresence>
    </section>
  );
}
