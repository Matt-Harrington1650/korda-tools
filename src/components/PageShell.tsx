import type { PropsWithChildren, ReactNode } from 'react';

type PageShellProps = PropsWithChildren<{
  title: string;
  description: string;
  actions?: ReactNode;
}>;

export function PageShell({ title, description, actions, children }: PageShellProps) {
  return (
    <section className="space-y-6 rounded-xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">{title}</h2>
          <p className="mt-1 text-sm text-slate-400">{description}</p>
        </div>
        {actions ? <div>{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}
