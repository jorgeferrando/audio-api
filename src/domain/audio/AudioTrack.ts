import { randomUUID } from 'crypto'
import { type Result, ok, err } from '@shared/Result'
import { ValidationError, AppError } from '@shared/AppError'

export enum AudioTrackStatus {
  PENDING    = 'PENDING',
  PROCESSING = 'PROCESSING',
  READY      = 'READY',
  FAILED     = 'FAILED',
}

// Set gives O(1) lookup vs O(n) for Array.includes — worth it for a hot validation path.
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

/**
 * AudioTrack — core domain entity.
 *
 * Design decisions:
 *
 * 1. Private constructor + static `create()` factory.
 *    A constructor cannot return Result<T, E>, so validation would have to throw.
 *    The factory method returns Result and keeps the constructor unreachable from outside,
 *    guaranteeing that every AudioTrack instance is valid by construction.
 *
 * 2. Immutable identity + mutable state via private fields.
 *    id, filename, mimeType, sizeInBytes and createdAt never change after creation (readonly).
 *    _status and _durationSeconds change only through explicit transition methods that
 *    validate the state machine — direct assignment from outside is impossible.
 *
 * 3. State machine: PENDING → PROCESSING → READY | FAILED
 *    Each transition method returns Result<void, AppError> instead of throwing,
 *    consistent with the project-wide error handling strategy (see ADR 001).
 */
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
