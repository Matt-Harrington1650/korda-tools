import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type { HelpPageRecord, HelpPageSummary } from '../desktop';
import { HelpMarkdown } from '../features/helpCenter/HelpMarkdown';
import { slugifyHelpFragment, toHelpRoute } from '../features/helpCenter/helpLinks';
import { helpCenterService } from '../features/helpCenter/service';
import { requestShowWelcomeModal } from '../features/helpCenter/welcome';

type SearchResult = {
  slug: string;
  title: string;
  category: string;
  snippet: string;
};

const defaultCategory = 'Custom Notes';

const summarizeMatch = (content: string, query: string): string => {
  const compact = content.replace(/\s+/g, ' ').trim();
  if (!compact) {
    return '';
  }
  const needle = query.toLowerCase();
  const index = compact.toLowerCase().indexOf(needle);
  if (index < 0) {
    return compact.slice(0, 120);
  }
  const start = Math.max(0, index - 40);
  const end = Math.min(compact.length, index + needle.length + 80);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < compact.length ? '...' : '';
  return `${prefix}${compact.slice(start, end)}${suffix}`;
};

const toMarkdownHeadingAnchor = (value: string): string => slugifyHelpFragment(value);

const parseRouteAnchor = (hash: string): string | undefined => {
  const rawHash = hash.replace(/^#/, '');
  if (!rawHash) {
    return undefined;
  }

  try {
    return slugifyHelpFragment(decodeURIComponent(rawHash)) || undefined;
  } catch {
    return slugifyHelpFragment(rawHash) || undefined;
  }
};

export function HelpCenterPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { slug: routeSlug } = useParams<{ slug?: string }>();
  const activeSlug = (routeSlug ?? '').trim().toLowerCase();
  const activeAnchor = useMemo(() => parseRouteAnchor(location.hash), [location.hash]);
  const [pages, setPages] = useState<HelpPageSummary[]>([]);
  const [pageMap, setPageMap] = useState<Record<string, HelpPageRecord>>({});
  const [globalSearch, setGlobalSearch] = useState('');
  const [inPageSearch, setInPageSearch] = useState('');
  const [pendingGlobalJumpQuery, setPendingGlobalJumpQuery] = useState('');
  const [inPageMatchCount, setInPageMatchCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [developerMode, setDeveloperMode] = useState(false);
  const [editorMode, setEditorMode] = useState<'none' | 'edit' | 'new'>('none');
  const [draftSlug, setDraftSlug] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftCategory, setDraftCategory] = useState(defaultCategory);
  const [draftSortOrder, setDraftSortOrder] = useState('0');
  const [draftContent, setDraftContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showWorkflowMap, setShowWorkflowMap] = useState(false);
  const workflowMapRef = useRef<HTMLElement | null>(null);

  const loadDeveloperMode = useCallback(async (): Promise<void> => {
    try {
      const value = await helpCenterService.getAppState('developer_mode');
      setDeveloperMode(value?.toLowerCase() === 'true');
    } catch {
      setDeveloperMode(false);
    }
  }, []);

  const loadPages = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError('');
    try {
      const list = await helpCenterService.listPages();
      setPages(list);

      const entries = await Promise.all(
        list.map(async (page) => {
          const record = await helpCenterService.getPage(page.slug);
          return [page.slug, record] as const;
        }),
      );
      const nextMap: Record<string, HelpPageRecord> = {};
      entries.forEach(([slug, record]) => {
        nextMap[slug] = record;
      });
      setPageMap(nextMap);

      const defaultSlug = list.find((page) => page.slug === 'introduction')?.slug ?? list[0]?.slug;
      if (!routeSlug && defaultSlug) {
        navigate(`/help/${defaultSlug}`, { replace: true });
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load Help Center pages.');
    } finally {
      setLoading(false);
    }
  }, [navigate, routeSlug]);

  useEffect(() => {
    void loadDeveloperMode();
    void loadPages();
  }, [loadDeveloperMode, loadPages]);

  useEffect(() => {
    if (!activeSlug || pageMap[activeSlug] || loading) {
      return;
    }

    let mounted = true;
    void helpCenterService
      .getPage(activeSlug)
      .then((page) => {
        if (!mounted) {
          return;
        }
        setPageMap((current) => ({
          ...current,
          [page.slug]: page,
        }));
      })
      .catch(() => {
        if (mounted) {
          setError('Selected help page was not found.');
        }
      });

    return () => {
      mounted = false;
    };
  }, [activeSlug, loading, pageMap]);

  useEffect(() => {
    setInPageSearch('');
    setInPageMatchCount(0);
    setShowWorkflowMap(false);
    setEditorMode('none');
  }, [activeSlug]);

  useEffect(() => {
    if (!developerMode && activeSlug === 'developer') {
      navigate('/help/introduction', { replace: true });
    }
  }, [activeSlug, developerMode, navigate]);

  const visiblePages = useMemo(() => {
    return pages.filter((page) => developerMode || page.slug !== 'developer');
  }, [developerMode, pages]);

  const groupedPages = useMemo(() => {
    const groups = new Map<string, HelpPageSummary[]>();
    visiblePages.forEach((page) => {
      const items = groups.get(page.category) ?? [];
      items.push(page);
      groups.set(page.category, items);
    });
    return Array.from(groups.entries()).map(([category, items]) => ({
      category,
      pages: items.sort((left, right) => left.sortOrder - right.sortOrder || left.title.localeCompare(right.title)),
    }));
  }, [visiblePages]);

  const currentPage = activeSlug ? pageMap[activeSlug] : undefined;

  useEffect(() => {
    const query = pendingGlobalJumpQuery.trim();
    if (!query || !currentPage || !activeSlug || currentPage.slug !== activeSlug) {
      return;
    }

    setInPageSearch(query);
    setPendingGlobalJumpQuery('');
  }, [activeSlug, currentPage, pendingGlobalJumpQuery]);

  const globalSearchResults = useMemo<SearchResult[]>(() => {
    const query = globalSearch.trim().toLowerCase();
    if (!query) {
      return [];
    }

    return visiblePages
      .map((page) => {
        const record = pageMap[page.slug];
        const body = record?.contentMd ?? '';
        const haystack = `${page.title} ${page.category} ${body}`.toLowerCase();
        if (!haystack.includes(query)) {
          return null;
        }

        return {
          slug: page.slug,
          title: page.title,
          category: page.category,
          snippet: summarizeMatch(body || page.title, query),
        };
      })
      .filter((item): item is SearchResult => !!item)
      .slice(0, 24);
  }, [globalSearch, pageMap, visiblePages]);

  const navigateToPage = useCallback(
    (slug: string, anchor?: string): void => {
      navigate(toHelpRoute({ slug, anchor }));
    },
    [navigate],
  );

  const copyLink = async (): Promise<void> => {
    if (!activeSlug) {
      return;
    }
    try {
      await navigator.clipboard.writeText(`help://${activeSlug}`);
      setMessage('Link copied.');
      setError('');
    } catch {
      setError('Clipboard access failed.');
    }
  };

  const startNewPage = (): void => {
    setEditorMode('new');
    setDraftSlug('');
    setDraftTitle('');
    setDraftCategory(defaultCategory);
    setDraftSortOrder('0');
    setDraftContent('# New Page\n\nAdd your notes here.');
    setMessage('');
    setError('');
  };

  const startEditPage = (): void => {
    if (!currentPage) {
      return;
    }
    setEditorMode('edit');
    setDraftSlug(currentPage.slug);
    setDraftTitle(currentPage.title);
    setDraftCategory(currentPage.category);
    setDraftSortOrder(String(currentPage.sortOrder));
    setDraftContent(currentPage.contentMd);
    setMessage('');
    setError('');
  };

  const saveDraft = async (): Promise<void> => {
    const title = draftTitle.trim();
    const category = draftCategory.trim();
    const content = draftContent.trim();
    const sortOrderNumber = Number(draftSortOrder);

    if (!title || !category || !content) {
      setError('Title, category, and content are required.');
      return;
    }
    if (!Number.isFinite(sortOrderNumber)) {
      setError('Sort order must be a valid number.');
      return;
    }

    setIsSaving(true);
    setError('');
    setMessage('');
    try {
      if (editorMode === 'new') {
        const normalizedSlug = slugifyHelpFragment(draftSlug || draftTitle);
        if (!normalizedSlug) {
          setError('Slug is required.');
          return;
        }
        const created = await helpCenterService.createPage({
          slug: normalizedSlug,
          title,
          category,
          sortOrder: Math.trunc(sortOrderNumber),
          contentMd: content,
        });
        setMessage('Page created.');
        setEditorMode('none');
        await loadPages();
        navigate(`/help/${created.slug}`);
        return;
      }

      if (editorMode === 'edit' && currentPage) {
        const updated = await helpCenterService.updatePage(currentPage.slug, {
          title,
          category,
          sortOrder: Math.trunc(sortOrderNumber),
          contentMd: content,
        });
        setPageMap((current) => ({
          ...current,
          [updated.slug]: updated,
        }));
        setMessage('Page updated.');
        setEditorMode('none');
        await loadPages();
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save page.');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteCurrentPage = async (): Promise<void> => {
    if (!currentPage || currentPage.isBuiltin) {
      return;
    }
    if (!window.confirm(`Delete page "${currentPage.title}"?`)) {
      return;
    }

    setError('');
    setMessage('');
    try {
      await helpCenterService.deletePage(currentPage.slug);
      await loadPages();
      const fallback = visiblePages.find((page) => page.slug !== currentPage.slug)?.slug ?? 'introduction';
      navigate(`/help/${fallback}`);
      setMessage('Page deleted.');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete page.');
    }
  };

  const showWelcomeAgain = async (): Promise<void> => {
    setError('');
    try {
      await helpCenterService.setAppState('welcome_dismissed', 'false');
      requestShowWelcomeModal();
      setMessage('Welcome modal is available again.');
    } catch (stateError) {
      setError(stateError instanceof Error ? stateError.message : 'Failed to update app state.');
    }
  };

  const canEditCurrentPage = !!currentPage && (!currentPage.isBuiltin || developerMode);

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <aside className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Start Here / Help Center</h2>
          <p className="mt-1 text-xs text-slate-600">Search guides, runbooks, and workflow notes.</p>
        </div>

        <label className="space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Global search</span>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            onChange={(event) => {
              setGlobalSearch(event.target.value);
            }}
            placeholder="Search title and content"
            value={globalSearch}
          />
        </label>

        {globalSearch.trim() ? (
          <ul className="max-h-[400px] space-y-2 overflow-auto">
            {globalSearchResults.length === 0 ? (
              <li className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">No matches found.</li>
            ) : (
              globalSearchResults.map((result) => (
                <li key={`${result.slug}-${result.title}`}>
                  <button
                    className="w-full rounded border border-slate-200 px-3 py-2 text-left hover:bg-slate-50"
                    onClick={() => {
                      const query = globalSearch.trim();
                      if (query) {
                        setPendingGlobalJumpQuery(query);
                      }
                      navigateToPage(result.slug);
                    }}
                    type="button"
                  >
                    <p className="text-sm font-medium text-slate-900">{result.title}</p>
                    <p className="text-xs text-slate-500">{result.category}</p>
                    {result.snippet ? <p className="mt-1 text-xs text-slate-600">{result.snippet}</p> : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : (
          <div className="space-y-4">
            {groupedPages.map((group) => (
              <section key={group.category}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{group.category}</h3>
                <ul className="space-y-1">
                  {group.pages.map((page) => (
                    <li key={page.id}>
                      <button
                        className={`w-full rounded border px-3 py-2 text-left text-sm ${
                          page.slug === activeSlug
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                        onClick={() => {
                          navigateToPage(page.slug);
                        }}
                        type="button"
                      >
                        {page.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </aside>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{currentPage?.title ?? 'Help Center'}</h2>
            <p className="mt-1 text-sm text-slate-600">{currentPage?.category ?? 'Select a page from the list.'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              onClick={() => {
                void copyLink();
              }}
              type="button"
            >
              Copy Link
            </button>
            <button
              className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              onClick={startNewPage}
              type="button"
            >
              New Page
            </button>
            <button
              className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              onClick={() => {
                void showWelcomeAgain();
              }}
              type="button"
            >
              Show Welcome Again
            </button>
            <button
              className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              disabled={!canEditCurrentPage}
              onClick={startEditPage}
              type="button"
            >
              Edit
            </button>
            <button
              className="rounded border border-rose-300 px-3 py-2 text-sm text-rose-700 hover:bg-rose-50 disabled:opacity-60"
              disabled={!currentPage || currentPage.isBuiltin}
              onClick={() => {
                void deleteCurrentPage();
              }}
              type="button"
            >
              Delete
            </button>
            {activeSlug === 'workflows-overview' ? (
              <button
                className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                onClick={() => {
                  setShowWorkflowMap((current) => !current);
                  window.setTimeout(() => {
                    workflowMapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 0);
                }}
                type="button"
              >
                Show Workflow Map
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Find in page</span>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => {
                setInPageSearch(event.target.value);
              }}
              placeholder="Search this page"
              value={inPageSearch}
            />
          </label>
          <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Matches: <span className="font-semibold text-slate-900">{inPageMatchCount}</span>
          </div>
        </div>

        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        {loading ? <p className="text-sm text-slate-600">Loading help pages...</p> : null}

        {editorMode !== 'none' ? (
          <section className="space-y-3 rounded border border-amber-200 bg-amber-50 p-4">
            <h3 className="text-sm font-semibold text-slate-900">{editorMode === 'new' ? 'Create Page' : 'Edit Page'}</h3>
            <div className="grid gap-3 md:grid-cols-2">
              {editorMode === 'new' ? (
                <label className="space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Slug</span>
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    onChange={(event) => {
                      setDraftSlug(slugifyHelpFragment(event.target.value));
                    }}
                    value={draftSlug}
                  />
                </label>
              ) : null}
              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Title</span>
                <input
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  onChange={(event) => {
                    setDraftTitle(event.target.value);
                  }}
                  value={draftTitle}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Category</span>
                <input
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  onChange={(event) => {
                    setDraftCategory(event.target.value);
                  }}
                  value={draftCategory}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Sort Order</span>
                <input
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  onChange={(event) => {
                    setDraftSortOrder(event.target.value);
                  }}
                  type="number"
                  value={draftSortOrder}
                />
              </label>
            </div>
            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Markdown Content</span>
              <textarea
                className="h-64 w-full rounded border border-slate-300 px-3 py-2 font-mono text-sm"
                onChange={(event) => {
                  setDraftContent(event.target.value);
                }}
                value={draftContent}
              />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                disabled={isSaving}
                onClick={() => {
                  void saveDraft();
                }}
                type="button"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              <button
                className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setEditorMode('none');
                }}
                type="button"
              >
                Cancel
              </button>
            </div>
          </section>
        ) : null}

        {!loading && currentPage ? (
          <>
            <HelpMarkdown
              activeAnchor={activeAnchor}
              inPageSearch={inPageSearch}
              markdown={currentPage.contentMd}
              onInPageMatchCountChange={setInPageMatchCount}
              onNavigateHelpLink={(slug, anchor) => {
                navigateToPage(slug, anchor);
              }}
            />

            {activeSlug === 'workflows-overview' && showWorkflowMap ? (
              <section className="rounded border border-slate-200 bg-slate-50 p-4" ref={workflowMapRef}>
                <h3 className="text-base font-semibold text-slate-900">Workflow Map</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <article className="rounded border border-slate-200 bg-white p-3">
                    <h4 className="text-sm font-semibold text-slate-900">1) Add a Custom Tool</h4>
                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-slate-700">
                      <li>Attach files and write instructions</li>
                      <li>Save version</li>
                      <li>Export zip, share, import</li>
                    </ol>
                    <button
                      className="mt-2 text-xs font-medium text-slate-900 underline"
                      onClick={() => {
                        navigateToPage('tools-library', toMarkdownHeadingAnchor('AutoCAD use case'));
                      }}
                      type="button"
                    >
                      Open anchor
                    </button>
                  </article>

                  <article className="rounded border border-slate-200 bg-white p-3">
                    <h4 className="text-sm font-semibold text-slate-900">2) Run a Workflow</h4>
                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-slate-700">
                      <li>Select workflow</li>
                      <li>Attach inputs</li>
                      <li>Run and review outputs</li>
                    </ol>
                    <button
                      className="mt-2 text-xs font-medium text-slate-900 underline"
                      onClick={() => {
                        navigateToPage('workflows-overview', toMarkdownHeadingAnchor('Run a workflow'));
                      }}
                      type="button"
                    >
                      Open anchor
                    </button>
                  </article>

                  <article className="rounded border border-slate-200 bg-white p-3">
                    <h4 className="text-sm font-semibold text-slate-900">3) Update / Version a Tool</h4>
                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-slate-700">
                      <li>Create a new version</li>
                      <li>Add changelog and instructions</li>
                      <li>Export updated package</li>
                    </ol>
                    <button
                      className="mt-2 text-xs font-medium text-slate-900 underline"
                      onClick={() => {
                        navigateToPage('tools-library', toMarkdownHeadingAnchor('Core actions'));
                      }}
                      type="button"
                    >
                      Open anchor
                    </button>
                  </article>

                  <article className="rounded border border-slate-200 bg-white p-3">
                    <h4 className="text-sm font-semibold text-slate-900">4) Troubleshoot</h4>
                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-slate-700">
                      <li>Check paths and permissions</li>
                      <li>Verify dependencies</li>
                      <li>Review tool and workflow logs</li>
                    </ol>
                    <button
                      className="mt-2 text-xs font-medium text-slate-900 underline"
                      onClick={() => {
                        navigateToPage('troubleshooting', toMarkdownHeadingAnchor('Common errors and fixes'));
                      }}
                      type="button"
                    >
                      Open anchor
                    </button>
                  </article>
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </section>
    </div>
  );
}
