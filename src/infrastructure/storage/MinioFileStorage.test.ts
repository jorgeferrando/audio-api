import { Readable } from 'stream'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MinioFileStorage } from './MinioFileStorage'
import { StorageError } from '@shared/AppError'

const makeClient = () => ({
  putObject:  vi.fn().mockResolvedValue({}),
  getObject:  vi.fn().mockResolvedValue(Readable.from(Buffer.from('audio-data'))),
  removeObject: vi.fn().mockResolvedValue(undefined),
})

const makeLogger = () => ({
  info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
})

describe('MinioFileStorage', () => {
  let client: ReturnType<typeof makeClient>
  let storage: MinioFileStorage

  beforeEach(() => {
    client  = makeClient()
    storage = new MinioFileStorage(client as never, 'audio-bucket', makeLogger())
  })

  describe('upload()', () => {
    it('stores content in the bucket with the given key', async () => {
      const buf = Buffer.from('audio-content')
      const result = await storage.upload('originals/abc.mp3', buf, 'audio/mpeg')

      expect(result.isOk()).toBe(true)
      expect(client.putObject).toHaveBeenCalledWith(
        'audio-bucket', 'originals/abc.mp3', buf, buf.length, { 'Content-Type': 'audio/mpeg' }
      )
    })

    it('returns StorageError when putObject throws', async () => {
      client.putObject.mockRejectedValue(new Error('connection refused'))

      const result = await storage.upload('key', Buffer.from('x'), 'audio/mpeg')

      expect(result.isErr()).toBe(true)
      if (!result.isErr()) return
      expect(result.error).toBeInstanceOf(StorageError)
    })
  })

  describe('download()', () => {
    it('returns a readable stream for the given key', async () => {
      const result = await storage.download('originals/abc.mp3')

      expect(result.isOk()).toBe(true)
      if (!result.isOk()) return
      expect(result.value).toBeInstanceOf(Readable)
      expect(client.getObject).toHaveBeenCalledWith('audio-bucket', 'originals/abc.mp3')
    })

    it('returns StorageError when getObject throws', async () => {
      client.getObject.mockRejectedValue(new Error('not found'))

      const result = await storage.download('missing-key')

      expect(result.isErr()).toBe(true)
      if (!result.isErr()) return
      expect(result.error).toBeInstanceOf(StorageError)
    })
  })

  describe('delete()', () => {
    it('removes the object from the bucket', async () => {
      const result = await storage.delete('originals/abc.mp3')

      expect(result.isOk()).toBe(true)
      expect(client.removeObject).toHaveBeenCalledWith('audio-bucket', 'originals/abc.mp3')
    })

    it('returns StorageError when removeObject throws', async () => {
      client.removeObject.mockRejectedValue(new Error('access denied'))

      const result = await storage.delete('key')

      expect(result.isErr()).toBe(true)
    })
  })
})
