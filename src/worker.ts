import dotenv from 'dotenv'
import Redis from 'ioredis'
import { WinstonLogger } from '@infrastructure/logger/WinstonLogger'
import { connectMongo } from '@infrastructure/db/mongoConnection'
import { connectRabbitMQ } from '@infrastructure/queue/rabbitMQSetup'
import { AudioTrackMongoRepository } from '@infrastructure/db/AudioTrackMongoRepository'
import { ProcessingJobMongoRepository } from '@infrastructure/db/ProcessingJobMongoRepository'
import { RedisCacheService } from '@infrastructure/cache/RedisCacheService'
import { ProcessJobUseCase } from '@application/job/ProcessJobUseCase'
import { RabbitMQConsumer } from '@infrastructure/queue/RabbitMQConsumer'

dotenv.config()

const MONGO_URI  = process.env.MONGO_URI ?? 'mongodb://localhost:27017/audio-api'
const REDIS_URL  = process.env.REDIS_URL ?? 'redis://localhost:6379'
const RABBIT_URL = process.env.RABBIT_URL ?? 'amqp://guest:guest@localhost:5672'

async function main(): Promise<void> {
  const logger = new WinstonLogger(process.env.NODE_ENV ?? 'development')

  // ── Infrastructure ────────────────────────────────────────────────────
  await connectMongo(MONGO_URI, logger)

  const redis      = new Redis(REDIS_URL)
  const cache      = new RedisCacheService(redis)
  const { channel } = await connectRabbitMQ(RABBIT_URL, logger)

  // ── Repositories ──────────────────────────────────────────────────────
  const audioRepo = new AudioTrackMongoRepository(logger)
  const jobRepo   = new ProcessingJobMongoRepository(logger)

  // ── Use case ──────────────────────────────────────────────────────────
  const processJob = new ProcessJobUseCase(audioRepo, jobRepo, cache, logger)

  // ── Consumer ──────────────────────────────────────────────────────────
  const consumer = new RabbitMQConsumer(channel, processJob, logger)
  await consumer.start()

  logger.info('Worker started, consuming audio.jobs queue')
}

main().catch((err) => {
  console.error('Fatal error starting worker:', err)
  process.exit(1)
})
