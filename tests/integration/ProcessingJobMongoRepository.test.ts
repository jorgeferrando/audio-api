import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { ProcessingJobMongoRepository } from '@infrastructure/db/ProcessingJobMongoRepository'
import { testProcessingJobRepositoryContract } from '@infrastructure/db/processingJobRepositoryContract'
import { ProcessingJob, JobStatus, AudioEffect } from '@domain/job/ProcessingJob'
import type { ILogger } from '@shared/ILogger'

// ─── Setup ───────────────────────────────────────────────────────────────────

const logger: ILogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
}

let mongod: MongoMemoryServer

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

afterEach(async () => {
  await mongoose.connection.dropDatabase()
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeJob(audioTrackId = 'track-uuid-123'): ProcessingJob {
  const result = ProcessingJob.create({ audioTrackId, effect: AudioEffect.NORMALIZE })
  if (!result.isOk()) throw new Error('test setup failed')
  return result.value
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ProcessingJobMongoRepository', () => {
  let repo: ProcessingJobMongoRepository

  beforeAll(() => {
    repo = new ProcessingJobMongoRepository(logger)
  })

  describe('save() + findById()', () => {
    it('persists and retrieves a job', async () => {
      const job = makeJob()

      await repo.save(job)
      const result = await repo.findById(job.id)

      expect(result.isOk()).toBe(true)
      if (!result.isOk()) return

      const found = result.value
      expect(found).not.toBeNull()
      expect(found!.id).toBe(job.id)
      expect(found!.audioTrackId).toBe('track-uuid-123')
      expect(found!.effect).toBe(AudioEffect.NORMALIZE)
      expect(found!.status).toBe(JobStatus.PENDING)
    })

    it('returns null for an unknown id', async () => {
      const result = await repo.findById('non-existent-id')

      expect(result.isOk()).toBe(true)
      if (!result.isOk()) return
      expect(result.value).toBeNull()
    })

    it('updates status when saving again (upsert)', async () => {
      const job = makeJob()
      await repo.save(job)

      job.start()
      await repo.save(job)

      const result = await repo.findById(job.id)
      expect(result.isOk()).toBe(true)
      if (!result.isOk()) return
      expect(result.value!.status).toBe(JobStatus.PROCESSING)
      expect(result.value!.startedAt).toBeInstanceOf(Date)
    })

    it('persists errorMessage after fail()', async () => {
      const job = makeJob()
      job.start()
      job.fail('codec not supported')

      await repo.save(job)
      const result = await repo.findById(job.id)

      expect(result.isOk()).toBe(true)
      if (!result.isOk()) return
      expect(result.value!.status).toBe(JobStatus.FAILED)
      expect(result.value!.errorMessage).toBe('codec not supported')
      expect(result.value!.completedAt).toBeInstanceOf(Date)
    })
  })

  describe('findByAudioTrackId()', () => {
    it('finds a job by audioTrackId', async () => {
      const job = makeJob('my-track-id')
      await repo.save(job)

      const result = await repo.findByAudioTrackId('my-track-id')

      expect(result.isOk()).toBe(true)
      if (!result.isOk()) return
      expect(result.value!.id).toBe(job.id)
    })

    it('returns null when no job exists for the given audioTrackId', async () => {
      const result = await repo.findByAudioTrackId('unknown-track')

      expect(result.isOk()).toBe(true)
      if (!result.isOk()) return
      expect(result.value).toBeNull()
    })
  })
})

// ── Contract tests ──────────────────────────────────────────────────────────
testProcessingJobRepositoryContract(
  () => new ProcessingJobMongoRepository(logger),
  async () => { await mongoose.connection.dropDatabase() },
)
