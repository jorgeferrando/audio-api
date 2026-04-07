import { type Result, ok, err } from '@shared/Result'
import { DatabaseError } from '@shared/AppError'
import type { ILogger } from '@shared/ILogger'
import { ProcessingJob } from '@domain/job/ProcessingJob'
import type { IProcessingJobRepository } from '@domain/job/IProcessingJobRepository'
import { ProcessingJobModel } from './models/ProcessingJobModel'
import { isTransientMongoError } from './classifyMongoError'

export class ProcessingJobMongoRepository implements IProcessingJobRepository {
  constructor(private readonly logger: ILogger) {}

  async save(job: ProcessingJob): Promise<Result<void, DatabaseError>> {
    try {
      await ProcessingJobModel.findByIdAndUpdate(
        job.id,
        {
          _id:          job.id,
          audioTrackId: job.audioTrackId,
          effect:       job.effect,
          status:       job.status,
          startedAt:    job.startedAt,
          completedAt:  job.completedAt,
          errorMessage: job.errorMessage,
        },
        { upsert: true, new: true }
      )
      return ok(undefined)
    } catch (e) {
      this.logger.error('ProcessingJobMongoRepository.save failed', { error: e, jobId: job.id })
      return err(new DatabaseError(`Failed to save ProcessingJob: ${(e as Error).message}`, isTransientMongoError(e)))
    }
  }

  async findById(id: string): Promise<Result<ProcessingJob | null, DatabaseError>> {
    try {
      const doc = await ProcessingJobModel.findById(id).lean()
      if (!doc) return ok(null)

      return ok(ProcessingJob.reconstitute({
        id:           doc._id,
        audioTrackId: doc.audioTrackId,
        effect:       doc.effect,
        status:       doc.status,
        startedAt:    doc.startedAt,
        completedAt:  doc.completedAt,
        errorMessage: doc.errorMessage,
        createdAt:    doc.createdAt,
      }))
    } catch (e) {
      this.logger.error('ProcessingJobMongoRepository.findById failed', { error: e, id })
      return err(new DatabaseError(`Failed to find ProcessingJob: ${(e as Error).message}`, isTransientMongoError(e)))
    }
  }

  async findByAudioTrackId(audioTrackId: string): Promise<Result<ProcessingJob | null, DatabaseError>> {
    try {
      const doc = await ProcessingJobModel.findOne({ audioTrackId }).lean()
      if (!doc) return ok(null)

      return ok(ProcessingJob.reconstitute({
        id:           doc._id,
        audioTrackId: doc.audioTrackId,
        effect:       doc.effect,
        status:       doc.status,
        startedAt:    doc.startedAt,
        completedAt:  doc.completedAt,
        errorMessage: doc.errorMessage,
        createdAt:    doc.createdAt,
      }))
    } catch (e) {
      this.logger.error('ProcessingJobMongoRepository.findByAudioTrackId failed', { error: e, audioTrackId })
      return err(new DatabaseError(`Failed to find ProcessingJob by audioTrackId: ${(e as Error).message}`, isTransientMongoError(e)))
    }
  }

  async deleteById(id: string): Promise<Result<void, DatabaseError>> {
    try {
      await ProcessingJobModel.findByIdAndDelete(id)
      return ok(undefined)
    } catch (e) {
      this.logger.error('ProcessingJobMongoRepository.deleteById failed', { error: e, id })
      return err(new DatabaseError(`Failed to delete ProcessingJob: ${(e as Error).message}`, isTransientMongoError(e)))
    }
  }
}
