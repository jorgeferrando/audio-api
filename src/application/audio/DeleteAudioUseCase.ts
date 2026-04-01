import { type Result, ok, err } from '@shared/Result'
import type { AppError} from '@shared/AppError';
import { NotFoundError } from '@shared/AppError'
import type { IAudioTrackRepository } from '@domain/audio/IAudioTrackRepository'
import type { IFileStorage } from '@application/storage/IFileStorage'
import type { ILogger } from '@shared/ILogger'

interface DeleteAudioInput {
  audioTrackId: string
}

export class DeleteAudioUseCase {
  constructor(
    private readonly audioRepo: IAudioTrackRepository,
    private readonly fileStorage: IFileStorage,
    private readonly logger: ILogger,
  ) {}

  async execute(input: DeleteAudioInput): Promise<Result<void, AppError>> {
    const findResult = await this.audioRepo.findById(input.audioTrackId)
    if (findResult.isErr()) return err(findResult.error)
    if (!findResult.value) return err(new NotFoundError('AudioTrack', input.audioTrackId))

    const audio = findResult.value

    // Delete files from storage (best-effort — don't fail if already deleted)
    await this.fileStorage.delete(audio.filePath)
    if (audio.processedFilePath) {
      await this.fileStorage.delete(audio.processedFilePath)
    }

    const deleteResult = await this.audioRepo.deleteById(input.audioTrackId)
    if (deleteResult.isErr()) return err(deleteResult.error)

    this.logger.info('DeleteAudioUseCase: track deleted', { audioTrackId: input.audioTrackId })
    return ok(undefined)
  }
}
