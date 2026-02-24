import { useParams } from 'react-router-dom';

export function ToolDetailPage() {
  const { toolId } = useParams<{ toolId: string }>();

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-xl font-semibold">Tool Detail</h2>
      <p className="mt-2 text-sm text-slate-600">Tool Detail page placeholder.</p>
      <p className="mt-1 text-sm text-slate-500">Route param: {toolId ?? 'none'}</p>
    </section>
  );
}
