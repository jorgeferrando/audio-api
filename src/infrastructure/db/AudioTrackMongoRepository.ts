import { type Result, ok, err } from '@shared/Result'
import { DatabaseError } from '@shared/AppError'
import type { ILogger } from '@shared/ILogger'
import { AudioTrack } from '@domain/audio/AudioTrack'
import type { IAudioTrackRepository } from '@domain/audio/IAudioTrackRepository'
import { AudioTrackModel } from './models/AudioTrackModel'

export class AudioTrackMongoRepository implements IAudioTrackRepository {
  constructor(private readonly logger: ILogger) {}

  async save(audio: AudioTrack): Promise<Result<void, DatabaseError>> {
    try {
      await AudioTrackModel.findByIdAndUpdate(
        audio.id,
        {
          _id:               audio.id,
          filename:          audio.filename,
          mimeType:          audio.mimeType,
          sizeInBytes:       audio.sizeInBytes,
          filePath:          audio.filePath,
          processedFilePath: audio.processedFilePath,
          status:            audio.status,
          durationSeconds:   audio.durationSeconds,
        },
        { upsert: true, new: true }
      )
      return ok(undefined)
    } catch (e) {
      this.logger.error('AudioTrackMongoRepository.save failed', { error: e, audioId: audio.id })
      return err(new DatabaseError('Failed to save AudioTrack'))
    }
  }

  async findById(id: string): Promise<Result<AudioTrack | null, DatabaseError>> {
    try {
      const doc = await AudioTrackModel.findById(id).lean()
      if (!doc) return ok(null)

      return ok(AudioTrack.reconstitute({
        id:                doc._id,
        filename:          doc.filename,
        mimeType:          doc.mimeType,
        sizeInBytes:       doc.sizeInBytes,
        filePath:          doc.filePath,
        processedFilePath: doc.processedFilePath,
        status:            doc.status,
        durationSeconds:   doc.durationSeconds,
        createdAt:         doc.createdAt,
      }))
    } catch (e) {
      this.logger.error('AudioTrackMongoRepository.findById failed', { error: e, id })
      return err(new DatabaseError('Failed to find AudioTrack'))
    }
  }

  async findAll(options?: { limit?: number; offset?: number }): Promise<Result<{ items: AudioTrack[]; total: number }, DatabaseError>> {
    try {
      const limit = options?.limit ?? 50
      const offset = options?.offset ?? 0
      const [docs, total] = await Promise.all([
        AudioTrackModel.find().sort({ createdAt: -1 }).skip(offset).limit(limit).lean(),
        AudioTrackModel.countDocuments(),
      ])
      const items = docs.map(doc => AudioTrack.reconstitute({
        id:                doc._id,
        filename:          doc.filename,
        mimeType:          doc.mimeType,
        sizeInBytes:       doc.sizeInBytes,
        filePath:          doc.filePath,
        processedFilePath: doc.processedFilePath,
        status:            doc.status,
        durationSeconds:   doc.durationSeconds,
        createdAt:         doc.createdAt,
      }))
      return ok({ items, total })
    } catch (e) {
      this.logger.error('AudioTrackMongoRepository.findAll failed', { error: e })
      return err(new DatabaseError('Failed to list AudioTracks'))
    }
  }

  async deleteById(id: string): Promise<Result<void, DatabaseError>> {
    try {
      await AudioTrackModel.findByIdAndDelete(id)
      return ok(undefined)
    } catch (e) {
      this.logger.error('AudioTrackMongoRepository.deleteById failed', { error: e, id })
      return err(new DatabaseError('Failed to delete AudioTrack'))
    }
  }
}
