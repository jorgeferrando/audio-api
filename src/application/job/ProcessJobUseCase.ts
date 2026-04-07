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
import type { IFileStorage } from '@application/storage/IFileStorage'
import type { ITempFileManager } from './ITempFileManager'

interface ProcessJobInput {
  jobId: string
}

/**
 * ProcessJobUseCase — executed by the worker when it consumes a message from audio.jobs.
 *
 * Flow:
 *   1. Load job + audio track from DB.
 *   2. Transition both to PROCESSING and persist.
 *   3. Download original from object storage to temp file.
 *   4. Process audio with ffmpeg (local temp files).
 *   5. Upload processed file back to object storage.
 *   6. Transition both to COMPLETED/READY and persist.
 *   7. Clean up temp files and invalidate cache.
 */
export class ProcessJobUseCase {
  constructor(
    private readonly audioRepo: IAudioTrackRepository,
    private readonly jobRepo: IProcessingJobRepository,
    private readonly audioProcessor: IAudioProcessor,
    private readonly fileStorage: IFileStorage,
    private readonly cache: ICacheService,
    private readonly logger: ILogger,
    private readonly tempFiles: ITempFileManager,
  ) {}

  async execute(input: ProcessJobInput): Promise<Result<void, AppError>> {
    const jobResult = await this.jobRepo.findById(input.jobId)
    if (jobResult.isErr()) return err(jobResult.error)
    if (!jobResult.value) return err(new NotFoundError('ProcessingJob', input.jobId))
    const job = jobResult.value

    const audioResult = await this.audioRepo.findById(job.audioTrackId)
    if (audioResult.isErr()) return err(audioResult.error)
    if (!audioResult.value) return err(new NotFoundError('AudioTrack', job.audioTrackId))
    const audio = audioResult.value

    // ── Transition to PROCESSING ──────────────────────────────────────────

    job.start()
    audio.markAsProcessing()

    const saveJobProcessing = await this.jobRepo.save(job)
    if (saveJobProcessing.isErr()) return err(saveJobProcessing.error)

    const saveAudioProcessing = await this.audioRepo.save(audio)
    if (saveAudioProcessing.isErr()) return err(saveAudioProcessing.error)

    this.logger.info('ProcessJobUseCase: processing started', { jobId: job.id })

    // ── Download from storage → temp file ─────────────────────────────────

    const ext = path.extname(audio.filePath)
    const { inputPath: tempInput, outputPath: tempOutput } = this.tempFiles.createTempPaths(ext)

    try {
      const downloadResult = await this.fileStorage.download(audio.filePath)
      if (downloadResult.isErr()) {
        await this.markAsFailed(job, audio, 'failed to download from storage')
        return err(downloadResult.error)
      }

      const writeResult = await this.tempFiles.writeStream(tempInput, downloadResult.value)
      if (writeResult.isErr()) {
        await this.markAsFailed(job, audio, 'failed to write stream to temp file')
        return err(writeResult.error)
      }

      // ── Process with ffmpeg ───────────────────────────────────────────────

      const processingResult = await this.audioProcessor.applyEffect(tempInput, tempOutput, job.effect)
      if (processingResult.isErr()) {
        await this.markAsFailed(job, audio, processingResult.error.message)
        return err(processingResult.error)
      }

      const { durationSeconds } = processingResult.value

      // ── Upload processed file back to storage ─────────────────────────────

      const outputKey = `processed/${audio.id}_${job.effect}${ext}`
      const sizeResult = await this.tempFiles.getFileSize(tempOutput)
      if (sizeResult.isErr()) {
        await this.markAsFailed(job, audio, 'failed to stat processed file')
        return err(sizeResult.error)
      }
      const processedStream = this.tempFiles.createReadStream(tempOutput)

      const uploadResult = await this.fileStorage.upload(outputKey, processedStream, audio.mimeType, sizeResult.value)
      if (uploadResult.isErr()) {
        await this.markAsFailed(job, audio, 'failed to upload processed file')
        return err(uploadResult.error)
      }

      // ── Transition to COMPLETED / READY ───────────────────────────────────

      job.complete()
      audio.setProcessedFilePath(outputKey)
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

      await this.cache.del(`audio:status:${audio.id}`)

      this.logger.info('ProcessJobUseCase: processing completed', {
        jobId: job.id, audioTrackId: audio.id, durationSeconds,
      })

      return ok(undefined)
    } finally {
      // ── Cleanup temp files ──────────────────────────────────────────────
      this.tempFiles.cleanup([tempInput, tempOutput])
    }
  }

  private async markAsFailed(
    job: ProcessingJob, audio: AudioTrack, reason: string,
  ): Promise<void> {
    this.logger.error('ProcessJobUseCase: marking as failed', {
      jobId: job.id, audioTrackId: audio.id, reason,
    })

    const failedJob = ProcessingJob.reconstitute({
      id: job.id, audioTrackId: job.audioTrackId, effect: job.effect,
      status: JobStatus.PROCESSING, startedAt: job.startedAt, createdAt: job.createdAt,
    })
    failedJob.fail(reason)
    await this.jobRepo.save(failedJob)

    const failedAudio = AudioTrack.reconstitute({
      id: audio.id, filename: audio.filename, mimeType: audio.mimeType,
      sizeInBytes: audio.sizeInBytes, filePath: audio.filePath,
      status: AudioTrackStatus.PROCESSING, createdAt: audio.createdAt,
    })
    failedAudio.markAsFailed()
    await this.audioRepo.save(failedAudio)
  }
}
