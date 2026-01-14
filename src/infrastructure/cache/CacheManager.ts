/**
 * Cache Manager
 * Provides caching layer for service calls to improve performance
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

export class CacheManager {
  private static instance: CacheManager;
  private cache = new Map<string, CacheEntry<unknown>>();

  private constructor() {}

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  /**
   * Get cached value
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set cached value
   * @param key Cache key
   * @param data Data to cache
   * @param ttl Time to live in milliseconds (must be positive, defaults to 5 minutes)
   */
  set<T>(key: string, data: T, ttl: number = 300000): void {
    // Validate TTL is a positive finite number
    if (typeof ttl !== 'number' || !Number.isFinite(ttl) || ttl <= 0) {
      console.warn(`[CacheManager] Invalid TTL value: ${ttl}, using default 5 minutes`);
      ttl = 300000; // Default to 5 minutes
    }
    // Cap TTL at 24 hours to prevent excessively long cache entries
    const maxTTL = 24 * 60 * 60 * 1000; // 24 hours
    if (ttl > maxTTL) {
      console.warn(`[CacheManager] TTL exceeds max (24h), capping to max`);
      ttl = maxTTL;
    }
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Clear cache entry
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Clear expired entries
   * Note: Collects keys first to avoid modifying Map during iteration
   */
  clearExpired(): void {
    const now = Date.now();
    // Collect expired keys first to avoid modifying Map during iteration
    const expiredKeys: string[] = [];
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        expiredKeys.push(key);
      }
    }
    // Then delete all expired entries
    for (const key of expiredKeys) {
      this.cache.delete(key);
    }
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }
}

export const cacheManager = CacheManager.getInstance();
