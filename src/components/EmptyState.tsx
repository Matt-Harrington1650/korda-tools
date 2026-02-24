import type { ReactNode } from 'react';

type EmptyStateProps = {
  title: string;
  message: string;
  action?: ReactNode;
};

export function EmptyState({ title, message, action }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/60 p-8 text-center">
      <h3 className="text-lg font-medium text-slate-100">{title}</h3>
      <p className="mt-2 text-sm text-slate-400">{message}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
