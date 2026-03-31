import { type Result } from '@shared/Result'
import { AppError } from '@shared/AppError'
import { ProcessingJob } from '@domain/job/ProcessingJob'

/**
 * Port: defines how the application publishes jobs to the message queue.
 *
 * Lives in application/ (not domain/) because it is an infrastructure concern
 * surfaced by a use case — not a core business rule. The implementation
 * (RabbitMQPublisher) lives in infrastructure/ and is wired at the composition root.
 */
export interface IJobPublisher {
  publish(job: ProcessingJob): Promise<Result<void, AppError>>
}
