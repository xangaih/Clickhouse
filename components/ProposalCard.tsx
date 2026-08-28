'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, RefreshCw, Flag, Check, X } from 'lucide-react';
import type { Proposal } from '@/lib/types';

function describe(p: Proposal) {
  switch (p.type) {
    case 'intervention':
      return {
        icon: <BookOpen size={15} className="text-accent" strokeWidth={1.75} />,
        title: `Pair with "${p.bookTitle ?? `book #${p.bookId}`}"`,
        description: p.note,
      };
    case 'reassignment':
      return {
        icon: <RefreshCw size={15} className="text-accent" strokeWidth={1.75} />,
        title: `Reassign to "${p.bookTitle ?? `book #${p.newBookId}`}"`,
        description: p.reason,
      };
    case 'followup':
      return {
        icon: <Flag size={15} className="text-accent" strokeWidth={1.75} />,
        title: 'Flag for a personal check-in',
        description: p.reason,
      };
  }
}

export default function ProposalCard({ proposal }: { proposal: Proposal }) {
  const [status, setStatus] = useState<'pending' | 'confirmed' | 'dismissed'>('pending');
  const [loading, setLoading] = useState(false);
  const { icon, title, description } = describe(proposal);

  async function confirm() {
    setLoading(true);
    try {
      if (proposal.type === 'intervention') {
        await fetch('/api/interventions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId: proposal.studentId, bookId: proposal.bookId, note: proposal.note }),
        });
      } else if (proposal.type === 'reassignment') {
        await fetch('/api/reassignments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId: proposal.studentId, bookId: proposal.newBookId }),
        });
      } else {
        await fetch('/api/followups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId: proposal.studentId, reason: proposal.reason }),
        });
      }
      setStatus('confirmed');
    } finally {
      setLoading(false);
    }
  }

  async function dismiss() {
    setLoading(true);
    try {
      await fetch('/api/proposals/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: proposal.studentId, proposalType: proposal.type, detail: JSON.stringify(proposal) }),
      });
      setStatus('dismissed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="mt-2 bg-white rounded-2xl shadow-card p-3"
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 shrink-0 w-7 h-7 rounded-lg bg-accent-light flex items-center justify-center">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">{title}</p>
          {description && <p className="text-xs text-ink-muted mt-0.5">{description}</p>}
          {status === 'pending' && (
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={confirm}
                disabled={loading}
                className="text-xs font-medium bg-accent text-white px-3 py-1 rounded-full hover:bg-accent-dark transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                <Check size={12} strokeWidth={2.5} /> Confirm
              </button>
              <button
                onClick={dismiss}
                disabled={loading}
                className="text-xs font-medium text-ink-muted hover:text-ink transition-colors px-3 py-1 flex items-center gap-1"
              >
                <X size={12} strokeWidth={2.5} /> Dismiss
              </button>
            </div>
          )}
          <AnimatePresence>
            {status === 'confirmed' && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-emerald-700 mt-2 flex items-center gap-1"
              >
                <Check size={12} strokeWidth={2.5} /> Confirmed
              </motion.p>
            )}
            {status === 'dismissed' && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-ink-muted mt-2">
                Dismissed
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
