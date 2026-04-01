import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { AudioTrackMongoRepository } from '@infrastructure/db/AudioTrackMongoRepository'
import { AudioTrack, AudioTrackStatus } from '@domain/audio/AudioTrack'
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

function makeTrack(): AudioTrack {
  const result = AudioTrack.create({
    filename: 'song.mp3',
    mimeType: 'audio/mpeg',
    sizeInBytes: 1024 * 1024,
    filePath: '/uploads/originals/song.mp3',
  })
  if (!result.isOk()) throw new Error('test setup failed')
  return result.value
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('AudioTrackMongoRepository', () => {
  let repo: AudioTrackMongoRepository

  beforeAll(() => {
    repo = new AudioTrackMongoRepository(logger)
  })

  describe('save() + findById()', () => {
    it('persists and retrieves an audio track', async () => {
      const track = makeTrack()

      await repo.save(track)
      const result = await repo.findById(track.id)

      expect(result.isOk()).toBe(true)
      if (!result.isOk()) return

      const found = result.value
      expect(found).not.toBeNull()
      expect(found!.id).toBe(track.id)
      expect(found!.filename).toBe('song.mp3')
      expect(found!.status).toBe(AudioTrackStatus.PENDING)
    })

    it('returns null for an unknown id', async () => {
      const result = await repo.findById('non-existent-id')

      expect(result.isOk()).toBe(true)
      if (!result.isOk()) return
      expect(result.value).toBeNull()
    })

    it('updates status when saving again (upsert)', async () => {
      const track = makeTrack()
      await repo.save(track)

      track.markAsProcessing()
      await repo.save(track)

      const result = await repo.findById(track.id)
      expect(result.isOk()).toBe(true)
      if (!result.isOk()) return
      expect(result.value!.status).toBe(AudioTrackStatus.PROCESSING)
    })

    it('deletes a track by id', async () => {
      const track = makeTrack()
      await repo.save(track)

      await repo.deleteById(track.id)

      const result = await repo.findById(track.id)
      expect(result.isOk()).toBe(true)
      if (!result.isOk()) return
      expect(result.value).toBeNull()
    })
  })

  describe('findAll()', () => {
    it('returns all tracks with total count', async () => {
      const t1 = makeTrack()
      const t2 = makeTrack()
      await repo.save(t1)
      await repo.save(t2)

      const result = await repo.findAll()

      expect(result.isOk()).toBe(true)
      if (!result.isOk()) return
      expect(result.value.items).toHaveLength(2)
      expect(result.value.total).toBe(2)
    })

    it('respects limit and offset', async () => {
      const t1 = makeTrack()
      const t2 = makeTrack()
      const t3 = makeTrack()
      await repo.save(t1)
      await repo.save(t2)
      await repo.save(t3)

      const result = await repo.findAll({ limit: 2, offset: 1 })

      expect(result.isOk()).toBe(true)
      if (!result.isOk()) return
      expect(result.value.items).toHaveLength(2)
      expect(result.value.total).toBe(3)
    })

    it('persists durationSeconds after markAsReady', async () => {
      const track = makeTrack()
      track.markAsProcessing()
      track.markAsReady(243.5)

      await repo.save(track)
      const result = await repo.findById(track.id)

      expect(result.isOk()).toBe(true)
      if (!result.isOk()) return
      expect(result.value!.durationSeconds).toBe(243.5)
      expect(result.value!.status).toBe(AudioTrackStatus.READY)
    })
  })
})
