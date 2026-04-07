import type { Redis } from 'ioredis'
import type { ICacheService } from '@shared/ICacheService'
import type { ILogger } from '@shared/ILogger'

const DEFAULT_TTL_SECONDS = 60

/**
 * ICacheService implementation backed by Redis via ioredis.
 *
 * Fail-open strategy: if Redis is down or a value is corrupted, the
 * cache degrades gracefully (get returns null, set/del are silent no-ops).
 * Errors are logged so operators can detect persistent failures without
 * crashing the request pipeline.
 */
export class RedisCacheService implements ICacheService {
  constructor(
    private readonly client: Redis,
    private readonly logger: ILogger,
  ) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key)
      if (value === null) return null
      return JSON.parse(value) as T
    } catch (e) {
      this.logger.error('RedisCacheService: get failed', { key, error: e })
      return null
    }
  }

  async set<T>(key: string, value: T, ttlSeconds = DEFAULT_TTL_SECONDS): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds)
    } catch (e) {
      this.logger.error('RedisCacheService: set failed', { key, error: e })
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key)
    } catch (e) {
      this.logger.error('RedisCacheService: del failed', { key, error: e })
    }
  }
}
