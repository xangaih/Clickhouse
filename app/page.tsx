import StudentList from '@/components/StudentList';
import AlertsPanel from '@/components/AlertsPanel';
import ClassTrendChart from '@/components/ClassTrendChart';
import WeeklyDigest from '@/components/WeeklyDigest';
import PageHeader from '@/components/PageHeader';
import SystemStatsStrip from '@/components/SystemStatsStrip';

export default async function Page() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
  const [studentsRes, classTrendRes, statsRes] = await Promise.all([
    fetch(`${baseUrl}/api/students`, { cache: 'no-store' }),
    fetch(`${baseUrl}/api/class-trend`, { cache: 'no-store' }),
    fetch(`${baseUrl}/api/system-stats`, { cache: 'no-store' }),
  ]);
  const students = studentsRes.ok ? await studentsRes.json() : [];
  const classTrend = classTrendRes.ok ? await classTrendRes.json() : [];
  const stats = statsRes.ok ? await statsRes.json() : null;

  return (
    <main className="max-w-5xl mx-auto px-6 py-12 sm:px-10 sm:py-16 space-y-10">
      <div>
        <PageHeader
          title="ReadPulse"
          subtitle="Room 12 — reading fluency overview"
          navHref="/library"
          navLabel="Library"
          navDirection="forward"
        />
        <SystemStatsStrip stats={stats} />
      </div>
      <ClassTrendChart data={classTrend} />
      <WeeklyDigest />
      <AlertsPanel />
      <StudentList students={students} />
    </main>
  );
}
