import LibraryTable from '@/components/LibraryTable';
import PageHeader from '@/components/PageHeader';

export default async function LibraryPage() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'}/api/library`, {
    cache: 'no-store',
  });
  const books = res.ok ? await res.json() : [];

  return (
    <main className="max-w-5xl mx-auto px-6 py-12 sm:px-10 sm:py-16 space-y-8">
      <PageHeader
        title="Library"
        subtitle="Which books students actually recover with"
        navHref="/"
        navLabel="Back to dashboard"
        navDirection="back"
      />
      <LibraryTable books={books} />
    </main>
  );
}
