import { type Result, ok, err } from '@shared/Result'
import type { AppError } from '@shared/AppError'
import type { ILogger } from '@shared/ILogger'
import { AudioTrack } from '@domain/audio/AudioTrack'
import type { IAudioTrackRepository } from '@domain/audio/IAudioTrackRepository'
import type { AudioEffect } from '@domain/job/ProcessingJob';
import { ProcessingJob } from '@domain/job/ProcessingJob'
import type { IProcessingJobRepository } from '@domain/job/IProcessingJobRepository'
import type { IJobPublisher } from '@application/job/IJobPublisher'

interface UploadAudioInput {
  filename: string
  mimeType: string
  sizeInBytes: number
  effect: AudioEffect
  filePath: string
}

interface UploadAudioOutput {
  audioTrackId: string
  jobId: string
}

/**
 * UploadAudioUseCase — orchestrates the upload flow.
 *
 * Steps:
 *   1. Validate and create AudioTrack (domain factory, returns Result).
 *   2. Validate and create ProcessingJob linked to the track.
 *   3. Persist both entities.
 *   4. Publish the job to the message queue for async processing.
 *
 * Early-return pattern: each step returns on failure so the happy path
 * reads top-to-bottom without nested if/else blocks.
 *
 * Note on atomicity: saving to DB and publishing to the queue are two separate
 * operations — if the publish fails after both saves succeed, the job stays in
 * DB but won't be processed. A production-grade solution would use an outbox
 * pattern; for this portfolio scope the use case returns an error and the client
 * can retry the upload.
 */
export class UploadAudioUseCase {
  constructor(
    private readonly audioRepo: IAudioTrackRepository,
    private readonly jobRepo: IProcessingJobRepository,
    private readonly publisher: IJobPublisher,
    private readonly logger: ILogger,
  ) {}

  async execute(input: UploadAudioInput): Promise<Result<UploadAudioOutput, AppError>> {
    const audioResult = AudioTrack.create({
      filename: input.filename,
      mimeType: input.mimeType,
      sizeInBytes: input.sizeInBytes,
      filePath: input.filePath,
    })
    if (audioResult.isErr()) return err(audioResult.error)

    const audio = audioResult.value

    const jobResult = ProcessingJob.create({
      audioTrackId: audio.id,
      effect: input.effect,
    })
    if (jobResult.isErr()) return err(jobResult.error)

    const job = jobResult.value

    const saveAudioResult = await this.audioRepo.save(audio)
    if (saveAudioResult.isErr()) return err(saveAudioResult.error)

    const saveJobResult = await this.jobRepo.save(job)
    if (saveJobResult.isErr()) return err(saveJobResult.error)

    const publishResult = await this.publisher.publish(job)
    if (publishResult.isErr()) {
      this.logger.error('UploadAudioUseCase: failed to publish job', {
        jobId: job.id,
        audioTrackId: audio.id,
        error: publishResult.error.message,
      })
      return err(publishResult.error)
    }

    this.logger.info('UploadAudioUseCase: audio uploaded and job queued', {
      audioTrackId: audio.id,
      jobId: job.id,
      effect: job.effect,
    })

    return ok({ audioTrackId: audio.id, jobId: job.id })
  }
}
