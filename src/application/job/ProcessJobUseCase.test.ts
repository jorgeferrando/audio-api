import { Readable } from 'stream'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    default: {
      ...actual,
      unlinkSync: vi.fn(),
      createWriteStream: vi.fn().mockReturnValue({
        on: vi.fn().mockReturnThis(),
        once: vi.fn().mockReturnThis(),
        emit: vi.fn().mockReturnThis(),
        write: vi.fn().mockReturnThis(),
        end: vi.fn().mockReturnThis(),
      }),
    },
  }
})

vi.mock('fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue(Buffer.from('processed-audio')),
}))

vi.mock('stream/promises', () => ({
  pipeline: vi.fn().mockResolvedValue(undefined),
}))
import { ProcessJobUseCase } from './ProcessJobUseCase'
import { AudioTrack } from '@domain/audio/AudioTrack'
import { ProcessingJob, AudioEffect, JobStatus } from '@domain/job/ProcessingJob'
import { AudioTrackStatus } from '@domain/audio/AudioTrack'
import type { IAudioTrackRepository } from '@domain/audio/IAudioTrackRepository'
import type { IProcessingJobRepository } from '@domain/job/IProcessingJobRepository'
import type { IAudioProcessor } from './IAudioProcessor'
import type { IFileStorage } from '@application/storage/IFileStorage'
import type { ICacheService } from '@shared/ICacheService'
import type { ILogger } from '@shared/ILogger'
import { ok, err } from '@shared/Result'
import { DatabaseError, AppError, StorageError } from '@shared/AppError'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTrack(): AudioTrack {
  const r = AudioTrack.create({ filename: 'song.mp3', mimeType: 'audio/mpeg', sizeInBytes: 1024, filePath: 'originals/song.mp3' })
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
    processedFilePath: '/tmp/out.mp3',
    durationSeconds: 120.5,
  })),
})

const makeFileStorage = (): IFileStorage => ({
  upload: vi.fn().mockResolvedValue(ok(undefined)),
  download: vi.fn().mockResolvedValue(ok(Readable.from(Buffer.from('audio-data')))),
  delete: vi.fn().mockResolvedValue(ok(undefined)),
})

const makeCache = (): ICacheService => ({
  get: vi.fn(), set: vi.fn(), del: vi.fn().mockResolvedValue(undefined),
})

const makeLogger = (): ILogger => ({
  info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
})

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ProcessJobUseCase', () => {
  let audioRepo: IAudioTrackRepository
  let jobRepo: IProcessingJobRepository
  let audioProcessor: IAudioProcessor
  let fileStorage: IFileStorage
  let cache: ICacheService
  let logger: ILogger
  let useCase: ProcessJobUseCase

  beforeEach(() => {
    audioRepo      = makeAudioRepo()
    jobRepo        = makeJobRepo()
    audioProcessor = makeAudioProcessor()
    fileStorage    = makeFileStorage()
    cache          = makeCache()
    logger         = makeLogger()
    useCase        = new ProcessJobUseCase(audioRepo, jobRepo, audioProcessor, fileStorage, cache, logger)
  })

  it('downloads from storage, processes, uploads result, and transitions to READY', async () => {
    const track = makeTrack()
    const job   = makeJob(track.id)

    vi.mocked(jobRepo.findById).mockResolvedValue(ok(job))
    vi.mocked(audioRepo.findById).mockResolvedValue(ok(track))

    const result = await useCase.execute({ jobId: job.id })

    expect(result.isOk()).toBe(true)
    expect(fileStorage.download).toHaveBeenCalledWith('originals/song.mp3')
    expect(audioProcessor.applyEffect).toHaveBeenCalledOnce()
    expect(fileStorage.upload).toHaveBeenCalledOnce()
    expect(job.status).toBe(JobStatus.COMPLETED)
    expect(track.status).toBe(AudioTrackStatus.READY)
    expect(track.processedFilePath).toMatch(/^processed\//)
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

  it('marks both as FAILED when storage download fails', async () => {
    const track = makeTrack()
    const job   = makeJob(track.id)
    vi.mocked(jobRepo.findById).mockResolvedValue(ok(job))
    vi.mocked(audioRepo.findById).mockResolvedValue(ok(track))
    vi.mocked(fileStorage.download).mockResolvedValue(err(new StorageError('not found')))

    const result = await useCase.execute({ jobId: job.id })

    expect(result.isErr()).toBe(true)
    // Compensation: PROCESSING save + FAILED save = 2
    expect(jobRepo.save).toHaveBeenCalledTimes(2)
    const lastJobSave = vi.mocked(jobRepo.save).mock.calls[1][0]
    expect(lastJobSave.status).toBe(JobStatus.FAILED)
  })

  it('marks both as FAILED when audio processing fails', async () => {
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
  })

  it('saves FAILED entities when a DB save fails mid-processing', async () => {
    const track = makeTrack()
    const job   = makeJob(track.id)
    vi.mocked(jobRepo.findById).mockResolvedValue(ok(job))
    vi.mocked(audioRepo.findById).mockResolvedValue(ok(track))

    vi.mocked(jobRepo.save)
      .mockResolvedValueOnce(ok(undefined))                          // PROCESSING
      .mockResolvedValueOnce(err(new DatabaseError('write failed'))) // COMPLETED
      .mockResolvedValueOnce(ok(undefined))                          // FAILED compensation

    const result = await useCase.execute({ jobId: job.id })

    expect(result.isErr()).toBe(true)
    expect(jobRepo.save).toHaveBeenCalledTimes(3)
    const lastJobSave = vi.mocked(jobRepo.save).mock.calls[2][0]
    expect(lastJobSave.status).toBe(JobStatus.FAILED)
  })
})
