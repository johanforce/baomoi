import { useMemo } from 'react';
import { useSourcesStore } from '../store/sourcesStore';
import { SourceItem } from '../types';

export interface FeedHealthSummary {
  totalSources: number;
  enabledSources: number;
  healthyCount: number;
  errorCount: number;
  idleCount: number;
  loadingCount: number;
  hasErrors: boolean;
  errorSources: SourceItem[];
  allHealthy: boolean;
}

export function useFeedHealth(): FeedHealthSummary {
  const { sources, statuses } = useSourcesStore();

  return useMemo(() => {
    const enabled = sources.filter((s) => s.enabled);
    let healthyCount = 0;
    let errorCount = 0;
    let idleCount = 0;
    let loadingCount = 0;
    const errorSources: SourceItem[] = [];

    enabled.forEach((src) => {
      const status = statuses[src.id];
      if (!status || status.state === 'idle') {
        idleCount++;
      } else if (status.state === 'loading') {
        loadingCount++;
      } else if (status.state === 'success') {
        healthyCount++;
      } else if (status.state === 'error') {
        errorCount++;
        errorSources.push(src);
      }
    });

    return {
      totalSources: sources.length,
      enabledSources: enabled.length,
      healthyCount,
      errorCount,
      idleCount,
      loadingCount,
      hasErrors: errorCount > 0,
      errorSources,
      allHealthy: enabled.length > 0 && healthyCount === enabled.length,
    };
  }, [sources, statuses]);
}
