import { notFound } from 'next/navigation';
import { TrendingDown, CheckCircle2, MessageCircle, LayoutGrid, CalendarOff } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import StudentTrendChart from '@/components/StudentTrendChart';
import StudentChat from '@/components/StudentChat';
import SessionHeatmap from '@/components/SessionHeatmap';
import SimulateSessionButton from '@/components/SimulateSessionButton';
import { accuracyNearDate } from '@/lib/accuracy';
import type { StudentMetric } from '@/lib/types';

export default async function StudentProfilePage({ params }: { params: { id: string } }) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
  const [studentsRes, sessionRes] = await Promise.all([
    fetch(`${baseUrl}/api/students`, { cache: 'no-store' }),
    fetch(`${baseUrl}/api/students/${params.id}/session`, { cache: 'no-store' }),
  ]);
  const students: StudentMetric[] = studentsRes.ok ? await studentsRes.json() : [];
  const student = students.find((s) => s.studentId === Number(params.id));
  if (!student) notFound();

  const sessionData = sessionRes.ok ? await sessionRes.json() : null;

  const recentPct = Math.round(student.recentAccuracy * 100);
  const baselinePct = Math.round(student.baselineAccuracy * 100);
  const beforeAccuracy = student.intervention
    ? accuracyNearDate(student.dailyAccuracy, student.intervention.createdAt)
    : null;
  const beforePct = beforeAccuracy !== null ? Math.round(beforeAccuracy * 100) : null;

  // Class percentile — reuses the student list this page already fetched to find
  // `student`, no separate query needed.
  const sortedAccuracies = students.map((s) => s.recentAccuracy).sort((a, b) => a - b);
  const rank = sortedAccuracies.filter((a) => a <= student.recentAccuracy).length;
  const percentile = Math.round((rank / sortedAccuracies.length) * 100);

  const subtitle = student.intervention
    ? 'Addressed — tracking recovery'
    : student.flagged
      ? 'Trending down — worth a closer look'
      : 'Reading steadily';

  return (
    <main className="max-w-3xl mx-auto px-6 py-12 sm:px-10 sm:py-16 space-y-6">
      <PageHeader title={student.name} subtitle={subtitle} navHref="/" navLabel="Back to dashboard" navDirection="back" />

      <section className="bg-white/80 backdrop-blur rounded-2xl shadow-card p-6 sm:p-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-baseline gap-3">
              <span className="text-[40px] font-bold tracking-tighter text-ink leading-none">{recentPct}%</span>
              <span className="text-sm text-ink-muted">recent accuracy · baseline {baselinePct}%</span>
            </div>
            <p className="text-xs text-ink-muted/70 mt-1">
              {percentile}th percentile in Room 12 (recent accuracy vs. all {sortedAccuracies.length} students)
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 justify-end">
            {student.intervention ? (
              <span className="text-xs font-medium bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                <CheckCircle2 size={13} strokeWidth={2} />
                Addressed{' '}
                {new Date(student.intervention.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
            ) : (
              student.flagged && (
                <span className="text-xs font-medium bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                  <TrendingDown size={13} strokeWidth={2} />
                  Trending down
                </span>
              )
            )}
            {student.readingLessOften && (
              <span className="text-xs font-medium bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                <CalendarOff size={13} strokeWidth={2} />
                Reading less often
              </span>
            )}
          </div>
        </div>
        <StudentTrendChart data={student.dailyAccuracy} />
        <div className="mt-4 pt-4 border-t border-black/[0.06]">
          <SimulateSessionButton studentId={student.studentId} />
        </div>
      </section>

      {student.intervention && (
        <section className="bg-emerald-50 rounded-2xl p-6 sm:p-8">
          <h2 className="text-[15px] font-semibold text-emerald-900 mb-1.5">Intervention</h2>
          <p className="text-sm text-emerald-900/80">
            Paired with <span className="font-medium">{student.intervention.bookTitle}</span>
            {student.intervention.note ? ` — ${student.intervention.note}` : ''}
          </p>
          {beforePct !== null && (
            <p className="text-sm text-emerald-900/80 mt-1">
              At intervention: {beforePct}% <span className="text-emerald-700">→</span> now: {recentPct}%
            </p>
          )}
        </section>
      )}

      <section className="bg-white/80 backdrop-blur rounded-2xl shadow-card p-6 sm:p-8">
        <h2 className="text-[17px] font-semibold tracking-tight text-ink flex items-center gap-2 mb-1">
          <MessageCircle size={17} className="text-accent" strokeWidth={1.75} />
          Ask about {student.name.split(' ')[0]}
        </h2>
        <StudentChat studentId={student.studentId} />
      </section>

      <section className="bg-white/80 backdrop-blur rounded-2xl shadow-card p-6 sm:p-8">
        <h2 className="text-[17px] font-semibold tracking-tight text-ink flex items-center gap-2 mb-3">
          <LayoutGrid size={17} className="text-accent" strokeWidth={1.75} />
          Last session
        </h2>
        <SessionHeatmap events={sessionData?.events ?? []} />
      </section>
    </main>
  );
}
