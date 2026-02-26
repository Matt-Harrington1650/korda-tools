// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { HelpCreatePageInput, HelpPageRecord, HelpPageSummary, HelpUpdatePageInput } from '../desktop';
import { HelpCenterPage } from './HelpCenterPage';

const helpServiceMocks = vi.hoisted(() => ({
  listPages: vi.fn<() => Promise<HelpPageSummary[]>>(),
  getPage: vi.fn<(slug: string) => Promise<HelpPageRecord>>(),
  createPage: vi.fn<(input: HelpCreatePageInput) => Promise<HelpPageRecord>>(),
  updatePage: vi.fn<(slug: string, input: HelpUpdatePageInput) => Promise<HelpPageRecord>>(),
  deletePage: vi.fn<(slug: string) => Promise<void>>(),
  getAppState: vi.fn<(key: string) => Promise<string | null>>(),
  setAppState: vi.fn<(key: string, value: string) => Promise<void>>(),
}));

vi.mock('../features/helpCenter/service', () => ({
  helpCenterService: {
    listPages: helpServiceMocks.listPages,
    getPage: helpServiceMocks.getPage,
    createPage: helpServiceMocks.createPage,
    updatePage: helpServiceMocks.updatePage,
    deletePage: helpServiceMocks.deletePage,
    getAppState: helpServiceMocks.getAppState,
    setAppState: helpServiceMocks.setAppState,
  },
}));

const toSummary = (record: HelpPageRecord): HelpPageSummary => ({
  id: record.id,
  slug: record.slug,
  title: record.title,
  category: record.category,
  sortOrder: record.sortOrder,
  isBuiltin: record.isBuiltin,
  updatedAt: record.updatedAt,
});

const setupMockHelpService = (seedPages: HelpPageRecord[]): void => {
  const pages = new Map(seedPages.map((page) => [page.slug, { ...page }]));
  const appState = new Map<string, string>([['developer_mode', 'false'], ['welcome_dismissed', 'true']]);

  helpServiceMocks.listPages.mockImplementation(async () => {
    return Array.from(pages.values())
      .sort((left, right) => left.sortOrder - right.sortOrder || left.title.localeCompare(right.title))
      .map(toSummary);
  });

  helpServiceMocks.getPage.mockImplementation(async (slug: string) => {
    const record = pages.get(slug);
    if (!record) {
      throw new Error('Help page not found.');
    }
    return { ...record };
  });

  helpServiceMocks.createPage.mockImplementation(async (input: HelpCreatePageInput) => {
    if (pages.has(input.slug)) {
      throw new Error('Page already exists.');
    }

    const created: HelpPageRecord = {
      id: `custom-${input.slug}`,
      slug: input.slug,
      title: input.title,
      category: input.category,
      sortOrder: input.sortOrder ?? 0,
      contentMd: input.contentMd,
      isBuiltin: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    pages.set(created.slug, created);
    return { ...created };
  });

  helpServiceMocks.updatePage.mockImplementation(async (slug: string, input: HelpUpdatePageInput) => {
    const current = pages.get(slug);
    if (!current) {
      throw new Error('Help page not found.');
    }
    if (current.isBuiltin && appState.get('developer_mode') !== 'true') {
      throw new Error('Built-in help pages are read-only unless Developer Mode is enabled.');
    }

    const next: HelpPageRecord = {
      ...current,
      title: input.title ?? current.title,
      category: input.category ?? current.category,
      sortOrder: input.sortOrder ?? current.sortOrder,
      contentMd: input.contentMd ?? current.contentMd,
      updatedAt: Date.now(),
    };
    pages.set(slug, next);
    return { ...next };
  });

  helpServiceMocks.deletePage.mockImplementation(async (slug: string) => {
    const current = pages.get(slug);
    if (!current) {
      throw new Error('Help page not found.');
    }
    if (current.isBuiltin) {
      throw new Error('Built-in help pages cannot be deleted.');
    }
    pages.delete(slug);
  });

  helpServiceMocks.getAppState.mockImplementation(async (key: string) => {
    return appState.get(key) ?? null;
  });

  helpServiceMocks.setAppState.mockImplementation(async (key: string, value: string) => {
    appState.set(key, value);
  });
};

const renderHelpPage = (initialPath: string): void => {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<HelpCenterPage />} path="/help" />
        <Route element={<HelpCenterPage />} path="/help/:slug" />
      </Routes>
    </MemoryRouter>,
  );
};

describe('HelpCenterPage smoke', () => {
  beforeEach(() => {
    helpServiceMocks.listPages.mockReset();
    helpServiceMocks.getPage.mockReset();
    helpServiceMocks.createPage.mockReset();
    helpServiceMocks.updatePage.mockReset();
    helpServiceMocks.deletePage.mockReset();
    helpServiceMocks.getAppState.mockReset();
    helpServiceMocks.setAppState.mockReset();
    vi.stubGlobal('confirm', vi.fn(() => true));
    (HTMLElement.prototype as { scrollIntoView?: () => void }).scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('navigates pages and applies global search result as in-page search', async () => {
    setupMockHelpService([
      {
        id: 'builtin-introduction',
        slug: 'introduction',
        title: 'Introduction',
        category: 'Getting Started',
        sortOrder: 10,
        contentMd: '# Introduction\n\nWelcome to the intro page.',
        isBuiltin: true,
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'builtin-quick-start',
        slug: 'quick-start',
        title: 'Quick Start',
        category: 'Getting Started',
        sortOrder: 20,
        contentMd: '# Quick Start\n\nUse search-token-42 to validate global search jump behavior.',
        isBuiltin: true,
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'custom-runbook',
        slug: 'custom-runbook',
        title: 'Custom Runbook',
        category: 'Custom Notes',
        sortOrder: 30,
        contentMd: '# Custom Runbook\n\nA team-specific note.',
        isBuiltin: false,
        createdAt: 1,
        updatedAt: 1,
      },
    ]);

    renderHelpPage('/help/introduction');

    await screen.findByRole('heading', { name: 'Introduction', level: 1 });

    fireEvent.click(screen.getByRole('button', { name: 'Quick Start' }));
    await screen.findByText('Use search-token-42 to validate global search jump behavior.');

    fireEvent.change(screen.getByPlaceholderText('Search title and content'), {
      target: { value: 'search-token-42' },
    });

    fireEvent.click(await screen.findByRole('button', { name: /Quick Start/i }));
    await screen.findByRole('heading', { name: 'Quick Start', level: 1 });

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search this page')).toHaveValue('search-token-42');
    });
  });

  it('edits a custom page and persists updated markdown', async () => {
    setupMockHelpService([
      {
        id: 'builtin-introduction',
        slug: 'introduction',
        title: 'Introduction',
        category: 'Getting Started',
        sortOrder: 10,
        contentMd: '# Introduction\n\nWelcome to the intro page.',
        isBuiltin: true,
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'custom-runbook',
        slug: 'custom-runbook',
        title: 'Custom Runbook',
        category: 'Custom Notes',
        sortOrder: 30,
        contentMd: '# Custom Runbook\n\nOriginal checklist.',
        isBuiltin: false,
        createdAt: 1,
        updatedAt: 1,
      },
    ]);

    renderHelpPage('/help/custom-runbook');

    await screen.findByRole('heading', { name: 'Custom Runbook', level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Custom Runbook Updated' },
    });
    fireEvent.change(screen.getByLabelText('Markdown Content'), {
      target: { value: '# Custom Runbook Updated\n\nUpdated checklist step.' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await screen.findByText('Page updated.');
    expect(helpServiceMocks.updatePage).toHaveBeenCalledWith(
      'custom-runbook',
      expect.objectContaining({
        title: 'Custom Runbook Updated',
      }),
    );
    await screen.findByText('Updated checklist step.');
  });
});
