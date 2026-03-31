import { type Result, ok, err } from '@shared/Result'
import type { AppError} from '@shared/AppError';
import { NotFoundError } from '@shared/AppError'
import type { AudioTrack } from '@domain/audio/AudioTrack'
import type { IAudioTrackRepository } from '@domain/audio/IAudioTrackRepository'
import type { ProcessingJob } from '@domain/job/ProcessingJob'
import type { IProcessingJobRepository } from '@domain/job/IProcessingJobRepository'

interface GetAudioStatusInput {
  audioTrackId: string
}

interface GetAudioStatusOutput {
  audio: AudioTrack
  job: ProcessingJob | null
}

export class GetAudioStatusUseCase {
  constructor(
    private readonly audioRepo: IAudioTrackRepository,
    private readonly jobRepo: IProcessingJobRepository,
  ) {}

  async execute(input: GetAudioStatusInput): Promise<Result<GetAudioStatusOutput, AppError>> {
    const audioResult = await this.audioRepo.findById(input.audioTrackId)
    if (audioResult.isErr()) return err(audioResult.error)

    if (audioResult.value === null) {
      return err(new NotFoundError('AudioTrack', input.audioTrackId))
    }

    const audio = audioResult.value

    const jobResult = await this.jobRepo.findByAudioTrackId(input.audioTrackId)
    if (jobResult.isErr()) return err(jobResult.error)

    return ok({ audio, job: jobResult.value })
  }
}
