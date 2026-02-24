import { Link } from 'react-router-dom';
import type { Tool } from '../../../domain/tool';
import { formatTimestamp } from '../../../lib/dates';

type ToolCardProps = {
  tool: Tool;
  compact?: boolean;
};

const STATUS_STYLES: Record<Tool['status'], string> = {
  healthy: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
  degraded: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
  offline: 'bg-rose-500/20 text-rose-300 border border-rose-500/40',
};

export function ToolCard({ tool, compact = false }: ToolCardProps) {
  return (
    <article
      className={[
        'rounded-lg border border-slate-800 bg-slate-950/70 p-4 transition hover:border-slate-700 hover:bg-slate-900/80',
        compact ? 'flex items-center justify-between gap-4' : 'space-y-4',
      ].join(' ')}
    >
      <div className={compact ? 'min-w-0 flex-1' : ''}>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold text-white">{tool.name}</h3>
          <span className={[`rounded px-2 py-0.5 text-xs font-medium`, STATUS_STYLES[tool.status]].join(' ')}>
            {tool.status}
          </span>
        </div>
        <p className="mt-2 text-sm text-slate-300">{tool.description || 'No description provided yet.'}</p>
        <p className="mt-2 text-xs uppercase tracking-wide text-slate-500">{tool.type} tool</p>
        <p className="mt-1 truncate text-xs text-slate-400">{tool.endpoint}</p>
      </div>

      <div className={compact ? 'text-right' : 'flex items-center justify-between'}>
        <p className="text-xs text-slate-500">Updated {formatTimestamp(tool.updatedAt)}</p>
        <Link
          className="inline-flex items-center rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-500"
          to={`/tools/${tool.id}`}
        >
          Open
        </Link>
      </div>
    </article>
  );
}
