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
}
