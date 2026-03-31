import { Schema, model, type Document } from 'mongoose'
import { AudioTrackStatus } from '@domain/audio/AudioTrack'

/**
 * Mongoose persistence model for AudioTrack.
 *
 * Deliberately separate from the domain entity — the schema owns persistence
 * concerns (indexes, MongoDB types), while the entity owns business rules.
 * The repository is responsible for mapping between the two.
 *
 * We store domain id in `_id` (as a string) to avoid a separate `id` field
 * and keep MongoDB's native index on `_id`.
 */
export interface AudioTrackDocument extends Document {
  _id: string
  filename: string
  mimeType: string
  sizeInBytes: number
  status: AudioTrackStatus
  durationSeconds?: number
  createdAt: Date
}

const audioTrackSchema = new Schema<AudioTrackDocument>(
  {
    _id:             { type: String, required: true },
    filename:        { type: String, required: true },
    mimeType:        { type: String, required: true },
    sizeInBytes:     { type: Number, required: true },
    status:          { type: String, enum: Object.values(AudioTrackStatus), required: true },
    durationSeconds: { type: Number },
  },
  {
    // Disable Mongoose's auto _id (we provide our own UUID string)
    _id: false,
    // Let Mongoose manage createdAt; updatedAt not needed (status transitions are explicit)
    timestamps: { createdAt: true, updatedAt: false },
  }
)

export const AudioTrackModel = model<AudioTrackDocument>('AudioTrack', audioTrackSchema)
