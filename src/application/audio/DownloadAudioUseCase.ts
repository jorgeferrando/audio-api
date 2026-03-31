import { type Result, ok, err } from '@shared/Result'
import { AppError, NotFoundError } from '@shared/AppError'
import type { IAudioTrackRepository } from '@domain/audio/IAudioTrackRepository'

interface DownloadAudioInput {
  audioTrackId: string
}

interface DownloadAudioOutput {
  filePath: string
  filename: string
  mimeType: string
}

export class DownloadAudioUseCase {
  constructor(
    private readonly audioRepo: IAudioTrackRepository,
  ) {}

  async execute(input: DownloadAudioInput): Promise<Result<DownloadAudioOutput, AppError>> {
    const result = await this.audioRepo.findById(input.audioTrackId)
    if (result.isErr()) return err(result.error)

    if (!result.value) {
      return err(new NotFoundError('AudioTrack', input.audioTrackId))
    }

    const audio = result.value

    if (!audio.processedFilePath) {
      return err(new AppError('Audio is not ready for download', 'NOT_READY'))
    }

    return ok({
      filePath: audio.processedFilePath,
      filename: audio.filename,
      mimeType: audio.mimeType,
    })
  }
}
