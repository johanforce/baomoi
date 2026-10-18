import { useEffect, useState } from 'react';
import { buildDefaultSources } from '../data/defaultSources';
import { cleanupOldArticles, saveArticlesToDB } from '../services/db';
import { fetchFeed, fetchFeedsConcurrently } from '../services/rssService';
import { Article, FeedStatus, SourceItem, ToastMessage } from '../types';
import { generateHash } from '../utils/hash';
import { isValidFeedUrl } from '../utils/url';

const STORAGE_SOURCES_KEY = 'sources_override_v2'; // bumped to v2 for seamless upgrade
const STORAGE_STATUSES_KEY = 'feed_statuses_v2';
const STORAGE_READ_IDS_KEY = 'tintonghop_read_ids';
const STORAGE_BOOKMARKS_KEY = 'tintonghop_bookmarks';
const STORAGE_THEME_KEY = 'tintonghop_theme';

/**
 * Trích xuất tên trang báo gốc từ tiêu đề nguồn
 * Ví dụ: "VnExpress - Thời sự" -> "VnExpress"
 *         "Báo Tuổi Trẻ - Thể thao" -> "Báo Tuổi Trẻ"
 *         "Soha - Công nghệ" -> "Soha"
 */
export function getOutletName(title: string): string {
  if (!title) return 'Khác';
  if (title.startsWith('Soha')) return 'Soha';
  if (title.startsWith('VnEconomy')) return 'VnEconomy';
  if (title.startsWith('VnBusiness')) return 'VnBusiness';
  return title.split(' - ')[0].trim();
}

export interface StoreState {
  sources: SourceItem[];
  statuses: Record<string, FeedStatus>;
  isRefreshingAll: boolean;
  refreshProgress: { completed: number; total: number; currentLabel?: string };
  toasts: ToastMessage[];
  readArticleIds: Set<string>;
  bookmarks: Article[];
  theme: 'light' | 'dark';
}

// Khởi tạo trạng thái ban đầu: Hợp nhất thông minh giữa defaultSources và LocalStorage
function getInitialSources(): SourceItem[] {
  const defaults = buildDefaultSources();
  try {
    const saved = localStorage.getItem(STORAGE_SOURCES_KEY) || localStorage.getItem('sources_override_v1');
    if (saved) {
      const parsed: SourceItem[] = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const savedMap = new Map<string, SourceItem>(parsed.map((s) => [s.id, s]));

        // Giữ lại tùy chỉnh của người dùng (feed_url đã sửa, toggle enabled)
        // và tự động nạp thêm các kênh mới xuất hiện trong defaultSources
        const merged: SourceItem[] = defaults.map((def) => {
          const existing = savedMap.get(def.id);
          if (existing) {
            return {
              ...def,
              feed_url: existing.feed_url || def.feed_url,
              enabled: existing.enabled !== undefined ? existing.enabled : def.enabled,
              isCustom: false,
            };
          }
          return def;
        });

        // Giữ lại các nguồn custom do người dùng tự thêm
        parsed
          .filter((s) => s.isCustom)
          .forEach((custom) => {
            if (!merged.some((m) => m.id === custom.id)) {
              merged.push(custom);
            }
          });

        return merged;
      }
    }
  } catch (err) {
    console.error('Không thể nạp nguồn từ localStorage:', err);
  }
  return defaults;
}

function getInitialStatuses(): Record<string, FeedStatus> {
  try {
    const saved = localStorage.getItem(STORAGE_STATUSES_KEY) || localStorage.getItem('feed_statuses_v1');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (err) {
    console.error('Không thể nạp trạng thái từ localStorage:', err);
  }
  return {};
}

function getInitialReadIds(): Set<string> {
  try {
    const saved = localStorage.getItem(STORAGE_READ_IDS_KEY);
    if (saved) {
      return new Set(JSON.parse(saved));
    }
  } catch {
    // ignore
  }
  return new Set();
}

function getInitialBookmarks(): Article[] {
  try {
    const saved = localStorage.getItem(STORAGE_BOOKMARKS_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // ignore
  }
  return [];
}

function getInitialTheme(): 'light' | 'dark' {
  try {
    const saved = localStorage.getItem(STORAGE_THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // ignore
  }
  // Mặc định kiểm tra media query của hệ thống nếu chưa có lưu
  if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

function applyThemeToDOM(theme: 'light' | 'dark') {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const body = document.body;

  if (theme === 'dark') {
    root.classList.add('dark');
    root.style.colorScheme = 'dark';
    if (body) {
      body.classList.add('dark');
    }
  } else {
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
    if (body) {
      body.classList.remove('dark');
    }
  }
}

// Singleton state
let state: StoreState = {
  sources: getInitialSources(),
  statuses: getInitialStatuses(),
  isRefreshingAll: false,
  refreshProgress: { completed: 0, total: 0 },
  toasts: [],
  readArticleIds: getInitialReadIds(),
  bookmarks: getInitialBookmarks(),
  theme: getInitialTheme(),
};

// Áp dụng theme ngay khi nạp module
applyThemeToDOM(state.theme);

// Listeners
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function persistSources() {
  try {
    localStorage.setItem(STORAGE_SOURCES_KEY, JSON.stringify(state.sources));
  } catch (err) {
    console.error('Lỗi khi lưu nguồn vào localStorage:', err);
  }
}

function persistStatuses() {
  try {
    localStorage.setItem(STORAGE_STATUSES_KEY, JSON.stringify(state.statuses));
  } catch (err) {
    console.error('Lỗi khi lưu statuses vào localStorage:', err);
  }
}

function persistReadIds() {
  try {
    localStorage.setItem(STORAGE_READ_IDS_KEY, JSON.stringify(Array.from(state.readArticleIds)));
  } catch {
    // ignore
  }
}

function persistBookmarks() {
  try {
    localStorage.setItem(STORAGE_BOOKMARKS_KEY, JSON.stringify(state.bookmarks));
  } catch {
    // ignore
  }
}

function persistTheme() {
  try {
    localStorage.setItem(STORAGE_THEME_KEY, state.theme);
    applyThemeToDOM(state.theme);
  } catch {
    // ignore
  }
}

export const sourcesStore = {
  getState(): StoreState {
    return state;
  },

  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  addToast(type: 'success' | 'error' | 'info', message: string) {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 5);
    state = {
      ...state,
      toasts: [...state.toasts, { id, type, message }],
    };
    notify();

    // Auto dismiss after 4.5 seconds
    setTimeout(() => {
      sourcesStore.removeToast(id);
    }, 4500);
  },

  removeToast(id: string) {
    state = {
      ...state,
      toasts: state.toasts.filter((t) => t.id !== id),
    };
    notify();
  },

  toggleTheme() {
    const newTheme = state.theme === 'light' ? 'dark' : 'light';
    state = { ...state, theme: newTheme };
    persistTheme();
    notify();
  },

  setTheme(newTheme: 'light' | 'dark') {
    state = { ...state, theme: newTheme };
    persistTheme();
    notify();
  },

  markArticleRead(articleId: string) {
    if (state.readArticleIds.has(articleId)) return;
    const newSet = new Set(state.readArticleIds);
    newSet.add(articleId);
    state = { ...state, readArticleIds: newSet };
    persistReadIds();
    notify();
  },

  toggleBookmark(article: Article) {
    const exists = state.bookmarks.some((b) => b.id === article.id);
    let newBookmarks: Article[];
    if (exists) {
      newBookmarks = state.bookmarks.filter((b) => b.id !== article.id);
      sourcesStore.addToast('info', `Đã xóa "${article.title.substring(0, 30)}..." khỏi mục Đã lưu`);
    } else {
      newBookmarks = [article, ...state.bookmarks];
      sourcesStore.addToast('success', `Đã lưu bài viết "${article.title.substring(0, 30)}..."`);
    }
    state = { ...state, bookmarks: newBookmarks };
    persistBookmarks();
    notify();
  },

  updateSourceUrl(sourceId: string, newUrl: string) {
    const trimmed = newUrl.trim();
    state = {
      ...state,
      sources: state.sources.map((s) => (s.id === sourceId ? { ...s, feed_url: trimmed } : s)),
      statuses: {
        ...state.statuses,
        [sourceId]: {
          sourceId,
          state: 'idle',
          articleCount: 0,
          latencyMs: 0,
          proxyUsed: null,
          lastChecked: null,
          errorReason: null,
        },
      },
    };
    persistSources();
    persistStatuses();
    notify();
  },

  toggleSource(sourceId: string, enabled: boolean) {
    state = {
      ...state,
      sources: state.sources.map((s) => (s.id === sourceId ? { ...s, enabled } : s)),
    };
    persistSources();
    notify();
  },

  toggleAllSources(enabled: boolean) {
    state = {
      ...state,
      sources: state.sources.map((s) => ({ ...s, enabled })),
    };
    persistSources();
    notify();
    sourcesStore.addToast('info', enabled ? 'Đã bật tất cả các kênh RSS' : 'Đã tắt tất cả các kênh RSS');
  },

  toggleOutletSources(outletName: string, enabled: boolean) {
    state = {
      ...state,
      sources: state.sources.map((s) => {
        if (getOutletName(s.title) === outletName) {
          return { ...s, enabled };
        }
        return s;
      }),
    };
    persistSources();
    notify();
    sourcesStore.addToast('info', enabled ? `Đã bật tất cả kênh của ${outletName}` : `Đã tắt tất cả kênh của ${outletName}`);
  },

  deleteSource(sourceId: string) {
    state = {
      ...state,
      sources: state.sources.filter((s) => s.id !== sourceId),
    };
    persistSources();
    notify();
    sourcesStore.addToast('info', 'Đã xóa nguồn thành công');
  },

  addSource(data: { title: string; categoryName: string; feed_url: string; rss_page?: string }) {
    const stableId = generateHash(data.feed_url);
    const newSource: SourceItem = {
      id: stableId,
      title: data.title.trim(),
      categoryName: data.categoryName.trim(),
      feed_url: data.feed_url.trim(),
      rss_page: (data.rss_page || data.feed_url).trim(),
      enabled: true,
      isCustom: true,
      defaultFeedUrl: data.feed_url.trim(),
      defaultTitle: data.title.trim(),
      defaultRssPage: (data.rss_page || data.feed_url).trim(),
    };

    state = {
      ...state,
      sources: [newSource, ...state.sources],
      statuses: {
        ...state.statuses,
        [stableId]: {
          sourceId: stableId,
          state: 'idle',
          articleCount: 0,
          latencyMs: 0,
          proxyUsed: null,
          lastChecked: null,
          errorReason: null,
        },
      },
    };
    persistSources();
    persistStatuses();
    notify();
    sourcesStore.addToast('success', `Đã thêm nguồn "${newSource.title}"`);
    return newSource;
  },

  resetSourceToDefault(sourceId: string) {
    const current = state.sources.find((s) => s.id === sourceId);
    if (!current) return;

    state = {
      ...state,
      sources: state.sources.map((s) =>
        s.id === sourceId
          ? {
              ...s,
              feed_url: s.defaultFeedUrl,
              title: s.defaultTitle,
              rss_page: s.defaultRssPage,
            }
          : s
      ),
      statuses: {
        ...state.statuses,
        [sourceId]: {
          sourceId,
          state: 'idle',
          articleCount: 0,
          latencyMs: 0,
          proxyUsed: null,
          lastChecked: null,
          errorReason: null,
        },
      },
    };
    persistSources();
    persistStatuses();
    notify();
    sourcesStore.addToast('info', `Đã khôi phục mặc định cho "${current.title}"`);
  },

  resetAllToDefault() {
    const defaultList = buildDefaultSources();
    state = {
      ...state,
      sources: defaultList,
      statuses: {},
    };
    persistSources();
    persistStatuses();
    notify();
    sourcesStore.addToast('info', 'Đã khôi phục toàn bộ danh sách nguồn về mặc định');
  },

  exportConfig(): string {
    return JSON.stringify(
      {
        version: 2,
        exportedAt: new Date().toISOString(),
        sources: state.sources,
      },
      null,
      2
    );
  },

  importConfig(jsonStr: string): boolean {
    try {
      const parsed = JSON.parse(jsonStr);
      const list = parsed.sources || (Array.isArray(parsed) ? parsed : null);
      if (!Array.isArray(list) || list.length === 0) {
        throw new Error('Dữ liệu không đúng cấu trúc danh sách nguồn');
      }

      const validSources: SourceItem[] = list.map((item: Partial<SourceItem>) => ({
        id: item.id || generateHash(item.feed_url || Math.random().toString()),
        title: item.title || 'Nguồn tin',
        rss_page: item.rss_page || item.feed_url || '',
        feed_url: item.feed_url || '',
        categoryName: item.categoryName || 'Tin tức & Thời sự tổng hợp',
        enabled: item.enabled !== false,
        isCustom: item.isCustom ?? true,
        defaultFeedUrl: item.defaultFeedUrl || item.feed_url || '',
        defaultTitle: item.defaultTitle || item.title || 'Nguồn tin',
        defaultRssPage: item.defaultRssPage || item.rss_page || '',
      }));

      state = {
        ...state,
        sources: validSources,
      };
      persistSources();
      notify();
      sourcesStore.addToast('success', `Đã nhập thành công ${validSources.length} nguồn`);
      return true;
    } catch (err: unknown) {
      sourcesStore.addToast('error', `Nhập cấu hình thất bại: ${(err as Error)?.message || 'File lỗi'}`);
      return false;
    }
  },

  /**
   * Tải lại một nguồn đơn lẻ
   */
  async fetchSingleSource(sourceId: string, showToast = true) {
    const source = state.sources.find((s) => s.id === sourceId);
    if (!source) return;

    state = {
      ...state,
      statuses: {
        ...state.statuses,
        [sourceId]: {
          ...(state.statuses[sourceId] || {
            sourceId,
            articleCount: 0,
            proxyUsed: null,
            lastChecked: null,
          }),
          state: 'loading',
        },
      },
    };
    notify();

    const result = await fetchFeed(source);

    const isSuccess = result.status === 'success';
    const newStatus: FeedStatus = {
      sourceId,
      state: isSuccess ? 'success' : 'error',
      articleCount: isSuccess ? result.articles.length : 0,
      latencyMs: result.latencyMs,
      proxyUsed: result.proxyUsed,
      lastChecked: result.fetchedAt,
      errorReason: result.error,
      proxyErrors: result.proxyErrors,
    };

    state = {
      ...state,
      statuses: {
        ...state.statuses,
        [sourceId]: newStatus,
      },
    };
    persistStatuses();
    notify();

    if (isSuccess) {
      await saveArticlesToDB(result.articles);
      if (showToast) {
        sourcesStore.addToast('success', `${source.title}: tải thành công ${result.articles.length} bài`);
      }
    } else {
      if (showToast) {
        sourcesStore.addToast('error', `${source.title}: tải thất bại – ${result.error}`);
      }
    }

    return result;
  },

  /**
   * Tải lại TOÀN BỘ RSS của 1 trang báo (Outlet) cụ thể
   * Ví dụ: outletName = "VnExpress" sẽ tải lại tất cả 11 kênh của VnExpress
   */
  async fetchSourcesByOutlet(outletName: string, forceIncludeDisabled = false) {
    if (state.isRefreshingAll) {
      sourcesStore.addToast('info', 'Hệ thống đang bận tải dữ liệu, vui lòng đợi giây lát');
      return;
    }

    const targetSources = state.sources.filter((s) => {
      const match = getOutletName(s.title) === outletName;
      return forceIncludeDisabled ? match : match && s.enabled;
    });

    if (targetSources.length === 0) {
      sourcesStore.addToast('info', `Không có kênh nào đang bật thuộc báo "${outletName}"`);
      return;
    }

    sourcesStore.addToast('info', `Đang tải lại ${targetSources.length} kênh RSS của "${outletName}"...`);

    return sourcesStore.fetchMultipleSources(
      targetSources.map((s) => s.id),
      outletName
    );
  },

  /**
   * Tải lại một danh sách nguồn cụ thể với concurrency pool
   */
  async fetchMultipleSources(sourceIds: string[], label = 'Danh sách nguồn') {
    if (state.isRefreshingAll) return;

    const targetSources = state.sources.filter((s) => sourceIds.includes(s.id));
    if (targetSources.length === 0) return;

    // Đánh dấu loading
    const updatedStatuses = { ...state.statuses };
    targetSources.forEach((s) => {
      updatedStatuses[s.id] = {
        ...(updatedStatuses[s.id] || {
          sourceId: s.id,
          articleCount: 0,
          latencyMs: 0,
          proxyUsed: null,
          lastChecked: null,
          errorReason: null,
        }),
        state: 'loading',
      };
    });

    state = {
      ...state,
      isRefreshingAll: true,
      refreshProgress: { completed: 0, total: targetSources.length, currentLabel: label },
      statuses: updatedStatuses,
    };
    notify();

    let successCount = 0;
    let failCount = 0;

    await fetchFeedsConcurrently(targetSources, 6, async (source, result, completed, total) => {
      const isSuccess = result.status === 'success';
      if (isSuccess) {
        successCount++;
        await saveArticlesToDB(result.articles);
      } else {
        failCount++;
      }

      state = {
        ...state,
        refreshProgress: { completed, total, currentLabel: source.title },
        statuses: {
          ...state.statuses,
          [source.id]: {
            sourceId: source.id,
            state: isSuccess ? 'success' : 'error',
            articleCount: isSuccess ? result.articles.length : 0,
            latencyMs: result.latencyMs,
            proxyUsed: result.proxyUsed,
            lastChecked: result.fetchedAt,
            errorReason: result.error,
            proxyErrors: result.proxyErrors,
          },
        },
      };
      persistStatuses();
      notify();
    });

    state = {
      ...state,
      isRefreshingAll: false,
    };
    notify();

    cleanupOldArticles().catch((e) => console.error('Lỗi cleanup bài cũ:', e));

    sourcesStore.addToast(
      failCount === 0 ? 'success' : 'info',
      `${label}: Đã tải xong ${successCount} thành công, ${failCount} lỗi / ${targetSources.length} kênh`
    );
  },

  /**
   * Tải lại tất cả các nguồn RSS
   * @param options.onlyFailed: chỉ tải các nguồn đang đỏ
   * @param options.forceAll: tải TOÀN BỘ kể cả các nguồn đang tắt (enabled=false)
   */
  async fetchAllSources(options?: { onlyFailed?: boolean; forceAll?: boolean } | boolean) {
    if (state.isRefreshingAll) return;

    let onlyFailed = false;
    let forceAll = false;
    if (typeof options === 'boolean') {
      onlyFailed = options;
    } else if (options) {
      onlyFailed = options.onlyFailed || false;
      forceAll = options.forceAll || false;
    }

    let targetSources = forceAll ? state.sources : state.sources.filter((s) => s.enabled);
    if (onlyFailed) {
      targetSources = targetSources.filter((s) => state.statuses[s.id]?.state === 'error');
    }

    if (targetSources.length === 0) {
      sourcesStore.addToast(
        'info',
        onlyFailed ? 'Không có nguồn lỗi nào cần tải lại' : 'Không có nguồn nào đang bật'
      );
      return;
    }

    const label = forceAll
      ? `Toàn bộ ${targetSources.length} kênh RSS`
      : onlyFailed
      ? `Các nguồn lỗi (${targetSources.length})`
      : `Tất cả kênh đang bật (${targetSources.length})`;

    return sourcesStore.fetchMultipleSources(
      targetSources.map((s) => s.id),
      label
    );
  },
};

/**
 * React hook tiện lợi để đồng bộ với sourcesStore
 */
export function useSourcesStore(): StoreState {
  const [snapshot, setSnapshot] = useState<StoreState>(sourcesStore.getState());

  useEffect(() => {
    const unsubscribe = sourcesStore.subscribe(() => {
      setSnapshot(sourcesStore.getState());
    });
    return unsubscribe;
  }, []);

  return snapshot;
}
