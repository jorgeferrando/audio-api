import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RedisCacheService } from './RedisCacheService'
import type { ILogger } from '@shared/ILogger'

function makeRedisClient() {
  return {
    get: vi.fn(),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
  }
}

function makeLogger(): ILogger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}

describe('RedisCacheService', () => {
  let client: ReturnType<typeof makeRedisClient>
  let logger: ILogger
  let cache: RedisCacheService

  beforeEach(() => {
    client = makeRedisClient()
    logger = makeLogger()
    cache  = new RedisCacheService(client as never, logger)
  })

  describe('get()', () => {
    it('returns the deserialized value when key exists', async () => {
      client.get.mockResolvedValue(JSON.stringify({ name: 'test' }))

      const result = await cache.get<{ name: string }>('my-key')

      expect(result).toEqual({ name: 'test' })
    })

    it('returns null when key does not exist', async () => {
      client.get.mockResolvedValue(null)

      const result = await cache.get('missing-key')

      expect(result).toBeNull()
    })

    it('returns null and logs when Redis throws', async () => {
      client.get.mockRejectedValue(new Error('connection lost'))

      const result = await cache.get('my-key')

      expect(result).toBeNull()
      expect(logger.error).toHaveBeenCalledWith(
        'RedisCacheService: get failed',
        expect.objectContaining({ key: 'my-key' }),
      )
    })

    it('returns null and logs when cached value is corrupted JSON', async () => {
      client.get.mockResolvedValue('not-valid-json{{{')

      const result = await cache.get('my-key')

      expect(result).toBeNull()
      expect(logger.error).toHaveBeenCalled()
    })
  })

  describe('set()', () => {
    it('serializes the value and sets it with the given TTL', async () => {
      await cache.set('my-key', { name: 'test' }, 120)

      expect(client.set).toHaveBeenCalledWith(
        'my-key',
        JSON.stringify({ name: 'test' }),
        'EX',
        120
      )
    })

    it('uses a default TTL when none is provided', async () => {
      await cache.set('my-key', { name: 'test' })

      const [, , , ttl] = client.set.mock.calls[0]
      expect(ttl).toBeGreaterThan(0)
    })

    it('swallows error and logs when Redis throws', async () => {
      client.set.mockRejectedValue(new Error('connection lost'))

      await expect(cache.set('my-key', 'value')).resolves.toBeUndefined()
      expect(logger.error).toHaveBeenCalledWith(
        'RedisCacheService: set failed',
        expect.objectContaining({ key: 'my-key' }),
      )
    })
  })

  describe('del()', () => {
    it('deletes the key', async () => {
      await cache.del('my-key')

      expect(client.del).toHaveBeenCalledWith('my-key')
    })

    it('swallows error and logs when Redis throws', async () => {
      client.del.mockRejectedValue(new Error('connection lost'))

      await expect(cache.del('my-key')).resolves.toBeUndefined()
      expect(logger.error).toHaveBeenCalledWith(
        'RedisCacheService: del failed',
        expect.objectContaining({ key: 'my-key' }),
      )
    })
  })
})
