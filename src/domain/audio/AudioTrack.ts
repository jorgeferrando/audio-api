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

interface AudioTrackCreateProps {
  filename: string
  mimeType: string
  sizeInBytes: number
  filePath: string
}

// Full internal state — used by the private constructor.
// Separating create props from constructor props lets create() set defaults
// (id, createdAt, initial status) while reconstitute() restores persisted state.
interface AudioTrackConstructorProps {
  id: string
  filename: string
  mimeType: string
  sizeInBytes: number
  filePath: string
  processedFilePath: string | undefined
  status: AudioTrackStatus
  durationSeconds: number | undefined
  createdAt: Date
}

// Shape of the data the repository reads from the DB and passes to reconstitute().
export interface AudioTrackPersistence {
  id: string
  filename: string
  mimeType: string
  sizeInBytes: number
  filePath: string
  processedFilePath?: string
  status: AudioTrackStatus
  durationSeconds?: number
  createdAt: Date
}

/**
 * AudioTrack — core domain entity.
 *
 * Design decisions:
 *
 * 1. Private constructor + two static factories.
 *    - `create()`: validates input, generates id, sets initial state. Used on upload.
 *    - `reconstitute()`: bypasses validation, restores full state from persistence.
 *      Used by repositories when reading from DB — data was already validated before saving.
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
  readonly filePath: string
  readonly createdAt: Date
  #status: AudioTrackStatus
  #durationSeconds?: number
  #processedFilePath?: string

  private constructor(props: AudioTrackConstructorProps) {
    this.id                = props.id
    this.filename          = props.filename
    this.mimeType          = props.mimeType
    this.sizeInBytes       = props.sizeInBytes
    this.filePath          = props.filePath
    this.createdAt         = props.createdAt
    this.#status           = props.status
    this.#durationSeconds  = props.durationSeconds
    this.#processedFilePath = props.processedFilePath
  }

  get status(): AudioTrackStatus {
    return this.#status
  }

  get durationSeconds(): number | undefined {
    return this.#durationSeconds
  }

  get processedFilePath(): string | undefined {
    return this.#processedFilePath
  }

  setProcessedFilePath(path: string): void {
    this.#processedFilePath = path
  }

  static create(props: AudioTrackCreateProps): Result<AudioTrack, ValidationError> {
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

    if (!props.filePath.trim()) {
      return err(new ValidationError('filePath cannot be empty'))
    }

    return ok(new AudioTrack({
      id: randomUUID(),
      filename: props.filename,
      mimeType: props.mimeType,
      sizeInBytes: props.sizeInBytes,
      filePath: props.filePath,
      processedFilePath: undefined,
      status: AudioTrackStatus.PENDING,
      durationSeconds: undefined,
      createdAt: new Date(),
    }))
  }

  /** Restores an AudioTrack from persisted data. Skips validation — data is trusted. */
  static reconstitute(data: AudioTrackPersistence): AudioTrack {
    return new AudioTrack({
      id: data.id,
      filename: data.filename,
      mimeType: data.mimeType,
      sizeInBytes: data.sizeInBytes,
      filePath: data.filePath,
      processedFilePath: data.processedFilePath,
      status: data.status,
      durationSeconds: data.durationSeconds,
      createdAt: data.createdAt,
    })
  }

  markAsProcessing(): Result<void, AppError> {
    if (this.#status !== AudioTrackStatus.PENDING) {
      return err(new AppError(
        `cannot transition to PROCESSING from ${this.#status}`,
        'INVALID_TRANSITION'
      ))
    }
    this.#status = AudioTrackStatus.PROCESSING
    return ok(undefined)
  }

  markAsReady(durationSeconds: number): Result<void, AppError> {
    if (this.#status !== AudioTrackStatus.PROCESSING) {
      return err(new AppError(
        `cannot transition to READY: track must be in PROCESSING state`,
        'INVALID_TRANSITION'
      ))
    }
    this.#status          = AudioTrackStatus.READY
    this.#durationSeconds = durationSeconds
    return ok(undefined)
  }

  markAsFailed(): Result<void, AppError> {
    if (this.#status !== AudioTrackStatus.PROCESSING) {
      return err(new AppError(
        `cannot transition to FAILED from ${this.#status}`,
        'INVALID_TRANSITION'
      ))
    }
    this.#status = AudioTrackStatus.FAILED
    return ok(undefined)
  }
}
