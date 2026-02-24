import type { Tool } from '../../../domain/tool';
import type { DashboardLayout } from '../store/toolRegistryStore';
import { ToolCard } from './ToolCard';

type ToolCollectionProps = {
  tools: Tool[];
  layout: DashboardLayout;
};

export function ToolCollection({ tools, layout }: ToolCollectionProps) {
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
