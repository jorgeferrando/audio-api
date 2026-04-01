import { type Result, ok, err } from '@shared/Result'
import type { AppError } from '@shared/AppError'
import type { IAudioTrackRepository } from '@domain/audio/IAudioTrackRepository'
import type { AudioStatusDto } from './AudioStatusDto'

interface ListAudioInput {
  limit?: number
  offset?: number
}

interface ListAudioOutput {
  items: AudioStatusDto[]
  total: number
  limit: number
  offset: number
}

export class ListAudioTracksUseCase {
  constructor(
    private readonly audioRepo: IAudioTrackRepository,
  ) {}

  async execute(input: ListAudioInput = {}): Promise<Result<ListAudioOutput, AppError>> {
    const limit  = Math.min(input.limit ?? 50, 100)
    const offset = input.offset ?? 0

    const result = await this.audioRepo.findAll({ limit, offset })
    if (result.isErr()) return err(result.error)

    const items = result.value.items.map(audio => ({
      audioTrackId:    audio.id,
      filename:        audio.filename,
      mimeType:        audio.mimeType,
      sizeInBytes:     audio.sizeInBytes,
      status:          audio.status,
      durationSeconds: audio.durationSeconds,
      downloadReady:   !!audio.processedFilePath,
      createdAt:       audio.createdAt,
      job:             null,
    }))

    return ok({ items, total: result.value.total, limit, offset })
  }
}
