import { Schema, model } from 'mongoose'
import { JobStatus, AudioEffect } from '@domain/job/ProcessingJob'

export interface ProcessingJobDocument {
  _id: string
  audioTrackId: string
  effect: AudioEffect
  status: JobStatus
  startedAt?: Date
  completedAt?: Date
  errorMessage?: string
  createdAt: Date
}

const processingJobSchema = new Schema<ProcessingJobDocument>(
  {
    _id:          { type: String, required: true },
    audioTrackId: { type: String, required: true, index: true },
    effect:       { type: String, enum: Object.values(AudioEffect), required: true },
    status:       { type: String, enum: Object.values(JobStatus), required: true },
    startedAt:    { type: Date },
    completedAt:  { type: Date },
    errorMessage: { type: String },
  },
  {
    _id: false,
    timestamps: { createdAt: true, updatedAt: false },
  }
)

export const ProcessingJobModel = model<ProcessingJobDocument>('ProcessingJob', processingJobSchema)
