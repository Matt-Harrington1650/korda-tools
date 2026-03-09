import type { ReactNode } from 'react';

type EmptyStateProps = {
  title: string;
  message: string;
  action?: ReactNode;
};

export function EmptyState({ title, message, action }: EmptyStateProps) {
  return (
    <div className="kt-panel-muted border-dashed p-8 text-center">
      <h3 className="text-lg font-medium text-[color:var(--kt-text-primary)]">{title}</h3>
      <p className="mt-2 text-sm text-[color:var(--kt-text-muted)]">{message}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
