import type { AudioTrackStatus } from '@domain/audio/AudioTrack'
import type { JobStatus, AudioEffect } from '@domain/job/ProcessingJob'

/**
 * DTO returned by GetAudioStatusUseCase.
 *
 * Plain object — no class methods, no private fields — so it can be safely
 * serialized to JSON for caching and HTTP responses without data loss.
 */
export interface AudioStatusDto {
  audioTrackId: string
  filename: string
  mimeType: string
  sizeInBytes: number
  status: AudioTrackStatus
  durationSeconds?: number
  processedFilePath?: string
  createdAt: Date
  job: {
    jobId: string
    effect: AudioEffect
    status: JobStatus
    startedAt?: Date
    completedAt?: Date
    errorMessage?: string
  } | null
}
