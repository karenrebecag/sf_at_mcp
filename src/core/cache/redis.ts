import { createClient, type RedisClientType } from 'redis';

const DEFAULT_TTL_MS = Number(process.env.CACHE_TTL_MS ?? 300_000); // 5 min

let client: RedisClientType | null = null;
let connectPromise: Promise<RedisClientType | null> | null = null;

export function defaultCacheTtlMs(): number {
  return DEFAULT_TTL_MS;
}

export function redisEnabled(): boolean {
  return Boolean(process.env.REDIS_URL?.trim());
}

async function connectRedis(): Promise<RedisClientType | null> {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;

  if (client?.isOpen) return client;

  if (!connectPromise) {
    connectPromise = (async () => {
      const redis = createClient({ url });
      redis.on('error', (err) => {
        console.error('Redis client error:', err);
      });
      try {
        await redis.connect();
        client = redis as RedisClientType;
        return client;
      } catch (err) {
        console.error('Redis connect failed — caching disabled:', err);
        connectPromise = null;
        return null;
      }
    })();
  }

  return connectPromise;
}

export async function cacheGet(key: string): Promise<string | null> {
  const redis = await connectRedis();
  if (!redis) return null;
  try {
    return await redis.get(key);
  } catch (err) {
    console.error('Redis GET failed:', err);
    return null;
  }
}

export async function cacheSet(key: string, value: string, ttlMs: number): Promise<void> {
  const redis = await connectRedis();
  if (!redis) return;
  try {
    const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1000));
    await redis.setEx(key, ttlSeconds, value);
  } catch (err) {
    console.error('Redis SET failed:', err);
  }
}

/** Test helper — reset singleton between runs. */
export async function closeRedis(): Promise<void> {
  if (client?.isOpen) await client.quit();
  client = null;
  connectPromise = null;
}

export interface CacheResult<T> {
  value: T;
  cached: boolean;
}

export async function withCache<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
): Promise<CacheResult<T>> {
  if (!redisEnabled()) {
    return { value: await fetcher(), cached: false };
  }

  const hit = await cacheGet(key);
  if (hit) {
    try {
      return { value: JSON.parse(hit) as T, cached: true };
    } catch {
      /* corrupt entry — refetch */
    }
  }

  const value = await fetcher();
  await cacheSet(key, JSON.stringify(value), ttlMs);
  return { value, cached: false };
}
