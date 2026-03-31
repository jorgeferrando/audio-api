import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GetAudioStatusUseCase } from './GetAudioStatusUseCase'
import { AudioTrack } from '@domain/audio/AudioTrack'
import { ProcessingJob, AudioEffect } from '@domain/job/ProcessingJob'
import type { IAudioTrackRepository } from '@domain/audio/IAudioTrackRepository'
import type { IProcessingJobRepository } from '@domain/job/IProcessingJobRepository'
import { ok, err } from '@shared/Result'
import { DatabaseError } from '@shared/AppError'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeAudioTrack(): AudioTrack {
  const result = AudioTrack.create({
    filename: 'song.mp3',
    mimeType: 'audio/mpeg',
    sizeInBytes: 1024,
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
  save: vi.fn(),
  findById: vi.fn(),
})

const makeJobRepo = (): IProcessingJobRepository => ({
  save: vi.fn(),
  findById: vi.fn(),
  findByAudioTrackId: vi.fn(),
})

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GetAudioStatusUseCase', () => {
  let audioRepo: IAudioTrackRepository
  let jobRepo: IProcessingJobRepository
  let useCase: GetAudioStatusUseCase

  beforeEach(() => {
    audioRepo = makeAudioRepo()
    jobRepo   = makeJobRepo()
    useCase   = new GetAudioStatusUseCase(audioRepo, jobRepo)
  })

  it('returns audio and job when both exist', async () => {
    const audio = makeAudioTrack()
    const job   = makeJob(audio.id)

    vi.mocked(audioRepo.findById).mockResolvedValue(ok(audio))
    vi.mocked(jobRepo.findByAudioTrackId).mockResolvedValue(ok(job))

    const result = await useCase.execute({ audioTrackId: audio.id })

    expect(result.isOk()).toBe(true)
    if (!result.isOk()) return
    expect(result.value.audio).toBe(audio)
    expect(result.value.job).toBe(job)
  })

  it('returns audio with null job when job does not exist yet', async () => {
    const audio = makeAudioTrack()

    vi.mocked(audioRepo.findById).mockResolvedValue(ok(audio))
    vi.mocked(jobRepo.findByAudioTrackId).mockResolvedValue(ok(null))

    const result = await useCase.execute({ audioTrackId: audio.id })

    expect(result.isOk()).toBe(true)
    if (!result.isOk()) return
    expect(result.value.audio).toBe(audio)
    expect(result.value.job).toBeNull()
  })

  it('returns NotFoundError when audio track does not exist', async () => {
    vi.mocked(audioRepo.findById).mockResolvedValue(ok(null))

    const result = await useCase.execute({ audioTrackId: 'unknown-id' })

    expect(result.isErr()).toBe(true)
    if (!result.isErr()) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  it('returns DatabaseError if audio repo fails', async () => {
    vi.mocked(audioRepo.findById).mockResolvedValue(
      err(new DatabaseError('timeout'))
    )

    const result = await useCase.execute({ audioTrackId: 'some-id' })

    expect(result.isErr()).toBe(true)
    if (!result.isErr()) return
    expect(result.error.code).toBe('DATABASE_ERROR')
    expect(jobRepo.findByAudioTrackId).not.toHaveBeenCalled()
  })

  it('returns DatabaseError if job repo fails', async () => {
    const audio = makeAudioTrack()

    vi.mocked(audioRepo.findById).mockResolvedValue(ok(audio))
    vi.mocked(jobRepo.findByAudioTrackId).mockResolvedValue(
      err(new DatabaseError('timeout'))
    )

    const result = await useCase.execute({ audioTrackId: audio.id })

    expect(result.isErr()).toBe(true)
    if (!result.isErr()) return
    expect(result.error.code).toBe('DATABASE_ERROR')
  })
})
