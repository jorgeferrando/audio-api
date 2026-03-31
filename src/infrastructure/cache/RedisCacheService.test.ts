import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RedisCacheService } from './RedisCacheService'

// Minimal mock of the ioredis Redis client — only the methods we use.
function makeRedisClient() {
  return {
    get: vi.fn(),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
  }
}

describe('RedisCacheService', () => {
  let client: ReturnType<typeof makeRedisClient>
  let cache: RedisCacheService

  beforeEach(() => {
    client = makeRedisClient()
    cache  = new RedisCacheService(client as never)
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
  })

  describe('del()', () => {
    it('deletes the key', async () => {
      await cache.del('my-key')

      expect(client.del).toHaveBeenCalledWith('my-key')
    })
  })
})
