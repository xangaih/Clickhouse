'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, RefreshCw, Flag, Check, X, Loader2, AlertTriangle } from 'lucide-react';
import type { Proposal } from '@/lib/types';

function describe(p: Proposal) {
  switch (p.type) {
    case 'intervention':
      return {
        icon: <BookOpen size={15} className="text-accent" strokeWidth={1.75} />,
        title: `Pair with "${p.bookTitle ?? `book #${p.bookId}`}"`,
        description: p.note,
        confirmedSummary: `Confirmed — paired with "${p.bookTitle ?? `book #${p.bookId}`}"`,
      };
    case 'reassignment':
      return {
        icon: <RefreshCw size={15} className="text-accent" strokeWidth={1.75} />,
        title: `Reassign to "${p.bookTitle ?? `book #${p.newBookId}`}"`,
        description: p.reason,
        confirmedSummary: `Confirmed — reassigned to "${p.bookTitle ?? `book #${p.newBookId}`}"`,
      };
    case 'followup':
      return {
        icon: <Flag size={15} className="text-accent" strokeWidth={1.75} />,
        title: 'Flag for a personal check-in',
        description: p.reason,
        confirmedSummary: 'Confirmed — flagged for a personal check-in',
      };
  }
}

type Status = 'pending' | 'confirming' | 'confirmed' | 'dismissing' | 'dismissed' | 'error';

export default function ProposalCard({ proposal }: { proposal: Proposal }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('pending');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmedAt, setConfirmedAt] = useState<Date | null>(null);
  const { icon, title, description, confirmedSummary } = describe(proposal);

  async function confirm() {
    setStatus('confirming');
    setErrorMessage(null);
    try {
      let res: Response;
      if (proposal.type === 'intervention') {
        res = await fetch('/api/interventions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId: proposal.studentId, bookId: proposal.bookId, note: proposal.note }),
        });
      } else if (proposal.type === 'reassignment') {
        res = await fetch('/api/reassignments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId: proposal.studentId, bookId: proposal.newBookId }),
        });
      } else {
        res = await fetch('/api/followups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId: proposal.studentId, reason: proposal.reason }),
        });
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      setConfirmedAt(new Date());
      setStatus('confirmed');
      // Refetch server-rendered data (dashboard student cards, profile page sections)
      // so the confirmed change shows up elsewhere without a manual page reload.
      router.refresh();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong.');
      setStatus('error');
    }
  }

  async function dismiss() {
    setStatus('dismissing');
    setErrorMessage(null);
    try {
      const res = await fetch('/api/proposals/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: proposal.studentId, proposalType: proposal.type, detail: JSON.stringify(proposal) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      setStatus('dismissed');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong.');
      setStatus('error');
    }
  }

  const busy = status === 'confirming' || status === 'dismissing';

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

          {(status === 'pending' || status === 'confirming' || status === 'dismissing' || status === 'error') && (
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={confirm}
                disabled={busy}
                className="text-xs font-medium bg-accent text-white px-3 py-1 rounded-full hover:bg-accent-dark transition-colors disabled:opacity-70 flex items-center gap-1.5"
              >
                {status === 'confirming' ? (
                  <>
                    <Loader2 size={12} strokeWidth={2.5} className="animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Check size={12} strokeWidth={2.5} /> {status === 'error' ? 'Retry confirm' : 'Confirm'}
                  </>
                )}
              </button>
              <button
                onClick={dismiss}
                disabled={busy}
                className="text-xs font-medium text-ink-muted hover:text-ink transition-colors px-3 py-1 flex items-center gap-1.5 disabled:opacity-70"
              >
                {status === 'dismissing' ? (
                  <>
                    <Loader2 size={12} strokeWidth={2.5} className="animate-spin" />
                    Dismissing…
                  </>
                ) : (
                  <>
                    <X size={12} strokeWidth={2.5} /> Dismiss
                  </>
                )}
              </button>
            </div>
          )}

          <AnimatePresence>
            {status === 'error' && errorMessage && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-red-700 mt-2 flex items-start gap-1.5"
              >
                <AlertTriangle size={12} strokeWidth={2.5} className="mt-0.5 shrink-0" />
                {errorMessage}
              </motion.p>
            )}
            {status === 'confirmed' && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-emerald-700 mt-2 flex items-start gap-1.5"
              >
                <Check size={12} strokeWidth={2.5} className="mt-0.5 shrink-0" />
                <span>
                  {confirmedSummary}
                  {confirmedAt && (
                    <span className="text-ink-muted/70">
                      {' '}
                      · {confirmedAt.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </span>
                  )}
                </span>
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
