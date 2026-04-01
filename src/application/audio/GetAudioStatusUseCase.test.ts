import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GetAudioStatusUseCase } from './GetAudioStatusUseCase'
import { AudioTrack } from '@domain/audio/AudioTrack'
import { ProcessingJob, AudioEffect } from '@domain/job/ProcessingJob'
import type { IAudioTrackRepository } from '@domain/audio/IAudioTrackRepository'
import type { IProcessingJobRepository } from '@domain/job/IProcessingJobRepository'
import type { ICacheService } from '@shared/ICacheService'
import { ok, err } from '@shared/Result'
import { DatabaseError } from '@shared/AppError'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeAudioTrack(): AudioTrack {
  const result = AudioTrack.create({
    filename: 'song.mp3',
    mimeType: 'audio/mpeg',
    sizeInBytes: 1024,
    filePath: '/uploads/originals/song.mp3',
  })
  if (!result.isOk()) throw new Error('test setup failed')
  return result.value
}

function makeJob(audioTrackId: string): ProcessingJob {
  const result = ProcessingJob.create({ audioTrackId, effect: AudioEffect.NORMALIZE })
  if (!result.isOk()) throw new Error('test setup failed')
  return result.value
}

// ─── Mocks ───────────────────────────────────────────────────────────────────

const makeAudioRepo = (): IAudioTrackRepository => ({
  save: vi.fn(), findAll: vi.fn(), deleteById: vi.fn(),
  findById: vi.fn(),
})

const makeJobRepo = (): IProcessingJobRepository => ({
  save: vi.fn(),
  findById: vi.fn(),
  findByAudioTrackId: vi.fn(),
})

const makeCache = (): ICacheService => ({
  get: vi.fn().mockResolvedValue(null), // cache miss by default
  set: vi.fn().mockResolvedValue(undefined),
  del: vi.fn().mockResolvedValue(undefined),
})

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GetAudioStatusUseCase', () => {
  let audioRepo: IAudioTrackRepository
  let jobRepo: IProcessingJobRepository
  let cache: ICacheService
  let useCase: GetAudioStatusUseCase

  beforeEach(() => {
    audioRepo = makeAudioRepo()
    jobRepo   = makeJobRepo()
    cache     = makeCache()
    useCase   = new GetAudioStatusUseCase(audioRepo, jobRepo, cache)
  })

  describe('cache hit', () => {
    it('returns cached DTO without hitting the database', async () => {
      const cachedDto = { audioTrackId: 'abc', filename: 'song.mp3' }
      vi.mocked(cache.get).mockResolvedValue(cachedDto)

      const result = await useCase.execute({ audioTrackId: 'abc' })

      expect(result.isOk()).toBe(true)
      if (!result.isOk()) return
      expect(result.value).toBe(cachedDto)
      expect(audioRepo.findById).not.toHaveBeenCalled()
    })
  })

  describe('cache miss', () => {
    it('returns a DTO with audio and job data', async () => {
      const audio = makeAudioTrack()
      const job   = makeJob(audio.id)

      vi.mocked(audioRepo.findById).mockResolvedValue(ok(audio))
      vi.mocked(jobRepo.findByAudioTrackId).mockResolvedValue(ok(job))

      const result = await useCase.execute({ audioTrackId: audio.id })

      expect(result.isOk()).toBe(true)
      if (!result.isOk()) return
      expect(result.value.audioTrackId).toBe(audio.id)
      expect(result.value.filename).toBe('song.mp3')
      expect(result.value.job).not.toBeNull()
      expect(result.value.job!.effect).toBe(AudioEffect.NORMALIZE)
    })

    it('returns a DTO with null job when no job exists yet', async () => {
      const audio = makeAudioTrack()

      vi.mocked(audioRepo.findById).mockResolvedValue(ok(audio))
      vi.mocked(jobRepo.findByAudioTrackId).mockResolvedValue(ok(null))

      const result = await useCase.execute({ audioTrackId: audio.id })

      expect(result.isOk()).toBe(true)
      if (!result.isOk()) return
      expect(result.value.job).toBeNull()
    })

    it('caches the result after a DB hit', async () => {
      const audio = makeAudioTrack()
      vi.mocked(audioRepo.findById).mockResolvedValue(ok(audio))
      vi.mocked(jobRepo.findByAudioTrackId).mockResolvedValue(ok(null))

      await useCase.execute({ audioTrackId: audio.id })

      expect(cache.set).toHaveBeenCalledOnce()
    })

    it('uses a longer TTL for terminal states (READY)', async () => {
      const audio = makeAudioTrack()
      audio.markAsProcessing()
      audio.markAsReady(120)

      vi.mocked(audioRepo.findById).mockResolvedValue(ok(audio))
      vi.mocked(jobRepo.findByAudioTrackId).mockResolvedValue(ok(null))

      await useCase.execute({ audioTrackId: audio.id })

      const [, , ttl] = vi.mocked(cache.set).mock.calls[0]
      expect(ttl).toBe(5 * 60)
    })

    it('uses a short TTL for in-flight states (PENDING)', async () => {
      const audio = makeAudioTrack() // starts PENDING

      vi.mocked(audioRepo.findById).mockResolvedValue(ok(audio))
      vi.mocked(jobRepo.findByAudioTrackId).mockResolvedValue(ok(null))

      await useCase.execute({ audioTrackId: audio.id })

      const [, , ttl] = vi.mocked(cache.set).mock.calls[0]
      expect(ttl).toBe(5)
    })

    it('returns NotFoundError when audio track does not exist', async () => {
      vi.mocked(audioRepo.findById).mockResolvedValue(ok(null))

      const result = await useCase.execute({ audioTrackId: 'unknown-id' })

      expect(result.isErr()).toBe(true)
      if (!result.isErr()) return
      expect(result.error.code).toBe('NOT_FOUND')
    })

    it('returns DatabaseError if audio repo fails', async () => {
      vi.mocked(audioRepo.findById).mockResolvedValue(err(new DatabaseError('timeout')))

      const result = await useCase.execute({ audioTrackId: 'some-id' })

      expect(result.isErr()).toBe(true)
      if (!result.isErr()) return
      expect(result.error.code).toBe('DATABASE_ERROR')
      expect(jobRepo.findByAudioTrackId).not.toHaveBeenCalled()
    })

    it('returns DatabaseError if job repo fails', async () => {
      const audio = makeAudioTrack()
      vi.mocked(audioRepo.findById).mockResolvedValue(ok(audio))
      vi.mocked(jobRepo.findByAudioTrackId).mockResolvedValue(err(new DatabaseError('timeout')))

      const result = await useCase.execute({ audioTrackId: audio.id })

      expect(result.isErr()).toBe(true)
      if (!result.isErr()) return
      expect(result.error.code).toBe('DATABASE_ERROR')
    })
  })
})
