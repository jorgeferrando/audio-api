import { type Result } from '@shared/Result'
import type { DatabaseError } from '@shared/AppError'
import type { ProcessingJob } from './ProcessingJob'

/**
 * Port: defines what the application needs from job storage.
 *
 * Same Dependency Inversion rationale as IAudioTrackRepository.
 *
 * `findByAudioTrackId` returns a single job because in the current domain model
 * one audio track produces exactly one processing job. If multiple effects per
 * track are needed in the future, this signature changes to ProcessingJob[].
 */
export interface IProcessingJobRepository {
  save(job: ProcessingJob): Promise<Result<void, DatabaseError>>
  findById(id: string): Promise<Result<ProcessingJob | null, DatabaseError>>
  findByAudioTrackId(audioTrackId: string): Promise<Result<ProcessingJob | null, DatabaseError>>
  deleteById(id: string): Promise<Result<void, DatabaseError>>
}
