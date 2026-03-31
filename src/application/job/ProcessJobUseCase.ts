import { type Result, ok, err } from '@shared/Result'
import type { AppError} from '@shared/AppError';
import { NotFoundError } from '@shared/AppError'
import type { ICacheService } from '@shared/ICacheService'
import type { ILogger } from '@shared/ILogger'
import type { IAudioTrackRepository } from '@domain/audio/IAudioTrackRepository'
import { AudioTrack, AudioTrackStatus } from '@domain/audio/AudioTrack'
import type { IProcessingJobRepository } from '@domain/job/IProcessingJobRepository'
import { ProcessingJob, JobStatus } from '@domain/job/ProcessingJob'

interface ProcessJobInput {
  jobId: string
}

/**
 * ProcessJobUseCase — executed by the worker when it consumes a message from audio.jobs.
 *
 * Flow:
 *   1. Load job + audio track from DB.
 *   2. Transition both to PROCESSING and persist.
 *   3. Simulate audio processing (random duration).
 *   4. Transition both to COMPLETED/READY and persist.
 *   5. Invalidate the status cache so the next poll reflects the new state.
 *
 * Error compensation: if any step after PROCESSING is persisted fails, we call
 * markAsFailed(). This reconstitutes fresh entities in PROCESSING state (their last
 * known DB state) so the state machine allows the FAILED transition. The original
 * in-memory entities are not mutated — their state is irrelevant at this point.
 */
export class ProcessJobUseCase {
  constructor(
    private readonly audioRepo: IAudioTrackRepository,
    private readonly jobRepo: IProcessingJobRepository,
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

    // ── 3. Simulate processing ────────────────────────────────────────────

    const durationSeconds = await simulateProcessing()

    // ── 4. Transition to COMPLETED / READY ────────────────────────────────
    // From here on, any failure triggers compensation: both entities are
    // marked FAILED in DB to prevent them being stuck in PROCESSING forever.

    job.complete()
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

  /**
   * Compensation: persist FAILED status for both entities after a mid-processing error.
   *
   * We reconstitute fresh entities in PROCESSING state (their last confirmed DB state)
   * because the originals may have already been transitioned in memory (to COMPLETED/READY)
   * and the state machine would reject a FAILED transition from those states.
   * `reconstitute()` bypasses domain validation — we intentionally set PROCESSING
   * so the FAILED transition is valid.
   */
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

/**
 * Simulates audio processing with a realistic random duration.
 * In production this would call an actual audio processing library.
 */
async function simulateProcessing(): Promise<number> {
  const durationSeconds = Math.random() * 300 + 30 // 30–330 seconds of audio
  await new Promise(resolve => setTimeout(resolve, 100))
  return Math.round(durationSeconds * 10) / 10
}
