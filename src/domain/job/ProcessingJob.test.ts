import { describe, it, expect } from 'vitest'
import { ProcessingJob, JobStatus, AudioEffect, type ProcessingJobPersistence } from './ProcessingJob'
import { ValidationError } from '@shared/AppError'

describe('ProcessingJob', () => {
  const validProps = {
    audioTrackId: 'track-uuid-123',
    effect: AudioEffect.NORMALIZE,
  }

  // ─── create() ────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('returns a valid ProcessingJob with PENDING status', () => {
      const result = ProcessingJob.create(validProps)

      expect(result.isOk()).toBe(true)
      if (!result.isOk()) return

      const job = result.value
      expect(job.id).toBeDefined()
      expect(job.audioTrackId).toBe('track-uuid-123')
      expect(job.effect).toBe(AudioEffect.NORMALIZE)
      expect(job.status).toBe(JobStatus.PENDING)
      expect(job.createdAt).toBeInstanceOf(Date)
    })

    it('generates a unique id per instance', () => {
      const a = ProcessingJob.create(validProps)
      const b = ProcessingJob.create(validProps)

      expect(a.isOk() && b.isOk()).toBe(true)
      if (!a.isOk() || !b.isOk()) return

      expect(a.value.id).not.toBe(b.value.id)
    })

    it('fails if audioTrackId is empty', () => {
      const result = ProcessingJob.create({ ...validProps, audioTrackId: '' })

      expect(result.isErr()).toBe(true)
      if (!result.isErr()) return

      expect(result.error).toBeInstanceOf(ValidationError)
      expect(result.error.message).toMatch(/audioTrackId/)
    })

    it('fails if audioTrackId is blank whitespace', () => {
      const result = ProcessingJob.create({ ...validProps, audioTrackId: '   ' })

      expect(result.isErr()).toBe(true)
    })
  })

  // ─── start() ─────────────────────────────────────────────────────────────

  describe('start()', () => {
    it('transitions from PENDING to PROCESSING', () => {
      const job = ProcessingJob.create(validProps).value as ProcessingJob

      const result = job.start()

      expect(result.isOk()).toBe(true)
      expect(job.status).toBe(JobStatus.PROCESSING)
    })

    it('sets startedAt when transitioning to PROCESSING', () => {
      const job = ProcessingJob.create(validProps).value as ProcessingJob

      expect(job.startedAt).toBeUndefined()
      job.start()
      expect(job.startedAt).toBeInstanceOf(Date)
    })

    it('fails if already in PROCESSING state', () => {
      const job = ProcessingJob.create(validProps).value as ProcessingJob
      job.start()

      const result = job.start()

      expect(result.isErr()).toBe(true)
      if (!result.isErr()) return
      expect(result.error.code).toBe('INVALID_TRANSITION')
    })

    it('fails if job is COMPLETED', () => {
      const job = ProcessingJob.create(validProps).value as ProcessingJob
      job.start()
      job.complete()

      const result = job.start()

      expect(result.isErr()).toBe(true)
    })

    it('fails if job is FAILED', () => {
      const job = ProcessingJob.create(validProps).value as ProcessingJob
      job.start()
      job.fail('something went wrong')

      const result = job.start()

      expect(result.isErr()).toBe(true)
    })
  })

  // ─── complete() ──────────────────────────────────────────────────────────

  describe('complete()', () => {
    it('transitions from PROCESSING to COMPLETED', () => {
      const job = ProcessingJob.create(validProps).value as ProcessingJob
      job.start()

      const result = job.complete()

      expect(result.isOk()).toBe(true)
      expect(job.status).toBe(JobStatus.COMPLETED)
    })

    it('sets completedAt when transitioning to COMPLETED', () => {
      const job = ProcessingJob.create(validProps).value as ProcessingJob
      job.start()

      expect(job.completedAt).toBeUndefined()
      job.complete()
      expect(job.completedAt).toBeInstanceOf(Date)
    })

    it('fails if job is still PENDING', () => {
      const job = ProcessingJob.create(validProps).value as ProcessingJob

      const result = job.complete()

      expect(result.isErr()).toBe(true)
      if (!result.isErr()) return
      expect(result.error.code).toBe('INVALID_TRANSITION')
    })
  })

  // ─── fail() ──────────────────────────────────────────────────────────────

  describe('fail()', () => {
    it('transitions from PROCESSING to FAILED', () => {
      const job = ProcessingJob.create(validProps).value as ProcessingJob
      job.start()

      const result = job.fail('codec not supported')

      expect(result.isOk()).toBe(true)
      expect(job.status).toBe(JobStatus.FAILED)
    })

    it('stores the error message', () => {
      const job = ProcessingJob.create(validProps).value as ProcessingJob
      job.start()
      job.fail('codec not supported')

      expect(job.errorMessage).toBe('codec not supported')
    })

    it('sets completedAt when transitioning to FAILED', () => {
      const job = ProcessingJob.create(validProps).value as ProcessingJob
      job.start()

      expect(job.completedAt).toBeUndefined()
      job.fail('error')
      expect(job.completedAt).toBeInstanceOf(Date)
    })

    it('fails if job is still PENDING', () => {
      const job = ProcessingJob.create(validProps).value as ProcessingJob

      const result = job.fail('something')

      expect(result.isErr()).toBe(true)
      if (!result.isErr()) return
      expect(result.error.code).toBe('INVALID_TRANSITION')
    })
  })

  // ─── reconstitute() ──────────────────────────────────────────────────────

  describe('reconstitute()', () => {
    const persistedData: ProcessingJobPersistence = {
      id: 'existing-job-uuid',
      audioTrackId: 'track-uuid',
      effect: AudioEffect.REVERB,
      status: JobStatus.COMPLETED,
      startedAt: new Date('2024-01-01T10:00:00Z'),
      completedAt: new Date('2024-01-01T10:01:00Z'),
      createdAt: new Date('2024-01-01T09:59:00Z'),
    }

    it('restores the entity with the persisted id', () => {
      const job = ProcessingJob.reconstitute(persistedData)
      expect(job.id).toBe('existing-job-uuid')
    })

    it('restores the persisted status (not always PENDING)', () => {
      const job = ProcessingJob.reconstitute(persistedData)
      expect(job.status).toBe(JobStatus.COMPLETED)
    })

    it('restores timestamps', () => {
      const job = ProcessingJob.reconstitute(persistedData)
      expect(job.startedAt).toEqual(new Date('2024-01-01T10:00:00Z'))
      expect(job.completedAt).toEqual(new Date('2024-01-01T10:01:00Z'))
    })

    it('restores a FAILED job with errorMessage', () => {
      const job = ProcessingJob.reconstitute({
        ...persistedData,
        status: JobStatus.FAILED,
        errorMessage: 'codec not supported',
        completedAt: new Date(),
      })
      expect(job.status).toBe(JobStatus.FAILED)
      expect(job.errorMessage).toBe('codec not supported')
    })
  })
})
