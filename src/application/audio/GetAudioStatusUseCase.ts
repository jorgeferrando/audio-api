import { type Result, ok, err } from '@shared/Result'
import { AppError, NotFoundError } from '@shared/AppError'
import { ILogger } from '@shared/ILogger'
import { AudioTrack } from '@domain/audio/AudioTrack'
import { IAudioTrackRepository } from '@domain/audio/IAudioTrackRepository'
import { ProcessingJob } from '@domain/job/ProcessingJob'
import { IProcessingJobRepository } from '@domain/job/IProcessingJobRepository'

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
    private readonly logger: ILogger,
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
