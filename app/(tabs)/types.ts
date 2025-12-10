// ==================== 类型定义 ====================

export type BrowserTab = {
  id: string;
  url: string;
  title: string;
  input: string;
  isStartPage: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  snapshot: string | null;
};

export type QuickLink = {
  label: string;
  url: string;
  icon?: string;
};

export type RssNewsItem = {
  title: string;
  link: string;
};

export type BookmarkItem = {
  id: string;
  title: string;
  url: string;
  createdAt: number;
};
