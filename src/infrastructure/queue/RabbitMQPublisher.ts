import type { Channel } from 'amqplib'
import { ok, err, type Result } from '@shared/Result'
import { AppError } from '@shared/AppError'
import type { ILogger } from '@shared/ILogger'
import type { ProcessingJob } from '@domain/job/ProcessingJob'
import type { IJobPublisher } from '@application/job/IJobPublisher'
import { QUEUES } from './queues'

export class RabbitMQPublisher implements IJobPublisher {
  constructor(
    private readonly channel: Channel,
    private readonly logger: ILogger,
  ) {}

  async publish(job: ProcessingJob): Promise<Result<void, AppError>> {
    try {
      const message = Buffer.from(JSON.stringify({
        jobId:        job.id,
        audioTrackId: job.audioTrackId,
        effect:       job.effect,
      }))

      this.channel.sendToQueue(QUEUES.JOBS, message, { persistent: true })

      this.logger.info('RabbitMQPublisher: job published', { jobId: job.id })
      return ok(undefined)
    } catch (e) {
      this.logger.error('RabbitMQPublisher.publish failed', { error: e, jobId: job.id })
      return err(new AppError('Failed to publish job to queue', 'QUEUE_ERROR'))
    }
  }
}
