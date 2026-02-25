import { Link } from 'react-router-dom';
import type { ViewMode } from '../store/toolRegistryStore';

type DashboardToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  categories: string[];
  selectedCategory: string | null;
  onCategoryChange: (value: string | null) => void;
  tags: string[];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (viewMode: ViewMode) => void;
};

export function DashboardToolbar({
  search,
  onSearchChange,
  categories,
  selectedCategory,
  onCategoryChange,
  tags,
  selectedTags,
  onToggleTag,
  viewMode,
  onViewModeChange,
}: DashboardToolbarProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Korda Tools</h2>
          <p className="text-sm text-slate-600">Browse and filter registered tools.</p>
        </div>
        <Link className="inline-flex rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800" to="/registry/new">
          Add Tool
        </Link>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-4">
        <label className="lg:col-span-2">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Search</span>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-0 transition focus:border-slate-500"
            onChange={(event) => {
              onSearchChange(event.target.value);
            }}
            placeholder="Search name, description, tags, or type"
            type="text"
            value={search}
          />
        </label>

        <label>
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Category</span>
          <select
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
            onChange={(event) => {
              onCategoryChange(event.target.value || null);
            }}
            value={selectedCategory ?? ''}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>

        <div>
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">View</span>
          <div className="flex rounded-md border border-slate-300 p-1">
            <button
              className={`flex-1 rounded px-3 py-1.5 text-sm ${viewMode === 'grid' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              onClick={() => {
                onViewModeChange('grid');
              }}
              type="button"
            >
              Grid
            </button>
            <button
              className={`flex-1 rounded px-3 py-1.5 text-sm ${viewMode === 'list' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              onClick={() => {
                onViewModeChange('list');
              }}
              type="button"
            >
              List
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Tags</p>
        <div className="flex flex-wrap gap-2">
          {tags.length === 0 ? <span className="text-sm text-slate-500">No tags available</span> : null}
          {tags.map((tag) => {
            const selected = selectedTags.includes(tag);
            return (
              <button
                className={`rounded-full border px-3 py-1 text-xs font-medium ${selected ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-100'}`}
                key={tag}
                onClick={() => {
                  onToggleTag(tag);
                }}
                type="button"
              >
                #{tag}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
