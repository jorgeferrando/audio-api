import { randomUUID } from 'crypto'
import { type Result, ok, err } from '@shared/Result'
import { ValidationError, AppError } from '@shared/AppError'

export enum JobStatus {
  PENDING    = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED  = 'COMPLETED',
  FAILED     = 'FAILED',
}

export enum AudioEffect {
  NORMALIZE       = 'NORMALIZE',
  REVERB          = 'REVERB',
  ECHO            = 'ECHO',
  PITCH_SHIFT     = 'PITCH_SHIFT',
  NOISE_REDUCTION = 'NOISE_REDUCTION',
}

interface ProcessingJobCreateProps {
  audioTrackId: string
  effect: AudioEffect
}

// Full internal state — used by the private constructor.
interface ProcessingJobConstructorProps {
  id: string
  audioTrackId: string
  effect: AudioEffect
  status: JobStatus
  startedAt: Date | undefined
  completedAt: Date | undefined
  errorMessage: string | undefined
  createdAt: Date
}

// Shape of the data the repository reads from the DB and passes to reconstitute().
export interface ProcessingJobPersistence {
  id: string
  audioTrackId: string
  effect: AudioEffect
  status: JobStatus
  startedAt?: Date
  completedAt?: Date
  errorMessage?: string
  createdAt: Date
}

/**
 * ProcessingJob — domain entity representing an async audio processing task.
 *
 * Design decisions:
 *
 * 1. Same private constructor + static factories as AudioTrack.
 *    - `create()`: validates input, generates id, sets initial state.
 *    - `reconstitute()`: bypasses validation, restores full state from persistence.
 *
 * 2. State machine: PENDING → PROCESSING → COMPLETED | FAILED
 *    Each transition is explicit and validated — no direct status assignment from outside.
 *    Timestamps (startedAt, completedAt) are set automatically by the transition methods,
 *    keeping the lifecycle consistent and self-contained.
 *
 * 3. errorMessage is only meaningful in FAILED state, but exposing it as optional
 *    avoids a separate FailedJob subtype (YAGNI). The state machine already prevents
 *    it from being set in any other state.
 */
export class ProcessingJob {
  readonly id: string
  readonly audioTrackId: string
  readonly effect: AudioEffect
  readonly createdAt: Date
  #status: JobStatus
  #startedAt?: Date
  #completedAt?: Date
  #errorMessage?: string

  private constructor(props: ProcessingJobConstructorProps) {
    this.id            = props.id
    this.audioTrackId  = props.audioTrackId
    this.effect        = props.effect
    this.createdAt     = props.createdAt
    this.#status       = props.status
    this.#startedAt    = props.startedAt
    this.#completedAt  = props.completedAt
    this.#errorMessage = props.errorMessage
  }

  get status(): JobStatus { return this.#status }
  get startedAt(): Date | undefined { return this.#startedAt }
  get completedAt(): Date | undefined { return this.#completedAt }
  get errorMessage(): string | undefined { return this.#errorMessage }

  static create(props: ProcessingJobCreateProps): Result<ProcessingJob, ValidationError> {
    if (!props.audioTrackId.trim()) {
      return err(new ValidationError('audioTrackId cannot be empty'))
    }

    return ok(new ProcessingJob({
      id: randomUUID(),
      audioTrackId: props.audioTrackId,
      effect: props.effect,
      status: JobStatus.PENDING,
      startedAt: undefined,
      completedAt: undefined,
      errorMessage: undefined,
      createdAt: new Date(),
    }))
  }

  /** Restores a ProcessingJob from persisted data. Skips validation — data is trusted. */
  static reconstitute(data: ProcessingJobPersistence): ProcessingJob {
    return new ProcessingJob({
      id: data.id,
      audioTrackId: data.audioTrackId,
      effect: data.effect,
      status: data.status,
      startedAt: data.startedAt,
      completedAt: data.completedAt,
      errorMessage: data.errorMessage,
      createdAt: data.createdAt,
    })
  }

  /** PENDING → PROCESSING */
  start(): Result<void, AppError> {
    if (this.#status !== JobStatus.PENDING) {
      return err(new AppError(
        `cannot transition to PROCESSING from ${this.#status}`,
        'INVALID_TRANSITION'
      ))
    }
    this.#status    = JobStatus.PROCESSING
    this.#startedAt = new Date()
    return ok(undefined)
  }

  /** PROCESSING → COMPLETED */
  complete(): Result<void, AppError> {
    if (this.#status !== JobStatus.PROCESSING) {
      return err(new AppError(
        `cannot transition to COMPLETED: job must be in PROCESSING state`,
        'INVALID_TRANSITION'
      ))
    }
    this.#status      = JobStatus.COMPLETED
    this.#completedAt = new Date()
    return ok(undefined)
  }

  /** PROCESSING → FAILED */
  fail(errorMessage: string): Result<void, AppError> {
    if (this.#status !== JobStatus.PROCESSING) {
      return err(new AppError(
        `cannot transition to FAILED from ${this.#status}`,
        'INVALID_TRANSITION'
      ))
    }
    this.#status       = JobStatus.FAILED
    this.#completedAt  = new Date()
    this.#errorMessage = errorMessage
    return ok(undefined)
  }
}
