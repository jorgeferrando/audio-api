import type { Redis } from 'ioredis'
import type { ICacheService } from '@shared/ICacheService'

const DEFAULT_TTL_SECONDS = 60

/**
 * ICacheService implementation backed by Redis via ioredis.
 *
 * Receives the Redis client via constructor so tests can inject a mock
 * without needing a real Redis instance. The composition root creates
 * the ioredis client and passes it in.
 *
 * Values are JSON-serialized — callers must only cache plain objects (DTOs).
 */
export class RedisCacheService implements ICacheService {
  constructor(private readonly client: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key)
    if (value === null) return null
    return JSON.parse(value) as T
  }

  async set<T>(key: string, value: T, ttlSeconds = DEFAULT_TTL_SECONDS): Promise<void> {
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds)
  }

  async del(key: string): Promise<void> {
    await this.client.del(key)
  }
}
