import { describe, it, expect, beforeEach } from 'vitest'
import type { IProcessingJobRepository } from '@domain/job/IProcessingJobRepository'
import { ProcessingJob, AudioEffect } from '@domain/job/ProcessingJob'

function makeJob(audioTrackId = '00000000-0000-0000-0000-000000000001'): ProcessingJob {
  const result = ProcessingJob.create({ audioTrackId, effect: AudioEffect.NORMALIZE })
  if (!result.isOk()) throw new Error('test setup failed')
  return result.value
}

/**
 * Contract test for IProcessingJobRepository implementations.
 *
 * Verifies the port contract regardless of the backing store.
 */
export function testProcessingJobRepositoryContract(
  createRepo: () => IProcessingJobRepository,
  cleanup: () => Promise<void>,
): void {
  describe('IProcessingJobRepository contract', () => {
    let repo: IProcessingJobRepository

    beforeEach(async () => {
      await cleanup()
      repo = createRepo()
    })

    it('save + findById round-trip reconstitutes the entity', async () => {
      const job = makeJob()
      await repo.save(job)

      const result = await repo.findById(job.id)
      expect(result.isOk()).toBe(true)
      if (!result.isOk()) return
      expect(result.value).not.toBeNull()
      expect(result.value!.id).toBe(job.id)
      expect(result.value!.audioTrackId).toBe(job.audioTrackId)
      expect(result.value!.effect).toBe(AudioEffect.NORMALIZE)
    })

    it('findById returns ok(null) for unknown id', async () => {
      const result = await repo.findById('00000000-0000-0000-0000-000000000000')
      expect(result.isOk()).toBe(true)
      if (!result.isOk()) return
      expect(result.value).toBeNull()
    })

    it('save twice updates (upsert semantics)', async () => {
      const job = makeJob()
      await repo.save(job)

      job.start()
      await repo.save(job)

      const result = await repo.findById(job.id)
      expect(result.isOk()).toBe(true)
      if (!result.isOk()) return
      expect(result.value!.status).toBe('PROCESSING')
    })

    it('findByAudioTrackId finds by foreign key', async () => {
      const trackId = '00000000-0000-0000-0000-000000000099'
      const job = makeJob(trackId)
      await repo.save(job)

      const result = await repo.findByAudioTrackId(trackId)
      expect(result.isOk()).toBe(true)
      if (!result.isOk()) return
      expect(result.value).not.toBeNull()
      expect(result.value!.id).toBe(job.id)
    })

    it('findByAudioTrackId returns ok(null) for unknown trackId', async () => {
      const result = await repo.findByAudioTrackId('00000000-0000-0000-0000-ffffffffffff')
      expect(result.isOk()).toBe(true)
      if (!result.isOk()) return
      expect(result.value).toBeNull()
    })

    it('deleteById removes the entity', async () => {
      const job = makeJob()
      await repo.save(job)
      await repo.deleteById(job.id)

      const result = await repo.findById(job.id)
      expect(result.isOk()).toBe(true)
      if (!result.isOk()) return
      expect(result.value).toBeNull()
    })
  })
}
