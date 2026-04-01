import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DownloadAudioUseCase } from './DownloadAudioUseCase'
import { AudioTrack, AudioTrackStatus } from '@domain/audio/AudioTrack'
import type { IAudioTrackRepository } from '@domain/audio/IAudioTrackRepository'
import { ok, err } from '@shared/Result'
import { DatabaseError } from '@shared/AppError'

const makeAudioRepo = (): IAudioTrackRepository => ({
  save: vi.fn(), findAll: vi.fn(), deleteById: vi.fn(),
  findById: vi.fn(),
})

function makeReadyTrack(): AudioTrack {
  return AudioTrack.reconstitute({
    id: 'track-1',
    filename: 'song.mp3',
    mimeType: 'audio/mpeg',
    sizeInBytes: 1024,
    filePath: '/uploads/originals/song.mp3',
    processedFilePath: '/uploads/processed/track-1_REVERB.mp3',
    status: AudioTrackStatus.READY,
    durationSeconds: 120,
    createdAt: new Date(),
  })
}

describe('DownloadAudioUseCase', () => {
  let audioRepo: IAudioTrackRepository
  let useCase: DownloadAudioUseCase

  beforeEach(() => {
    audioRepo = makeAudioRepo()
    useCase   = new DownloadAudioUseCase(audioRepo)
  })

  it('returns filePath, filename and mimeType when track is ready', async () => {
    vi.mocked(audioRepo.findById).mockResolvedValue(ok(makeReadyTrack()))

    const result = await useCase.execute({ audioTrackId: 'track-1' })

    expect(result.isOk()).toBe(true)
    if (!result.isOk()) return
    expect(result.value.filePath).toBe('/uploads/processed/track-1_REVERB.mp3')
    expect(result.value.filename).toBe('song.mp3')
    expect(result.value.mimeType).toBe('audio/mpeg')
  })

  it('returns NOT_FOUND when track does not exist', async () => {
    vi.mocked(audioRepo.findById).mockResolvedValue(ok(null))

    const result = await useCase.execute({ audioTrackId: 'unknown' })

    expect(result.isErr()).toBe(true)
    if (!result.isErr()) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  it('returns NOT_READY when track has no processedFilePath', async () => {
    const pending = AudioTrack.create({
      filename: 'x.mp3', mimeType: 'audio/mpeg', sizeInBytes: 100, filePath: '/a.mp3',
    })
    if (!pending.isOk()) throw new Error('setup')
    vi.mocked(audioRepo.findById).mockResolvedValue(ok(pending.value))

    const result = await useCase.execute({ audioTrackId: pending.value.id })

    expect(result.isErr()).toBe(true)
    if (!result.isErr()) return
    expect(result.error.code).toBe('NOT_READY')
  })

  it('returns DatabaseError when repo fails', async () => {
    vi.mocked(audioRepo.findById).mockResolvedValue(err(new DatabaseError('timeout')))

    const result = await useCase.execute({ audioTrackId: 'track-1' })

    expect(result.isErr()).toBe(true)
    if (!result.isErr()) return
    expect(result.error.code).toBe('DATABASE_ERROR')
  })
})
