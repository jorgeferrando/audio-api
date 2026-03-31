import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProcessJobUseCase } from './ProcessJobUseCase'
import { AudioTrack } from '@domain/audio/AudioTrack'
import { ProcessingJob, AudioEffect, JobStatus } from '@domain/job/ProcessingJob'
import { AudioTrackStatus } from '@domain/audio/AudioTrack'
import type { IAudioTrackRepository } from '@domain/audio/IAudioTrackRepository'
import type { IProcessingJobRepository } from '@domain/job/IProcessingJobRepository'
import type { IAudioProcessor } from './IAudioProcessor'
import type { ICacheService } from '@shared/ICacheService'
import type { ILogger } from '@shared/ILogger'
import { ok, err } from '@shared/Result'
import { DatabaseError, AppError } from '@shared/AppError'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTrack(): AudioTrack {
  const r = AudioTrack.create({ filename: 'song.mp3', mimeType: 'audio/mpeg', sizeInBytes: 1024, filePath: '/uploads/originals/song.mp3' })
  if (!r.isOk()) throw new Error('setup failed')
  return r.value
}

function makeJob(audioTrackId: string): ProcessingJob {
  const r = ProcessingJob.create({ audioTrackId, effect: AudioEffect.NORMALIZE })
  if (!r.isOk()) throw new Error('setup failed')
  return r.value
}

// ─── Mocks ───────────────────────────────────────────────────────────────────

const makeAudioRepo = (): IAudioTrackRepository => ({
  save: vi.fn().mockResolvedValue(ok(undefined)),
  findById: vi.fn(),
})

const makeJobRepo = (): IProcessingJobRepository => ({
  save: vi.fn().mockResolvedValue(ok(undefined)),
  findById: vi.fn(),
  findByAudioTrackId: vi.fn(),
})

const makeAudioProcessor = (): IAudioProcessor => ({
  applyEffect: vi.fn().mockResolvedValue(ok({
    processedFilePath: '/uploads/processed/out.mp3',
    durationSeconds: 120.5,
  })),
})

const makeCache = (): ICacheService => ({
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn().mockResolvedValue(undefined),
})

const makeLogger = (): ILogger => ({
  info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
})

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ProcessJobUseCase', () => {
  let audioRepo: IAudioTrackRepository
  let jobRepo: IProcessingJobRepository
  let audioProcessor: IAudioProcessor
  let cache: ICacheService
  let logger: ILogger
  let useCase: ProcessJobUseCase

  beforeEach(() => {
    audioRepo      = makeAudioRepo()
    jobRepo        = makeJobRepo()
    audioProcessor = makeAudioProcessor()
    cache          = makeCache()
    logger         = makeLogger()
    useCase        = new ProcessJobUseCase(audioRepo, jobRepo, audioProcessor, cache, logger)
  })

  it('transitions both entities to PROCESSING then READY on success', async () => {
    const track = makeTrack()
    const job   = makeJob(track.id)

    vi.mocked(jobRepo.findById).mockResolvedValue(ok(job))
    vi.mocked(audioRepo.findById).mockResolvedValue(ok(track))

    const result = await useCase.execute({ jobId: job.id })

    expect(result.isOk()).toBe(true)
    expect(job.status).toBe(JobStatus.COMPLETED)
    expect(track.status).toBe(AudioTrackStatus.READY)
    expect(track.durationSeconds).toBe(120.5)
    expect(track.processedFilePath).toBe('/uploads/processed/out.mp3')
  })

  it('calls audioProcessor.applyEffect with correct args', async () => {
    const track = makeTrack()
    const job   = makeJob(track.id)

    vi.mocked(jobRepo.findById).mockResolvedValue(ok(job))
    vi.mocked(audioRepo.findById).mockResolvedValue(ok(track))

    await useCase.execute({ jobId: job.id })

    expect(audioProcessor.applyEffect).toHaveBeenCalledWith(
      track.filePath,
      expect.stringContaining(track.id),
      AudioEffect.NORMALIZE,
    )
  })

  it('saves both entities after each transition', async () => {
    const track = makeTrack()
    const job   = makeJob(track.id)

    vi.mocked(jobRepo.findById).mockResolvedValue(ok(job))
    vi.mocked(audioRepo.findById).mockResolvedValue(ok(track))

    await useCase.execute({ jobId: job.id })

    expect(jobRepo.save).toHaveBeenCalledTimes(2)
    expect(audioRepo.save).toHaveBeenCalledTimes(2)
  })

  it('invalidates the cache after processing', async () => {
    const track = makeTrack()
    const job   = makeJob(track.id)

    vi.mocked(jobRepo.findById).mockResolvedValue(ok(job))
    vi.mocked(audioRepo.findById).mockResolvedValue(ok(track))

    await useCase.execute({ jobId: job.id })

    expect(cache.del).toHaveBeenCalledWith(`audio:status:${track.id}`)
  })

  it('returns NotFoundError if job does not exist', async () => {
    vi.mocked(jobRepo.findById).mockResolvedValue(ok(null))

    const result = await useCase.execute({ jobId: 'unknown' })

    expect(result.isErr()).toBe(true)
    if (!result.isErr()) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  it('returns NotFoundError if audio track does not exist', async () => {
    const job = makeJob('track-id')
    vi.mocked(jobRepo.findById).mockResolvedValue(ok(job))
    vi.mocked(audioRepo.findById).mockResolvedValue(ok(null))

    const result = await useCase.execute({ jobId: job.id })

    expect(result.isErr()).toBe(true)
    if (!result.isErr()) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  it('marks both as FAILED when audioProcessor returns error', async () => {
    const track = makeTrack()
    const job   = makeJob(track.id)

    vi.mocked(jobRepo.findById).mockResolvedValue(ok(job))
    vi.mocked(audioRepo.findById).mockResolvedValue(ok(track))
    vi.mocked(audioProcessor.applyEffect).mockResolvedValue(
      err(new AppError('ffmpeg crashed', 'PROCESSING_ERROR'))
    )

    const result = await useCase.execute({ jobId: job.id })

    expect(result.isErr()).toBe(true)
    if (!result.isErr()) return
    expect(result.error.code).toBe('PROCESSING_ERROR')

    // Compensation saves
    expect(jobRepo.save).toHaveBeenCalledTimes(2) // PROCESSING + FAILED
    const lastJobSave = vi.mocked(jobRepo.save).mock.calls[1][0]
    expect(lastJobSave.status).toBe(JobStatus.FAILED)
  })

  it('saves FAILED entities to DB when a save fails mid-processing', async () => {
    const track = makeTrack()
    const job   = makeJob(track.id)

    vi.mocked(jobRepo.findById).mockResolvedValue(ok(job))
    vi.mocked(audioRepo.findById).mockResolvedValue(ok(track))

    vi.mocked(jobRepo.save)
      .mockResolvedValueOnce(ok(undefined))                          // job → PROCESSING
      .mockResolvedValueOnce(err(new DatabaseError('write failed'))) // job → COMPLETED
      .mockResolvedValueOnce(ok(undefined))                          // job → FAILED (compensation)

    const result = await useCase.execute({ jobId: job.id })

    expect(result.isErr()).toBe(true)

    expect(jobRepo.save).toHaveBeenCalledTimes(3)
    const lastJobSave = vi.mocked(jobRepo.save).mock.calls[2][0]
    expect(lastJobSave.status).toBe(JobStatus.FAILED)

    expect(audioRepo.save).toHaveBeenCalledTimes(2)
    const lastAudioSave = vi.mocked(audioRepo.save).mock.calls[1][0]
    expect(lastAudioSave.status).toBe(AudioTrackStatus.FAILED)
  })
})
