import { describe, it, expect, beforeEach } from 'vitest'
import type { IAudioTrackRepository } from '@domain/audio/IAudioTrackRepository'
import { AudioTrack } from '@domain/audio/AudioTrack'

function makeTrack(overrides?: { filename?: string }): AudioTrack {
  const result = AudioTrack.create({
    filename: overrides?.filename ?? 'test.mp3',
    mimeType: 'audio/mpeg',
    sizeInBytes: 1024,
    filePath: '/uploads/originals/test.mp3',
  })
  if (!result.isOk()) throw new Error('test setup failed')
  return result.value
}

/**
 * Contract test for IAudioTrackRepository implementations.
 *
 * Verifies the port contract regardless of the backing store. Implementations
 * plug in by providing a factory and a cleanup function.
 */
export function testAudioTrackRepositoryContract(
  createRepo: () => IAudioTrackRepository,
  cleanup: () => Promise<void>,
): void {
  describe('IAudioTrackRepository contract', () => {
    let repo: IAudioTrackRepository

    beforeEach(async () => {
      await cleanup()
      repo = createRepo()
    })

    it('save + findById round-trip reconstitutes the entity', async () => {
      const track = makeTrack()
      await repo.save(track)

      const result = await repo.findById(track.id)
      expect(result.isOk()).toBe(true)
      if (!result.isOk()) return
      expect(result.value).not.toBeNull()
      expect(result.value!.id).toBe(track.id)
      expect(result.value!.filename).toBe(track.filename)
    })

    it('findById returns ok(null) for unknown id', async () => {
      const result = await repo.findById('00000000-0000-0000-0000-000000000000')
      expect(result.isOk()).toBe(true)
      if (!result.isOk()) return
      expect(result.value).toBeNull()
    })

    it('save twice updates (upsert semantics)', async () => {
      const track = makeTrack()
      await repo.save(track)

      track.markAsProcessing()
      await repo.save(track)

      const result = await repo.findById(track.id)
      expect(result.isOk()).toBe(true)
      if (!result.isOk()) return
      expect(result.value!.status).toBe('PROCESSING')
    })

    it('deleteById removes the entity', async () => {
      const track = makeTrack()
      await repo.save(track)
      await repo.deleteById(track.id)

      const result = await repo.findById(track.id)
      expect(result.isOk()).toBe(true)
      if (!result.isOk()) return
      expect(result.value).toBeNull()
    })

    it('findAll returns items and total', async () => {
      const t1 = makeTrack({ filename: 'a.mp3' })
      const t2 = makeTrack({ filename: 'b.mp3' })
      await repo.save(t1)
      await repo.save(t2)

      const result = await repo.findAll({ limit: 10, offset: 0 })
      expect(result.isOk()).toBe(true)
      if (!result.isOk()) return
      expect(result.value.items).toHaveLength(2)
      expect(result.value.total).toBe(2)
    })

    it('findAll respects limit and offset', async () => {
      const t1 = makeTrack({ filename: 'a.mp3' })
      const t2 = makeTrack({ filename: 'b.mp3' })
      await repo.save(t1)
      await repo.save(t2)

      const result = await repo.findAll({ limit: 1, offset: 0 })
      expect(result.isOk()).toBe(true)
      if (!result.isOk()) return
      expect(result.value.items).toHaveLength(1)
      expect(result.value.total).toBe(2)
    })
  })
}
