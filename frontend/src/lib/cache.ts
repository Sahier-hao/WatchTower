/** 简单的内存缓存，避免每次切页面重新请求 */
const store = new Map<string, { data: any; expiry: number }>();

export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

export function cacheSet(key: string, data: any, ttlMs = 5 * 60 * 1000) {
  store.set(key, { data, expiry: Date.now() + ttlMs });
}
