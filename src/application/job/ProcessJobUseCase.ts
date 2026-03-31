import path from 'path'
import { type Result, ok, err } from '@shared/Result'
import type { AppError} from '@shared/AppError';
import { NotFoundError } from '@shared/AppError'
import type { ICacheService } from '@shared/ICacheService'
import type { ILogger } from '@shared/ILogger'
import type { IAudioTrackRepository } from '@domain/audio/IAudioTrackRepository'
import { AudioTrack, AudioTrackStatus } from '@domain/audio/AudioTrack'
import type { IProcessingJobRepository } from '@domain/job/IProcessingJobRepository'
import { ProcessingJob, JobStatus } from '@domain/job/ProcessingJob'
import type { IAudioProcessor } from './IAudioProcessor'

interface ProcessJobInput {
  jobId: string
}

/**
 * ProcessJobUseCase — executed by the worker when it consumes a message from audio.jobs.
 *
 * Flow:
 *   1. Load job + audio track from DB.
 *   2. Transition both to PROCESSING and persist.
 *   3. Process audio with ffmpeg via IAudioProcessor port.
 *   4. Transition both to COMPLETED/READY and persist.
 *   5. Invalidate the status cache so the next poll reflects the new state.
 */
export class ProcessJobUseCase {
  constructor(
    private readonly audioRepo: IAudioTrackRepository,
    private readonly jobRepo: IProcessingJobRepository,
    private readonly audioProcessor: IAudioProcessor,
    private readonly cache: ICacheService,
    private readonly logger: ILogger,
  ) {}

  async execute(input: ProcessJobInput): Promise<Result<void, AppError>> {
    // ── 1. Load entities ──────────────────────────────────────────────────

    const jobResult = await this.jobRepo.findById(input.jobId)
    if (jobResult.isErr()) return err(jobResult.error)
    if (!jobResult.value) return err(new NotFoundError('ProcessingJob', input.jobId))
    const job = jobResult.value

    const audioResult = await this.audioRepo.findById(job.audioTrackId)
    if (audioResult.isErr()) return err(audioResult.error)
    if (!audioResult.value) return err(new NotFoundError('AudioTrack', job.audioTrackId))
    const audio = audioResult.value

    // ── 2. Transition to PROCESSING ───────────────────────────────────────

    job.start()
    audio.markAsProcessing()

    const saveJobProcessing = await this.jobRepo.save(job)
    if (saveJobProcessing.isErr()) return err(saveJobProcessing.error)

    const saveAudioProcessing = await this.audioRepo.save(audio)
    if (saveAudioProcessing.isErr()) return err(saveAudioProcessing.error)

    this.logger.info('ProcessJobUseCase: processing started', { jobId: job.id })

    // ── 3. Process audio ──────────────────────────────────────────────────

    const ext = path.extname(audio.filePath)
    const outputPath = path.join(
      path.dirname(audio.filePath), '..', 'processed', `${audio.id}_${job.effect}${ext}`
    )

    const processingResult = await this.audioProcessor.applyEffect(
      audio.filePath, outputPath, job.effect
    )

    if (processingResult.isErr()) {
      await this.markAsFailed(job, audio, processingResult.error.message)
      return err(processingResult.error)
    }

    const { durationSeconds, processedFilePath } = processingResult.value

    // ── 4. Transition to COMPLETED / READY ────────────────────────────────

    job.complete()
    audio.setProcessedFilePath(processedFilePath)
    audio.markAsReady(durationSeconds)

    const saveJobCompleted = await this.jobRepo.save(job)
    if (saveJobCompleted.isErr()) {
      await this.markAsFailed(job, audio, 'failed to persist completed job')
      return err(saveJobCompleted.error)
    }

    const saveAudioReady = await this.audioRepo.save(audio)
    if (saveAudioReady.isErr()) {
      await this.markAsFailed(job, audio, 'failed to persist ready audio')
      return err(saveAudioReady.error)
    }

    // ── 5. Invalidate cache ───────────────────────────────────────────────

    await this.cache.del(`audio:status:${audio.id}`)

    this.logger.info('ProcessJobUseCase: processing completed', {
      jobId: job.id,
      audioTrackId: audio.id,
      durationSeconds,
    })

    return ok(undefined)
  }

  private async markAsFailed(
    job: ProcessingJob,
    audio: AudioTrack,
    reason: string,
  ): Promise<void> {
    this.logger.error('ProcessJobUseCase: marking as failed', {
      jobId: job.id,
      audioTrackId: audio.id,
      reason,
    })

    const failedJob = ProcessingJob.reconstitute({
      id:           job.id,
      audioTrackId: job.audioTrackId,
      effect:       job.effect,
      status:       JobStatus.PROCESSING,
      startedAt:    job.startedAt,
      createdAt:    job.createdAt,
    })
    failedJob.fail(reason)
    await this.jobRepo.save(failedJob)

    const failedAudio = AudioTrack.reconstitute({
      id:          audio.id,
      filename:    audio.filename,
      mimeType:    audio.mimeType,
      sizeInBytes: audio.sizeInBytes,
      filePath:    audio.filePath,
      status:      AudioTrackStatus.PROCESSING,
      createdAt:   audio.createdAt,
    })
    failedAudio.markAsFailed()
    await this.audioRepo.save(failedAudio)
  }
}
