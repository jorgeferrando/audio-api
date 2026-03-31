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
  NORMALIZE   = 'NORMALIZE',
  REVERB      = 'REVERB',
  ECHO        = 'ECHO',
  PITCH_SHIFT = 'PITCH_SHIFT',
  NOISE_REDUCTION = 'NOISE_REDUCTION',
}

interface ProcessingJobProps {
  audioTrackId: string
  effect: AudioEffect
}

/**
 * ProcessingJob — domain entity representing an async audio processing task.
 *
 * Design decisions:
 *
 * 1. Same private constructor + static `create()` factory as AudioTrack.
 *    Guarantees every instance is valid by construction; validation returns Result.
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

  private constructor(props: ProcessingJobProps) {
    this.id           = randomUUID()
    this.audioTrackId = props.audioTrackId
    this.effect       = props.effect
    this.createdAt    = new Date()
    this.#status      = JobStatus.PENDING
  }

  get status(): JobStatus { return this.#status }
  get startedAt(): Date | undefined { return this.#startedAt }
  get completedAt(): Date | undefined { return this.#completedAt }
  get errorMessage(): string | undefined { return this.#errorMessage }

  static create(props: ProcessingJobProps): Result<ProcessingJob, ValidationError> {
    if (!props.audioTrackId.trim()) {
      return err(new ValidationError('audioTrackId cannot be empty'))
    }

    return ok(new ProcessingJob(props))
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
