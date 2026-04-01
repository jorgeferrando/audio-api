import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ListAudioTracksUseCase } from './ListAudioTracksUseCase'
import { AudioTrack, AudioTrackStatus } from '@domain/audio/AudioTrack'
import type { IAudioTrackRepository } from '@domain/audio/IAudioTrackRepository'
import { ok, err } from '@shared/Result'
import { DatabaseError } from '@shared/AppError'

function makeTrack(filename: string): AudioTrack {
  return AudioTrack.reconstitute({
    id: `id-${filename}`, filename, mimeType: 'audio/mpeg',
    sizeInBytes: 1024, filePath: `originals/${filename}`,
    status: AudioTrackStatus.READY, durationSeconds: 120,
    createdAt: new Date(),
  })
}

const makeRepo = (): IAudioTrackRepository => ({
  save: vi.fn(), findById: vi.fn(), findAll: vi.fn(), deleteById: vi.fn(),
})

describe('ListAudioTracksUseCase', () => {
  let repo: IAudioTrackRepository
  let useCase: ListAudioTracksUseCase

  beforeEach(() => {
    repo = makeRepo()
    useCase = new ListAudioTracksUseCase(repo)
  })

  it('returns paginated items with total count', async () => {
    const items = [makeTrack('a.mp3'), makeTrack('b.mp3')]
    vi.mocked(repo.findAll).mockResolvedValue(ok({ items, total: 5 }))

    const result = await useCase.execute({ limit: 2, offset: 0 })

    expect(result.isOk()).toBe(true)
    if (!result.isOk()) return
    expect(result.value.items).toHaveLength(2)
    expect(result.value.total).toBe(5)
    expect(result.value.limit).toBe(2)
    expect(result.value.offset).toBe(0)
  })

  it('caps limit at 100', async () => {
    vi.mocked(repo.findAll).mockResolvedValue(ok({ items: [], total: 0 }))

    await useCase.execute({ limit: 999 })

    expect(repo.findAll).toHaveBeenCalledWith({ limit: 100, offset: 0 })
  })

  it('defaults to limit=50, offset=0', async () => {
    vi.mocked(repo.findAll).mockResolvedValue(ok({ items: [], total: 0 }))

    await useCase.execute()

    expect(repo.findAll).toHaveBeenCalledWith({ limit: 50, offset: 0 })
  })

  it('returns DatabaseError if repo fails', async () => {
    vi.mocked(repo.findAll).mockResolvedValue(err(new DatabaseError('timeout')))

    const result = await useCase.execute()

    expect(result.isErr()).toBe(true)
    if (!result.isErr()) return
    expect(result.error.code).toBe('DATABASE_ERROR')
  })
})
