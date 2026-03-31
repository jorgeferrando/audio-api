import dotenv from 'dotenv'
import Redis from 'ioredis'
import { WinstonLogger } from '@infrastructure/logger/WinstonLogger'
import { connectMongo, disconnectMongo } from '@infrastructure/db/mongoConnection'
import { connectRabbitMQ, disconnectRabbitMQ } from '@infrastructure/queue/rabbitMQSetup'
import { AudioTrackMongoRepository } from '@infrastructure/db/AudioTrackMongoRepository'
import { ProcessingJobMongoRepository } from '@infrastructure/db/ProcessingJobMongoRepository'
import { RedisCacheService } from '@infrastructure/cache/RedisCacheService'
import { FfmpegAudioProcessor } from '@infrastructure/audio/FfmpegAudioProcessor'
import { ProcessJobUseCase } from '@application/job/ProcessJobUseCase'
import { RabbitMQConsumer } from '@infrastructure/queue/RabbitMQConsumer'

dotenv.config()

const MONGO_URI  = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/audio-api'
const REDIS_URL  = process.env.REDIS_URL ?? 'redis://localhost:6379'
const RABBIT_URL = process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672'

async function main(): Promise<void> {
  const logger = new WinstonLogger(process.env.NODE_ENV ?? 'development')

  // ── Infrastructure ────────────────────────────────────────────────────
  await connectMongo(MONGO_URI, logger)

  const redis      = new Redis(REDIS_URL)
  const cache      = new RedisCacheService(redis)
  const rabbitConn = await connectRabbitMQ(RABBIT_URL, logger)

  // ── Repositories ──────────────────────────────────────────────────────
  const audioRepo = new AudioTrackMongoRepository(logger)
  const jobRepo   = new ProcessingJobMongoRepository(logger)

  // ── Audio processor ────────────────────────────────────────────────────
  const audioProcessor = new FfmpegAudioProcessor(logger)

  // ── Use case ──────────────────────────────────────────────────────────
  const processJob = new ProcessJobUseCase(audioRepo, jobRepo, audioProcessor, cache, logger)

  // ── Consumer ──────────────────────────────────────────────────────────
  const consumer = new RabbitMQConsumer(rabbitConn.channel, processJob, logger)
  await consumer.start()

  logger.info('Worker started, consuming audio.jobs queue')

  // ── Graceful shutdown ─────────────────────────────────────────────────
  const shutdown = async (): Promise<void> => {
    logger.info('Worker shutting down...')
    await disconnectRabbitMQ(rabbitConn, logger)
    redis.disconnect()
    await disconnectMongo(logger)
    process.exit(0)
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

main().catch((err) => {
  console.error('Fatal error starting worker:', err)
  process.exit(1)
})
