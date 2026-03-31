import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UploadAudioUseCase } from './UploadAudioUseCase'
import { AudioEffect } from '@domain/job/ProcessingJob'
import { IAudioTrackRepository } from '@domain/audio/IAudioTrackRepository'
import { IProcessingJobRepository } from '@domain/job/IProcessingJobRepository'
import { IJobPublisher } from '@application/job/IJobPublisher'
import { ILogger } from '@shared/ILogger'
import { ok, err } from '@shared/Result'
import { DatabaseError, AppError } from '@shared/AppError'

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

const makePublisher = (): IJobPublisher => ({
  publish: vi.fn().mockResolvedValue(ok(undefined)),
})

const makeLogger = (): ILogger => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
})

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('UploadAudioUseCase', () => {
  let audioRepo: IAudioTrackRepository
  let jobRepo: IProcessingJobRepository
  let publisher: IJobPublisher
  let logger: ILogger
  let useCase: UploadAudioUseCase

  const validInput = {
    filename: 'song.mp3',
    mimeType: 'audio/mpeg',
    sizeInBytes: 1024 * 1024, // 1MB
    effect: AudioEffect.NORMALIZE,
  }

  beforeEach(() => {
    audioRepo = makeAudioRepo()
    jobRepo   = makeJobRepo()
    publisher = makePublisher()
    logger    = makeLogger()
    useCase   = new UploadAudioUseCase(audioRepo, jobRepo, publisher, logger)
  })

  it('returns audioTrackId and jobId on success', async () => {
    const result = await useCase.execute(validInput)

    expect(result.isOk()).toBe(true)
    if (!result.isOk()) return

    expect(result.value.audioTrackId).toBeDefined()
    expect(result.value.jobId).toBeDefined()
  })

  it('saves the audio track to the repository', async () => {
    await useCase.execute(validInput)

    expect(audioRepo.save).toHaveBeenCalledOnce()
  })

  it('saves the processing job to the repository', async () => {
    await useCase.execute(validInput)

    expect(jobRepo.save).toHaveBeenCalledOnce()
  })

  it('publishes the job to the queue', async () => {
    await useCase.execute(validInput)

    expect(publisher.publish).toHaveBeenCalledOnce()
  })

  it('returns ValidationError if audio track creation fails', async () => {
    const result = await useCase.execute({
      ...validInput,
      mimeType: 'application/pdf', // invalid
    })

    expect(result.isErr()).toBe(true)
    if (!result.isErr()) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(audioRepo.save).not.toHaveBeenCalled()
    expect(jobRepo.save).not.toHaveBeenCalled()
    expect(publisher.publish).not.toHaveBeenCalled()
  })

  it('returns DatabaseError if audio repo save fails', async () => {
    vi.mocked(audioRepo.save).mockResolvedValue(
      err(new DatabaseError('connection lost'))
    )

    const result = await useCase.execute(validInput)

    expect(result.isErr()).toBe(true)
    if (!result.isErr()) return
    expect(result.error.code).toBe('DATABASE_ERROR')
    expect(jobRepo.save).not.toHaveBeenCalled()
    expect(publisher.publish).not.toHaveBeenCalled()
  })

  it('returns DatabaseError if job repo save fails', async () => {
    vi.mocked(jobRepo.save).mockResolvedValue(
      err(new DatabaseError('write failed'))
    )

    const result = await useCase.execute(validInput)

    expect(result.isErr()).toBe(true)
    if (!result.isErr()) return
    expect(result.error.code).toBe('DATABASE_ERROR')
    expect(publisher.publish).not.toHaveBeenCalled()
  })

  it('returns error if publishing to the queue fails', async () => {
    vi.mocked(publisher.publish).mockResolvedValue(
      err(new AppError('broker unavailable', 'QUEUE_ERROR'))
    )

    const result = await useCase.execute(validInput)

    expect(result.isErr()).toBe(true)
    if (!result.isErr()) return
    expect(result.error.code).toBe('QUEUE_ERROR')
  })
})
