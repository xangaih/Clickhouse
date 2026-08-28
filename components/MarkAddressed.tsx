'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';

export default function MarkAddressed({ studentId, bookId }: { studentId: number; bookId: number }) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      const res = await fetch('/api/interventions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, bookId, note: note.trim() || null }),
      });
      if (res.ok) {
        setDone(true);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <motion.p
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="mt-2 text-xs text-emerald-700 flex items-center gap-1.5"
      >
        <CheckCircle2 size={14} strokeWidth={1.75} />
        Marked addressed
      </motion.p>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note (e.g. paired with easier book)"
        className="flex-1 text-xs bg-white border-0 shadow-card rounded-full px-3 py-1.5 text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
      />
      <button
        onClick={submit}
        disabled={loading}
        className="text-xs font-medium bg-ink text-white px-3 py-1.5 rounded-full hover:bg-ink/85 transition-colors disabled:opacity-50 shrink-0"
      >
        {loading ? 'Saving…' : 'Mark addressed'}
      </button>
    </div>
  );
}
