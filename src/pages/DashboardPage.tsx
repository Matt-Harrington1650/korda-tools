import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { DashboardToolbar } from '../features/tools/components/DashboardToolbar';
import { ToolCollection } from '../features/tools/components/ToolCollection';
import { useToolRegistryStore } from '../features/tools/store/toolRegistryStore';

const RECENT_ACTIVITY = [
  { id: 'act-1', label: 'Weather Snapshot API status changed to configured', time: '5m ago' },
  { id: 'act-2', label: 'Task Sync Endpoint was edited', time: '42m ago' },
  { id: 'act-3', label: 'Release Notify Webhook was created', time: '2h ago' },
];

export function DashboardPage() {
  const tools = useToolRegistryStore((state) => state.tools);
  const filters = useToolRegistryStore((state) => state.filters);
  const loadTools = useToolRegistryStore((state) => state.loadTools);
  const setSearch = useToolRegistryStore((state) => state.setSearch);
  const setCategory = useToolRegistryStore((state) => state.setCategory);
  const toggleTag = useToolRegistryStore((state) => state.toggleTag);
  const setViewMode = useToolRegistryStore((state) => state.setViewMode);

  useEffect(() => {
    loadTools();
  }, [loadTools]);

  const categories = useMemo(() => {
    return Array.from(new Set(tools.map((tool) => tool.category))).sort((a, b) => a.localeCompare(b));
  }, [tools]);

  const availableTags = useMemo(() => {
    return Array.from(new Set(tools.flatMap((tool) => tool.tags))).sort((a, b) => a.localeCompare(b));
  }, [tools]);

  const filteredTools = useMemo(() => {
    const searchNeedle = filters.search.trim().toLowerCase();

    return tools.filter((tool) => {
      const matchesSearch =
        searchNeedle.length === 0 ||
        [tool.name, tool.description, tool.type, tool.category, ...tool.tags]
          .join(' ')
          .toLowerCase()
          .includes(searchNeedle);

      const matchesCategory = !filters.category || tool.category === filters.category;
      const matchesTags = filters.tags.every((tag) => tool.tags.includes(tag));

      return matchesSearch && matchesCategory && matchesTags;
    });
  }, [filters.category, filters.search, filters.tags, tools]);

  return (
    <div className="space-y-4">
      <DashboardToolbar
        categories={categories}
        onCategoryChange={setCategory}
        onSearchChange={setSearch}
        onToggleTag={toggleTag}
        onViewModeChange={setViewMode}
        search={filters.search}
        selectedCategory={filters.category}
        selectedTags={filters.tags}
        tags={availableTags}
        viewMode={filters.viewMode}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="space-y-3 lg:col-span-2">
          {filteredTools.length > 0 ? (
            <ToolCollection layout={filters.viewMode} tools={filteredTools} />
          ) : (
            <EmptyState
              action={
                <Link className="inline-flex rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800" to="/tools/new">
                  Add Tool
                </Link>
              }
              message="Adjust search/filter settings or add a new tool."
              title="No tools match your filters"
            />
          )}
        </section>

        <aside className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="text-base font-semibold text-slate-900">Recent Activity</h3>
          <p className="mt-1 text-sm text-slate-600">Latest registry events.</p>
          <ul className="mt-4 space-y-3">
            {RECENT_ACTIVITY.map((item) => (
              <li className="rounded-md border border-slate-200 p-3" key={item.id}>
                <p className="text-sm text-slate-800">{item.label}</p>
                <p className="mt-1 text-xs text-slate-500">{item.time}</p>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
