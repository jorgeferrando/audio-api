import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RabbitMQPublisher } from './RabbitMQPublisher'
import { ProcessingJob, AudioEffect } from '@domain/job/ProcessingJob'
import type { ILogger } from '@shared/ILogger'

function makeJob(): ProcessingJob {
  const result = ProcessingJob.create({
    audioTrackId: 'track-uuid-123',
    effect: AudioEffect.NORMALIZE,
  })
  if (!result.isOk()) throw new Error('test setup failed')
  return result.value
}

const makeLogger = (): ILogger => ({
  info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
})

// Minimal mock of an amqplib Channel — only the method we use.
const makeChannel = () => ({
  sendToQueue: vi.fn().mockReturnValue(true),
})

describe('RabbitMQPublisher', () => {
  let channel: ReturnType<typeof makeChannel>
  let logger: ILogger
  let publisher: RabbitMQPublisher

  beforeEach(() => {
    channel   = makeChannel()
    logger    = makeLogger()
    publisher = new RabbitMQPublisher(channel as never, logger)
  })

  it('publishes the job as a JSON buffer to the audio.jobs queue', async () => {
    const job = makeJob()

    const result = await publisher.publish(job)

    expect(result.isOk()).toBe(true)
    expect(channel.sendToQueue).toHaveBeenCalledOnce()

    const [queue, buffer] = channel.sendToQueue.mock.calls[0]
    expect(queue).toBe('audio.jobs')

    const message = JSON.parse(buffer.toString())
    expect(message.jobId).toBe(job.id)
    expect(message.audioTrackId).toBe('track-uuid-123')
    expect(message.effect).toBe(AudioEffect.NORMALIZE)
  })

  it('publishes with persistent delivery mode', async () => {
    await publisher.publish(makeJob())

    const [, , options] = channel.sendToQueue.mock.calls[0]
    expect(options.persistent).toBe(true)
  })

  it('returns a QUEUE_ERROR if sendToQueue throws', async () => {
    channel.sendToQueue.mockImplementation(() => { throw new Error('channel closed') })

    const result = await publisher.publish(makeJob())

    expect(result.isErr()).toBe(true)
    if (!result.isErr()) return
    expect(result.error.code).toBe('QUEUE_ERROR')
    expect(logger.error).toHaveBeenCalledOnce()
  })
})
