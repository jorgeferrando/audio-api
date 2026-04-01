import { type Result, ok, err } from '@shared/Result'
import type { AppError } from '@shared/AppError'
import type { IAudioTrackRepository } from '@domain/audio/IAudioTrackRepository'
import type { AudioStatusDto } from './AudioStatusDto'

export class ListAudioTracksUseCase {
  constructor(
    private readonly audioRepo: IAudioTrackRepository,
  ) {}

  async execute(): Promise<Result<AudioStatusDto[], AppError>> {
    const result = await this.audioRepo.findAll()
    if (result.isErr()) return err(result.error)

    return ok(result.value.map(audio => ({
      audioTrackId:    audio.id,
      filename:        audio.filename,
      mimeType:        audio.mimeType,
      sizeInBytes:     audio.sizeInBytes,
      status:          audio.status,
      durationSeconds: audio.durationSeconds,
      downloadReady:   !!audio.processedFilePath,
      createdAt:       audio.createdAt,
      job:             null,
    })))
  }
}
