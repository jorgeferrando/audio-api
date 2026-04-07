import Redis from 'ioredis'
import { Client as MinioClient } from 'minio'
import { WinstonLogger } from '@infrastructure/logger/WinstonLogger'
import { loadConfig } from '@infrastructure/config'
import { connectMongo, disconnectMongo } from '@infrastructure/db/mongoConnection'
import { connectRabbitMQ, disconnectRabbitMQ } from '@infrastructure/queue/rabbitMQSetup'
import { AudioTrackMongoRepository } from '@infrastructure/db/AudioTrackMongoRepository'
import { ProcessingJobMongoRepository } from '@infrastructure/db/ProcessingJobMongoRepository'
import { RedisCacheService } from '@infrastructure/cache/RedisCacheService'
import { RabbitMQPublisher } from '@infrastructure/queue/RabbitMQPublisher'
import { MinioFileStorage } from '@infrastructure/storage/MinioFileStorage'
import { UploadAudioUseCase } from '@application/audio/UploadAudioUseCase'
import { GetAudioStatusUseCase } from '@application/audio/GetAudioStatusUseCase'
import { DownloadAudioUseCase } from '@application/audio/DownloadAudioUseCase'
import { ListAudioTracksUseCase } from '@application/audio/ListAudioTracksUseCase'
import { DeleteAudioUseCase } from '@application/audio/DeleteAudioUseCase'
import { AudioController } from '@presentation/controllers/AudioController'
import { createApp } from '@infrastructure/http/app'

const config = loadConfig()

async function main(): Promise<void> {
  const logger = new WinstonLogger(config.NODE_ENV)

  // ── Infrastructure ────────────────────────────────────────────────────
  await connectMongo(config.MONGODB_URI, logger)

  const redis      = new Redis(config.REDIS_URL)
  const cache      = new RedisCacheService(redis, logger)
  const rabbitConn = await connectRabbitMQ(config.RABBITMQ_URL, logger)
  const publisher  = new RabbitMQPublisher(rabbitConn.channel, logger)

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

  // ── Use cases ─────────────────────────────────────────────────────────
  const uploadAudio    = new UploadAudioUseCase(audioRepo, jobRepo, publisher, logger)
  const getAudioStatus = new GetAudioStatusUseCase(audioRepo, jobRepo, cache)
  const downloadAudio  = new DownloadAudioUseCase(audioRepo)
  const listAudio      = new ListAudioTracksUseCase(audioRepo)
  const deleteAudio    = new DeleteAudioUseCase(audioRepo, fileStorage, logger)

  // ── HTTP ──────────────────────────────────────────────────────────────
  const controller = new AudioController(
    uploadAudio, getAudioStatus, downloadAudio, listAudio, deleteAudio, fileStorage,
  )

  const healthChecks = [
    { name: 'mongodb', check: async () => (await import('mongoose')).default.connection.readyState === 1 },
    { name: 'redis',   check: async () => (await redis.ping()) === 'PONG' },
    { name: 'minio',   check: async () => { await minioClient.bucketExists(config.MINIO_BUCKET); return true } },
  ]

  const app = createApp(controller, logger, config.API_KEY, healthChecks, redis)

  const server = app.listen(config.PORT, () => {
    logger.info(`API server listening on port ${config.PORT}`)
  })

  // ── Graceful shutdown ─────────────────────────────────────────────────
  const shutdown = async (): Promise<void> => {
    logger.info('Shutting down...')
    const forceExit = setTimeout(() => {
      logger.error('Shutdown timed out, forcing exit')
      process.exit(1)
    }, config.SHUTDOWN_TIMEOUT_MS)
    forceExit.unref()

    try {
      server.close()
      await disconnectRabbitMQ(rabbitConn, logger)
      redis.disconnect()
      await disconnectMongo(logger)
    } catch (e) {
      logger.error('Error during shutdown', { error: e })
    }
    clearTimeout(forceExit)
    process.exit(0)
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

main().catch((err) => {
  console.error('Fatal error starting API server:', err)
  process.exit(1)
})
