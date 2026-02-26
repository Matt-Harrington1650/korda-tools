export type HelpPageSummary = {
  id: string;
  slug: string;
  title: string;
  category: string;
  sortOrder: number;
  isBuiltin: boolean;
  updatedAt: number;
};

export type HelpPageRecord = {
  id: string;
  slug: string;
  title: string;
  category: string;
  sortOrder: number;
  contentMd: string;
  isBuiltin: boolean;
  createdAt: number;
  updatedAt: number;
};

export type HelpCreatePageInput = {
  slug: string;
  title: string;
  category: string;
  sortOrder?: number;
  contentMd: string;
};

export type HelpUpdatePageInput = {
  title?: string;
  category?: string;
  sortOrder?: number;
  contentMd?: string;
};

export interface HelpCenterService {
  listPages: () => Promise<HelpPageSummary[]>;
  getPage: (slug: string) => Promise<HelpPageRecord>;
  createPage: (input: HelpCreatePageInput) => Promise<HelpPageRecord>;
  updatePage: (slug: string, input: HelpUpdatePageInput) => Promise<HelpPageRecord>;
  deletePage: (slug: string) => Promise<void>;
  getAppState: (key: string) => Promise<string | null>;
  setAppState: (key: string, value: string) => Promise<void>;
}
