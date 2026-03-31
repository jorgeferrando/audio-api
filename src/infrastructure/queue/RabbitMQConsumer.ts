import type { Channel, ConsumeMessage } from 'amqplib'
import type { ILogger } from '@shared/ILogger'
import type { ProcessJobUseCase } from '@application/job/ProcessJobUseCase'
import { QUEUES } from './queues'

/**
 * RabbitMQConsumer — queue adapter for the worker process.
 *
 * Responsibilities:
 *   - Register a consumer on audio.jobs.
 *   - Parse incoming messages and delegate to ProcessJobUseCase.
 *   - Ack on success, nack (→ DLQ) on any failure.
 *
 * Prefetch 1: the worker processes one job at a time. This prevents a slow
 * job from blocking others on multi-worker deployments and keeps memory usage
 * predictable. Increase prefetch if throughput becomes a bottleneck.
 *
 * Nack without requeue: failed messages go to audio.dlq automatically via the
 * dead-letter binding set up in rabbitMQSetup.ts. Requeuing would cause an
 * infinite retry loop for deterministic failures (e.g. corrupt audio file).
 */
export class RabbitMQConsumer {
  constructor(
    private readonly channel: Channel,
    private readonly processJobUseCase: ProcessJobUseCase,
    private readonly logger: ILogger,
  ) {}

  async start(): Promise<void> {
    await this.channel.prefetch(1)

    await this.channel.consume(QUEUES.JOBS, async (msg: ConsumeMessage | null) => {
      if (!msg) return // broker cancelled the consumer — nothing to do

      try {
        const payload = JSON.parse(msg.content.toString()) as { jobId: string }
        const result  = await this.processJobUseCase.execute({ jobId: payload.jobId })

        if (result.isOk()) {
          this.channel.ack(msg)
          this.logger.info('RabbitMQConsumer: job acked', { jobId: payload.jobId })
        } else {
          this.logger.error('RabbitMQConsumer: job failed, sending to DLQ', {
            jobId: payload.jobId,
            error: result.error.message,
          })
          this.channel.nack(msg, false, false)
        }
      } catch (e) {
        this.logger.error('RabbitMQConsumer: unexpected error, sending to DLQ', { error: e })
        this.channel.nack(msg, false, false)
      }
    })

    this.logger.info('RabbitMQConsumer: listening', { queue: QUEUES.JOBS })
  }
}
