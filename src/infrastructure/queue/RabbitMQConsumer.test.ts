import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RabbitMQConsumer } from './RabbitMQConsumer'
import type { ProcessJobUseCase } from '@application/job/ProcessJobUseCase'
import type { ILogger } from '@shared/ILogger'
import { ok, err } from '@shared/Result'
import { AppError } from '@shared/AppError'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeMessage(payload: unknown) {
  return {
    content: Buffer.from(JSON.stringify(payload)),
  }
}

// ─── Mocks ───────────────────────────────────────────────────────────────────

const makeChannel = () => ({
  prefetch: vi.fn().mockResolvedValue(undefined),
  consume:  vi.fn().mockResolvedValue(undefined),
  ack:      vi.fn(),
  nack:     vi.fn(),
})

const makeUseCase = () => ({
  execute: vi.fn().mockResolvedValue(ok(undefined)),
})

const makeLogger = (): ILogger => ({
  info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
})

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('RabbitMQConsumer', () => {
  let channel: ReturnType<typeof makeChannel>
  let useCase: ReturnType<typeof makeUseCase>
  let logger: ILogger
  let consumer: RabbitMQConsumer

  beforeEach(() => {
    channel  = makeChannel()
    useCase  = makeUseCase()
    logger   = makeLogger()
    consumer = new RabbitMQConsumer(channel as never, useCase as never as ProcessJobUseCase, logger)
  })

  it('sets prefetch to 1 on start', async () => {
    await consumer.start()
    expect(channel.prefetch).toHaveBeenCalledWith(1)
  })

  it('registers a consumer on the audio.jobs queue', async () => {
    await consumer.start()
    expect(channel.consume).toHaveBeenCalledWith('audio.jobs', expect.any(Function))
  })

  it('acks the message when the use case succeeds', async () => {
    await consumer.start()

    // Extract the callback registered with channel.consume and invoke it
    const handler = channel.consume.mock.calls[0][1]
    const msg = makeMessage({ jobId: 'job-123' })

    await handler(msg)

    expect(useCase.execute).toHaveBeenCalledWith({ jobId: 'job-123' })
    expect(channel.ack).toHaveBeenCalledWith(msg)
    expect(channel.nack).not.toHaveBeenCalled()
  })

  it('nacks without requeue when the use case returns an error', async () => {
    useCase.execute.mockResolvedValue(err(new AppError('processing failed', 'PROCESSING_ERROR')))

    await consumer.start()
    const handler = channel.consume.mock.calls[0][1]
    await handler(makeMessage({ jobId: 'job-123' }))

    expect(channel.nack).toHaveBeenCalledWith(expect.anything(), false, false)
    expect(channel.ack).not.toHaveBeenCalled()
  })

  it('nacks without requeue on malformed JSON', async () => {
    await consumer.start()
    const handler = channel.consume.mock.calls[0][1]

    const badMsg = { content: Buffer.from('not-json') }
    await handler(badMsg)

    expect(channel.nack).toHaveBeenCalledWith(badMsg, false, false)
    expect(useCase.execute).not.toHaveBeenCalled()
  })

  it('ignores null messages (consumer cancelled by broker)', async () => {
    await consumer.start()
    const handler = channel.consume.mock.calls[0][1]

    await handler(null)

    expect(channel.ack).not.toHaveBeenCalled()
    expect(channel.nack).not.toHaveBeenCalled()
  })
})
