'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search } from 'lucide-react';
import ProposalCard from './ProposalCard';
import type { ChatMessage, Proposal } from '@/lib/types';

const TOOL_STATUS_LABELS: Record<string, string> = {
  get_accuracy_trend: 'Checking accuracy trend…',
  get_reading_history: 'Looking up reading history…',
  get_recent_sessions: 'Checking recent sessions…',
  get_session_detail: 'Looking at session detail…',
  get_book_recommendations: 'Finding book recommendations…',
  get_class_context: 'Comparing to the class…',
  get_engagement_pattern: 'Checking how often she reads…',
  propose_intervention: 'Drafting an intervention…',
  propose_book_reassignment: 'Drafting a reassignment…',
  propose_followup_flag: 'Drafting a follow-up flag…',
};

interface DisplayMessage extends ChatMessage {
  proposals?: Proposal[];
}

export default function StudentChat({ studentId }: { studentId: number }) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function send() {
    const question = input.trim();
    if (!question || loading) return;
    const nextMessages: DisplayMessage[] = [...messages, { role: 'user', content: question }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/students/${studentId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages }),
      });

      let finalReply = "Sorry, I couldn't answer that just now.";
      let finalProposals: Proposal[] = [];

      if (res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.trim()) continue;
            const event = JSON.parse(line);
            if (event.type === 'tool_call') {
              setStatus(TOOL_STATUS_LABELS[event.name] ?? 'Looking that up…');
            } else if (event.type === 'final') {
              finalReply = event.reply;
              finalProposals = Array.isArray(event.proposals) ? event.proposals : [];
            } else if (event.type === 'error') {
              finalReply = "Sorry, I couldn't answer that just now.";
            }
          }
        }
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: finalReply, proposals: finalProposals }]);
    } finally {
      setLoading(false);
      setStatus(null);
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-black/[0.06]">
      <div className="space-y-2 max-h-80 overflow-y-auto mb-2">
        {messages.length === 0 && (
          <p className="text-xs text-ink-muted">Ask a question about this student's reading data.</p>
        )}
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <div
                className={`text-sm rounded-2xl px-3 py-1.5 max-w-[85%] ${
                  m.role === 'user' ? 'bg-accent-light text-ink ml-auto' : 'bg-canvas text-ink'
                }`}
              >
                {m.content}
              </div>
              {m.proposals?.map((p, pi) => (
                <ProposalCard key={pi} proposal={p} />
              ))}
            </motion.div>
          ))}
        </AnimatePresence>
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="text-xs text-accent flex items-center gap-1.5"
            >
              <Search size={12} strokeWidth={2} className="shrink-0" />
              {status ?? 'Thinking…'}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="e.g. What should we do about this?"
          className="flex-1 text-sm bg-white shadow-card border-0 rounded-full px-3 py-1.5 text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="text-sm font-medium bg-accent text-white px-4 py-1.5 rounded-full hover:bg-accent-dark transition-colors disabled:opacity-50"
        >
          Ask
        </button>
      </div>
    </div>
  );
}
