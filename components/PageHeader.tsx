import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';

export default function PageHeader({
  title,
  subtitle,
  navHref,
  navLabel,
  navDirection = 'forward',
}: {
  title: string;
  subtitle: string;
  navHref?: string;
  navLabel?: string;
  navDirection?: 'forward' | 'back';
}) {
  return (
    <header className="mb-10 pb-8 border-b border-black/[0.06] flex items-end justify-between gap-6 flex-wrap">
      <div>
        <h1 className="text-[34px] sm:text-[40px] font-bold tracking-tighter text-ink leading-none">
          {title}
        </h1>
        <p className="text-[15px] sm:text-base text-ink-muted font-normal mt-2.5">{subtitle}</p>
      </div>
      {navHref && navLabel && (
        <Link
          href={navHref}
          className="text-sm font-medium text-accent hover:text-accent-dark transition-colors flex items-center gap-1.5 shrink-0 mb-1"
        >
          {navDirection === 'back' && <ArrowLeft size={15} strokeWidth={2} />}
          {navLabel}
          {navDirection === 'forward' && <ArrowRight size={15} strokeWidth={2} />}
        </Link>
      )}
    </header>
  );
}
