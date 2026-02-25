import { Link } from 'react-router-dom';
import type { Tool } from '../../../domain/tool';
import { formatTimestamp } from '../../../lib/dates';

type ToolCardProps = {
  tool: Tool;
  compact?: boolean;
};

const STATUS_STYLES: Record<Tool['status'], string> = {
  configured: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  missing_credentials: 'bg-amber-100 text-amber-700 border border-amber-200',
  disabled: 'bg-rose-100 text-rose-700 border border-rose-200',
};

export function ToolCard({ tool, compact = false }: ToolCardProps) {
  return (
    <article
      className={[
        'rounded-lg border border-slate-200 bg-white p-4 transition hover:border-slate-300',
        compact ? 'flex items-center justify-between gap-4' : 'space-y-4',
      ].join(' ')}
    >
      <div className={compact ? 'min-w-0 flex-1' : ''}>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold text-slate-900">{tool.name}</h3>
          <span className={[`rounded px-2 py-0.5 text-xs font-medium`, STATUS_STYLES[tool.status]].join(' ')}>
            {tool.status}
          </span>
        </div>
        <p className="mt-2 text-sm text-slate-600">{tool.description || 'No description provided yet.'}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded bg-slate-100 px-2 py-1 font-medium text-slate-700">{tool.type}</span>
          <span className="rounded bg-slate-100 px-2 py-1 font-medium text-slate-700">{tool.category}</span>
          {tool.tags.map((tag) => (
            <span className="rounded bg-slate-50 px-2 py-1 text-slate-600" key={tag}>
              #{tag}
            </span>
          ))}
        </div>
      </div>

      <div className={compact ? 'text-right' : 'flex items-center justify-between'}>
        <p className="text-xs text-slate-500">Updated {formatTimestamp(tool.updatedAt)}</p>
        <Link
          className="inline-flex items-center rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-800"
          to={`/registry/${tool.id}`}
        >
          Open
        </Link>
      </div>
    </article>
  );
}
