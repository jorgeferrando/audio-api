import type { Channel, ConsumeMessage } from 'amqplib'
import type { ILogger } from '@shared/ILogger'
import type { ProcessJobUseCase } from '@application/job/ProcessJobUseCase'
import { QUEUES } from './queues'

/**
 * RabbitMQConsumer — queue adapter for the worker process.
 *
 * Supports graceful drain: when stop() is called (e.g. on SIGTERM), the
 * consumer stops accepting new messages and waits for the in-flight job
 * to finish before resolving. This prevents half-processed files and
 * ensures the job is properly acked/nacked before the connection closes.
 */
export class RabbitMQConsumer {
  #consumerTag?: string
  #processing = false
  #drainResolve?: () => void

  constructor(
    private readonly channel: Channel,
    private readonly processJobUseCase: ProcessJobUseCase,
    private readonly logger: ILogger,
  ) {}

  async start(): Promise<void> {
    await this.channel.prefetch(1)

    const { consumerTag } = await this.channel.consume(QUEUES.JOBS, async (msg: ConsumeMessage | null) => {
      if (!msg) return

      this.#processing = true

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
      } finally {
        this.#processing = false
        if (this.#drainResolve) this.#drainResolve()
      }
    })

    this.#consumerTag = consumerTag
    this.logger.info('RabbitMQConsumer: listening', { queue: QUEUES.JOBS })
  }

  /** Stop accepting new messages and wait for the current job to finish. */
  async stop(): Promise<void> {
    if (this.#consumerTag) {
      await this.channel.cancel(this.#consumerTag)
      this.logger.info('RabbitMQConsumer: stopped accepting new messages')
    }

    if (this.#processing) {
      this.logger.info('RabbitMQConsumer: waiting for in-flight job to finish...')
      await Promise.race([
        new Promise<void>((resolve) => { this.#drainResolve = resolve }),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('drain timeout')), 20_000),
        ),
      ]).catch(() => {
        this.logger.error('RabbitMQConsumer: drain timed out after 20s')
      })
    }

    this.logger.info('RabbitMQConsumer: drained')
  }
}
