import amqplib, { type Channel } from 'amqplib'
import type { ILogger } from '@shared/ILogger'
import { EXCHANGE, QUEUES } from './queues'

export interface RabbitMQConnection {
  connection: Awaited<ReturnType<typeof amqplib.connect>>
  channel: Channel
}

/**
 * Creates a RabbitMQ connection and sets up the exchange, queues and bindings.
 *
 * DLQ setup: audio.jobs uses a dead-letter routing key pointing to audio.dlq.
 * Messages that are rejected (nack without requeue) land in the DLQ automatically,
 * keeping the main queue clean and failed jobs inspectable.
 */
export async function connectRabbitMQ(url: string, logger: ILogger): Promise<RabbitMQConnection> {
  const connection = await amqplib.connect(url)
  const channel    = await connection.createChannel()

  // Durable exchange — survives broker restart
  await channel.assertExchange(EXCHANGE, 'direct', { durable: true })

  // DLQ first — must exist before audio.jobs references it
  await channel.assertQueue(QUEUES.DLQ, { durable: true })

  // Main jobs queue with DLQ binding
  await channel.assertQueue(QUEUES.JOBS, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange':    '',           // default exchange
      'x-dead-letter-routing-key': QUEUES.DLQ,  // route failed msgs to DLQ
    },
  })

  await channel.assertQueue(QUEUES.RESULTS, { durable: true })

  // Bind queues to exchange
  await channel.bindQueue(QUEUES.JOBS,    EXCHANGE, QUEUES.JOBS)
  await channel.bindQueue(QUEUES.RESULTS, EXCHANGE, QUEUES.RESULTS)

  logger.info('RabbitMQ connected', { exchange: EXCHANGE })

  return { connection, channel }
}

export async function disconnectRabbitMQ(conn: RabbitMQConnection, logger: ILogger): Promise<void> {
  await conn.channel.close()
  await conn.connection.close()
  logger.info('RabbitMQ disconnected')
}
