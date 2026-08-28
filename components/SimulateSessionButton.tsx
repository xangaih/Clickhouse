'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { PlayCircle, CheckCircle2 } from 'lucide-react';

export default function SimulateSessionButton({ studentId }: { studentId: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [simulating, setSimulating] = useState(false);
  const [result, setResult] = useState<{ wordCount: number; accuracy: number } | null>(null);

  async function simulate() {
    setSimulating(true);
    setResult(null);
    try {
      const res = await fetch('/api/demo/simulate-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ wordCount: data.wordCount, accuracy: data.accuracy });
        startTransition(() => {
          router.refresh();
        });
      }
    } finally {
      setSimulating(false);
    }
  }

  const busy = simulating || isPending;

  return (
    <div>
      <button
        onClick={simulate}
        disabled={busy}
        className="text-sm font-medium bg-ink text-white px-4 py-2 rounded-full hover:bg-ink/85 transition-colors disabled:opacity-50 flex items-center gap-2"
      >
        <PlayCircle size={15} strokeWidth={1.75} />
        {simulating ? 'Simulating…' : isPending ? 'New session recorded — updating trend…' : "Simulate today's reading session"}
      </button>
      <AnimatePresence>
        {result && !busy && (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="text-xs text-emerald-700 mt-2 flex items-center gap-1.5"
          >
            <CheckCircle2 size={13} strokeWidth={2} />
            Logged {result.wordCount} words at {Math.round(result.accuracy * 100)}% accuracy — trend updated above.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
