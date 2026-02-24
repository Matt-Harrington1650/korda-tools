import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-xl font-semibold">Not Found</h2>
      <p className="mt-2 text-sm text-slate-600">The page you requested does not exist.</p>
      <Link className="mt-4 inline-flex rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white" to="/">
        Back to Dashboard
      </Link>
    </section>
  );
}
