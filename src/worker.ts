import dotenv from 'dotenv'
import Redis from 'ioredis'
import { Client as MinioClient } from 'minio'
import { WinstonLogger } from '@infrastructure/logger/WinstonLogger'
import { connectMongo, disconnectMongo } from '@infrastructure/db/mongoConnection'
import { connectRabbitMQ, disconnectRabbitMQ } from '@infrastructure/queue/rabbitMQSetup'
import { AudioTrackMongoRepository } from '@infrastructure/db/AudioTrackMongoRepository'
import { ProcessingJobMongoRepository } from '@infrastructure/db/ProcessingJobMongoRepository'
import { RedisCacheService } from '@infrastructure/cache/RedisCacheService'
import { FfmpegAudioProcessor } from '@infrastructure/audio/FfmpegAudioProcessor'
import { MinioFileStorage } from '@infrastructure/storage/MinioFileStorage'
import { ProcessJobUseCase } from '@application/job/ProcessJobUseCase'
import { RabbitMQConsumer } from '@infrastructure/queue/RabbitMQConsumer'

dotenv.config()

const MONGO_URI       = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/audio-api'
const REDIS_URL       = process.env.REDIS_URL ?? 'redis://localhost:6379'
const RABBIT_URL      = process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672'
const MINIO_ENDPOINT  = process.env.MINIO_ENDPOINT ?? 'localhost'
const MINIO_PORT      = Number(process.env.MINIO_PORT ?? 9000)
const MINIO_ACCESS    = process.env.MINIO_ACCESS_KEY ?? 'minioadmin'
const MINIO_SECRET    = process.env.MINIO_SECRET_KEY ?? 'minioadmin'
const MINIO_BUCKET    = process.env.MINIO_BUCKET ?? 'audio-api'

async function main(): Promise<void> {
  const logger = new WinstonLogger(process.env.NODE_ENV ?? 'development')

  // ── Infrastructure ────────────────────────────────────────────────────
  await connectMongo(MONGO_URI, logger)

  const redis      = new Redis(REDIS_URL)
  const cache      = new RedisCacheService(redis)
  const rabbitConn = await connectRabbitMQ(RABBIT_URL, logger)

  const minioClient = new MinioClient({
    endPoint: MINIO_ENDPOINT, port: MINIO_PORT,
    useSSL: false, accessKey: MINIO_ACCESS, secretKey: MINIO_SECRET,
  })
  const bucketExists = await minioClient.bucketExists(MINIO_BUCKET)
  if (!bucketExists) await minioClient.makeBucket(MINIO_BUCKET)
  logger.info('MinIO connected', { bucket: MINIO_BUCKET })

  const fileStorage = new MinioFileStorage(minioClient, MINIO_BUCKET, logger)

  // ── Repositories ──────────────────────────────────────────────────────
  const audioRepo = new AudioTrackMongoRepository(logger)
  const jobRepo   = new ProcessingJobMongoRepository(logger)

  // ── Audio processor ────────────────────────────────────────────────────
  const audioProcessor = new FfmpegAudioProcessor(logger)

  // ── Use case ──────────────────────────────────────────────────────────
  const processJob = new ProcessJobUseCase(audioRepo, jobRepo, audioProcessor, fileStorage, cache, logger)

  // ── Consumer ──────────────────────────────────────────────────────────
  const consumer = new RabbitMQConsumer(rabbitConn.channel, processJob, logger)
  await consumer.start()

  logger.info('Worker started, consuming audio.jobs queue')

  // ── Graceful shutdown ─────────────────────────────────────────────────
  // 1. Stop accepting new messages (channel.cancel)
  // 2. Wait for the in-flight job to finish (drain)
  // 3. Close connections
  const shutdown = async (): Promise<void> => {
    logger.info('Worker shutting down...')
    await consumer.stop()
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
