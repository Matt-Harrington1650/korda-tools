import { Link } from 'react-router-dom';
import { EmptyState } from '../../../components/EmptyState';
import type { Tool } from '../../../domain/tool';
import type { DashboardLayout } from '../store/toolRegistryStore';
import { ToolCard } from './ToolCard';

type ToolCollectionProps = {
  tools: Tool[];
  layout: DashboardLayout;
};

export function ToolCollection({ tools, layout }: ToolCollectionProps) {
  if (!tools.length) {
    return (
      <EmptyState
        title="No tools in registry"
        message="Create your first tool to start testing connections and tracking status."
        action={
          <Link className="inline-flex rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-500" to="/tools/new">
            Add Tool
          </Link>
        }
      />
    );
  }

  if (layout === 'list') {
    return (
      <div className="space-y-3">
        {tools.map((tool) => (
          <ToolCard key={tool.id} compact tool={tool} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {tools.map((tool) => (
        <ToolCard key={tool.id} tool={tool} />
      ))}
    </div>
  );
}
