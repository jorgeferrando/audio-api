import Redis from 'ioredis'
import { Client as MinioClient } from 'minio'
import { WinstonLogger } from '@infrastructure/logger/WinstonLogger'
import { loadConfig } from '@infrastructure/config'
import { connectMongo, disconnectMongo } from '@infrastructure/db/mongoConnection'
import { connectRabbitMQ, disconnectRabbitMQ } from '@infrastructure/queue/rabbitMQSetup'
import { AudioTrackMongoRepository } from '@infrastructure/db/AudioTrackMongoRepository'
import { ProcessingJobMongoRepository } from '@infrastructure/db/ProcessingJobMongoRepository'
import { RedisCacheService } from '@infrastructure/cache/RedisCacheService'
import { FfmpegAudioProcessor } from '@infrastructure/audio/FfmpegAudioProcessor'
import { MinioFileStorage } from '@infrastructure/storage/MinioFileStorage'
import { ProcessJobUseCase } from '@application/job/ProcessJobUseCase'
import { NodeTempFileManager } from '@infrastructure/fs/NodeTempFileManager'
import { RabbitMQConsumer } from '@infrastructure/queue/RabbitMQConsumer'

const config = loadConfig()

async function main(): Promise<void> {
  const logger = new WinstonLogger(config.NODE_ENV)

  // ── Infrastructure ────────────────────────────────────────────────────
  await connectMongo(config.MONGODB_URI, logger)

  const redis      = new Redis(config.REDIS_URL)
  const cache      = new RedisCacheService(redis, logger)
  const rabbitConn = await connectRabbitMQ(config.RABBITMQ_URL, logger)

  const minioClient = new MinioClient({
    endPoint: config.MINIO_ENDPOINT, port: config.MINIO_PORT,
    useSSL: false, accessKey: config.MINIO_ACCESS_KEY, secretKey: config.MINIO_SECRET_KEY,
  })
  const bucketExists = await minioClient.bucketExists(config.MINIO_BUCKET)
  if (!bucketExists) await minioClient.makeBucket(config.MINIO_BUCKET)
  logger.info('MinIO connected', { bucket: config.MINIO_BUCKET })

  const fileStorage = new MinioFileStorage(minioClient, config.MINIO_BUCKET, logger)

  // ── Repositories ──────────────────────────────────────────────────────
  const audioRepo = new AudioTrackMongoRepository(logger)
  const jobRepo   = new ProcessingJobMongoRepository(logger)

  // ── Audio processor ────────────────────────────────────────────────────
  const audioProcessor = new FfmpegAudioProcessor(logger)

  // ── Use case ──────────────────────────────────────────────────────────
  const tempFiles  = new NodeTempFileManager()
  const processJob = new ProcessJobUseCase(audioRepo, jobRepo, audioProcessor, fileStorage, cache, logger, tempFiles)

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
    const forceExit = setTimeout(() => {
      logger.error('Worker shutdown timed out, forcing exit')
      process.exit(1)
    }, config.SHUTDOWN_TIMEOUT_MS)
    forceExit.unref()

    try {
      await consumer.stop()
      await disconnectRabbitMQ(rabbitConn, logger)
      redis.disconnect()
      await disconnectMongo(logger)
    } catch (e) {
      logger.error('Error during worker shutdown', { error: e })
    }
    clearTimeout(forceExit)
    process.exit(0)
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

main().catch((err) => {
  console.error('Fatal error starting worker:', err)
  process.exit(1)
})
