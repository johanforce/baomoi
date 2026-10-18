export interface SourceItem {
  id: string; // Hash ổn định từ default feed_url
  title: string;
  rss_page: string;
  feed_url: string;
  categoryName: string;
  enabled: boolean;
  isCustom?: boolean;
  defaultFeedUrl: string;
  defaultTitle: string;
  defaultRssPage: string;
}

export type FeedState = 'idle' | 'loading' | 'success' | 'error';

export interface ProxyAttemptError {
  proxy: string;
  error: string;
}

export interface FeedStatus {
  sourceId: string;
  state: FeedState;
  articleCount: number;
  latencyMs: number;
  proxyUsed: string | null;
  lastChecked: string | null; // ISO timestamp
  errorReason: string | null;
  proxyErrors?: ProxyAttemptError[];
}

export interface Article {
  id: string; // Hash của link
  title: string;
  link: string;
  description: string;
  thumbnail: string;
  pubDate: string; // ISO 8601
  dateStr: string; // YYYY-MM-DD theo múi giờ Asia/Ho_Chi_Minh
  sourceId: string;
  sourceName: string;
  categoryName: string;
  fetchedAt: number; // timestamp ms
}

export interface FetchFeedResult {
  status: 'success' | 'error';
  articles: Article[];
  error: string | null;
  proxyUsed: string | null;
  latencyMs: number;
  fetchedAt: string;
  proxyErrors?: ProxyAttemptError[];
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export interface CategoryGroup {
  name: string;
  sources: {
    title: string;
    rss_page: string;
    feed_url: string;
  }[];
}
