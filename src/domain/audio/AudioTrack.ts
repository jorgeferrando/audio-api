import { randomUUID } from 'crypto'
import { type Result, ok, err } from '@shared/Result'
import { ValidationError, AppError } from '@shared/AppError'

export enum AudioTrackStatus {
  PENDING    = 'PENDING',
  PROCESSING = 'PROCESSING',
  READY      = 'READY',
  FAILED     = 'FAILED',
}

const VALID_MIME_TYPES = new Set([
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/flac',
  'audio/aac',
  'audio/webm',
])

const MAX_SIZE_BYTES = 50 * 1024 * 1024 // 50MB

interface AudioTrackProps {
  filename: string
  mimeType: string
  sizeInBytes: number
}

export class AudioTrack {
  readonly id: string
  readonly filename: string
  readonly mimeType: string
  readonly sizeInBytes: number
  readonly createdAt: Date
  private _status: AudioTrackStatus
  private _durationSeconds?: number

  private constructor(props: AudioTrackProps) {
    this.id            = randomUUID()
    this.filename      = props.filename
    this.mimeType      = props.mimeType
    this.sizeInBytes   = props.sizeInBytes
    this.createdAt     = new Date()
    this._status       = AudioTrackStatus.PENDING
  }

  get status(): AudioTrackStatus {
    return this._status
  }

  get durationSeconds(): number | undefined {
    return this._durationSeconds
  }

  static create(props: AudioTrackProps): Result<AudioTrack, ValidationError> {
    if (!props.filename.trim()) {
      return err(new ValidationError('filename cannot be empty'))
    }

    if (!VALID_MIME_TYPES.has(props.mimeType)) {
      return err(new ValidationError(`mimeType '${props.mimeType}' is not a valid audio type`))
    }

    if (props.sizeInBytes <= 0) {
      return err(new ValidationError('sizeInBytes must be greater than 0'))
    }

    if (props.sizeInBytes > MAX_SIZE_BYTES) {
      return err(new ValidationError('file exceeds maximum allowed size of 50MB'))
    }

    return ok(new AudioTrack(props))
  }

  markAsProcessing(): Result<void, AppError> {
    if (this._status !== AudioTrackStatus.PENDING) {
      return err(new AppError(
        `cannot transition to PROCESSING from ${this._status}`,
        'INVALID_TRANSITION'
      ))
    }
    this._status = AudioTrackStatus.PROCESSING
    return ok(undefined)
  }

  markAsReady(durationSeconds: number): Result<void, AppError> {
    if (this._status !== AudioTrackStatus.PROCESSING) {
      return err(new AppError(
        `cannot transition to READY: track must be in PROCESSING state`,
        'INVALID_TRANSITION'
      ))
    }
    this._status          = AudioTrackStatus.READY
    this._durationSeconds = durationSeconds
    return ok(undefined)
  }

  markAsFailed(): Result<void, AppError> {
    if (this._status !== AudioTrackStatus.PROCESSING) {
      return err(new AppError(
        `cannot transition to FAILED from ${this._status}`,
        'INVALID_TRANSITION'
      ))
    }
    this._status = AudioTrackStatus.FAILED
    return ok(undefined)
  }
}
