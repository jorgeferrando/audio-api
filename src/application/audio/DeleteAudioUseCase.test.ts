import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DeleteAudioUseCase } from './DeleteAudioUseCase'
import { AudioTrack, AudioTrackStatus } from '@domain/audio/AudioTrack'
import type { IAudioTrackRepository } from '@domain/audio/IAudioTrackRepository'
import type { IFileStorage } from '@application/storage/IFileStorage'
import type { ILogger } from '@shared/ILogger'
import { ok, err } from '@shared/Result'
import { DatabaseError } from '@shared/AppError'

const makeRepo = (): IAudioTrackRepository => ({
  save: vi.fn(), findById: vi.fn(), findAll: vi.fn(),
  deleteById: vi.fn().mockResolvedValue(ok(undefined)),
})

const makeStorage = (): IFileStorage => ({
  upload: vi.fn(), download: vi.fn(),
  delete: vi.fn().mockResolvedValue(ok(undefined)),
})

const makeLogger = (): ILogger => ({
  info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
})

function makeTrack(processedFilePath?: string): AudioTrack {
  return AudioTrack.reconstitute({
    id: 'track-1', filename: 'song.mp3', mimeType: 'audio/mpeg',
    sizeInBytes: 1024, filePath: 'originals/song.mp3', processedFilePath,
    status: processedFilePath ? AudioTrackStatus.READY : AudioTrackStatus.PENDING,
    createdAt: new Date(),
  })
}

describe('DeleteAudioUseCase', () => {
  let repo: IAudioTrackRepository
  let storage: IFileStorage
  let useCase: DeleteAudioUseCase

  beforeEach(() => {
    repo    = makeRepo()
    storage = makeStorage()
    useCase = new DeleteAudioUseCase(repo, storage, makeLogger())
  })

  it('deletes files from storage and track from DB', async () => {
    vi.mocked(repo.findById).mockResolvedValue(ok(makeTrack('processed/out.mp3')))

    const result = await useCase.execute({ audioTrackId: 'track-1' })

    expect(result.isOk()).toBe(true)
    expect(storage.delete).toHaveBeenCalledWith('originals/song.mp3')
    expect(storage.delete).toHaveBeenCalledWith('processed/out.mp3')
    expect(repo.deleteById).toHaveBeenCalledWith('track-1')
  })

  it('skips processed file deletion if not yet processed', async () => {
    vi.mocked(repo.findById).mockResolvedValue(ok(makeTrack()))

    await useCase.execute({ audioTrackId: 'track-1' })

    expect(storage.delete).toHaveBeenCalledTimes(1)
    expect(storage.delete).toHaveBeenCalledWith('originals/song.mp3')
  })

  it('returns NOT_FOUND if track does not exist', async () => {
    vi.mocked(repo.findById).mockResolvedValue(ok(null))

    const result = await useCase.execute({ audioTrackId: 'unknown' })

    expect(result.isErr()).toBe(true)
    if (!result.isErr()) return
    expect(result.error.code).toBe('NOT_FOUND')
    expect(repo.deleteById).not.toHaveBeenCalled()
  })

  it('returns DatabaseError if delete fails', async () => {
    vi.mocked(repo.findById).mockResolvedValue(ok(makeTrack()))
    vi.mocked(repo.deleteById).mockResolvedValue(err(new DatabaseError('failed')))

    const result = await useCase.execute({ audioTrackId: 'track-1' })

    expect(result.isErr()).toBe(true)
    if (!result.isErr()) return
    expect(result.error.code).toBe('DATABASE_ERROR')
  })
})
