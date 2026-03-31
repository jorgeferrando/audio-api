import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import Redis from 'ioredis'
import { WinstonLogger } from '@infrastructure/logger/WinstonLogger'
import { connectMongo, disconnectMongo } from '@infrastructure/db/mongoConnection'
import { connectRabbitMQ, disconnectRabbitMQ } from '@infrastructure/queue/rabbitMQSetup'
import { AudioTrackMongoRepository } from '@infrastructure/db/AudioTrackMongoRepository'
import { ProcessingJobMongoRepository } from '@infrastructure/db/ProcessingJobMongoRepository'
import { RedisCacheService } from '@infrastructure/cache/RedisCacheService'
import { RabbitMQPublisher } from '@infrastructure/queue/RabbitMQPublisher'
import { UploadAudioUseCase } from '@application/audio/UploadAudioUseCase'
import { GetAudioStatusUseCase } from '@application/audio/GetAudioStatusUseCase'
import { DownloadAudioUseCase } from '@application/audio/DownloadAudioUseCase'
import { AudioController } from '@presentation/controllers/AudioController'
import { createApp } from '@infrastructure/http/app'

dotenv.config()

const PORT       = process.env.PORT ?? 3000
const MONGO_URI  = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/audio-api'
const REDIS_URL  = process.env.REDIS_URL ?? 'redis://localhost:6379'
const RABBIT_URL = process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672'

async function main(): Promise<void> {
  const logger = new WinstonLogger(process.env.NODE_ENV ?? 'development')

  // ── Ensure upload directories exist ───────────────────────────────────
  fs.mkdirSync(path.resolve(process.cwd(), 'uploads', 'originals'), { recursive: true })
  fs.mkdirSync(path.resolve(process.cwd(), 'uploads', 'processed'), { recursive: true })

  // ── Infrastructure ────────────────────────────────────────────────────
  await connectMongo(MONGO_URI, logger)

  const redis      = new Redis(REDIS_URL)
  const cache      = new RedisCacheService(redis)
  const rabbitConn = await connectRabbitMQ(RABBIT_URL, logger)
  const publisher  = new RabbitMQPublisher(rabbitConn.channel, logger)

  // ── Repositories ──────────────────────────────────────────────────────
  const audioRepo = new AudioTrackMongoRepository(logger)
  const jobRepo   = new ProcessingJobMongoRepository(logger)

  // ── Use cases ─────────────────────────────────────────────────────────
  const uploadAudio    = new UploadAudioUseCase(audioRepo, jobRepo, publisher, logger)
  const getAudioStatus = new GetAudioStatusUseCase(audioRepo, jobRepo, cache)
  const downloadAudio  = new DownloadAudioUseCase(audioRepo)

  // ── HTTP ──────────────────────────────────────────────────────────────
  const controller = new AudioController(uploadAudio, getAudioStatus, downloadAudio)
  const app        = createApp(controller, logger)

  const server = app.listen(PORT, () => {
    logger.info(`API server listening on port ${PORT}`)
  })

  // ── Graceful shutdown ─────────────────────────────────────────────────
  const shutdown = async (): Promise<void> => {
    logger.info('Shutting down...')
    server.close()
    await disconnectRabbitMQ(rabbitConn, logger)
    redis.disconnect()
    await disconnectMongo(logger)
    process.exit(0)
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

main().catch((err) => {
  console.error('Fatal error starting API server:', err)
  process.exit(1)
})
