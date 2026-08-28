import { BookOpen } from 'lucide-react';
import type { AgentAlert } from '@/lib/types';

export default function BookCard({
  book,
  reason,
}: {
  book: AgentAlert['recommendedBook'];
  reason: string;
}) {
  return (
    <div className="mt-3 text-sm bg-white rounded-xl shadow-card p-3">
      {book ? (
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 shrink-0 w-7 h-7 rounded-lg bg-accent-light flex items-center justify-center">
            <BookOpen size={15} className="text-accent" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <span className="font-medium text-ink">{book.title}</span>
            <span className="text-ink-muted"> · level {book.readingLevel.toFixed(1)}</span>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {book.topicTags.map((tag) => (
                <span key={tag} className="text-xs bg-canvas text-ink-muted px-2 py-0.5 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <span className="font-medium text-ink-muted">Recommended book unavailable</span>
      )}
      <p className="text-ink-muted mt-2">{reason}</p>
    </div>
  );
}
