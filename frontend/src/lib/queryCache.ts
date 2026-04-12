/**
 * Simple Query Cache Implementation
 * Prevents redundant API calls within specified time window
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // milliseconds
}

class QueryCache {
  private cache = new Map<string, CacheEntry<any>>();

  /**
   * Get cached data if still valid
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      // Cache expired, remove it
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set cache with TTL (default 5 minutes)
   */
  set<T>(key: string, data: T, ttlMs: number = 5 * 60 * 1000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
    });
  }

  /**
   * Clear specific cache key
   */
  clear(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all entries with pattern (regex)
   */
  clearPattern(pattern: RegExp | string): void {
    const patternRegex = typeof pattern === 'string' 
      ? new RegExp(pattern) 
      : pattern;

    for (const key of this.cache.keys()) {
      if (patternRegex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clearAll(): void {
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  stats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Export singleton instance
export const queryCache = new QueryCache();

/**
 * Hook-style usage for React components
 * Example: const employees = useCachedQuery('employees', fetchEmployees, 5*60*1000)
 */
export function useCachedQuery<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlMs: number = 5 * 60 * 1000
): {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<T>;
} {
  const cached = queryCache.get<T>(key);
  
  if (cached) {
    return {
      data: cached,
      isLoading: false,
      error: null,
      refetch: async () => {
        try {
          const newData = await fetchFn();
          queryCache.set(key, newData, ttlMs);
          return newData;
        } catch (error) {
          console.error(`Query cache refetch failed for ${key}:`, error);
          return cached;
        }
      },
    };
  }

  // Should be wrapped with actual React hooks in calling component
  // This is just the cache layer
  return {
    data: null,
    isLoading: true,
    error: null,
    refetch: fetchFn,
  };
}
