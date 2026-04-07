import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

/**
 * Centralised application configuration validated with Zod.
 *
 * Both the API server (index.ts) and the worker (worker.ts) import loadConfig()
 * so environment variables are parsed and validated in a single place.
 * If any required variable is missing or malformed the process fails fast
 * at startup with a clear error message.
 */
const configSchema = z.object({
  NODE_ENV:            z.enum(['development', 'production', 'test']).default('development'),
  PORT:                z.coerce.number().default(3000),
  MONGODB_URI:         z.string().min(1, 'MONGODB_URI is required'),
  REDIS_URL:           z.string().min(1, 'REDIS_URL is required'),
  RABBITMQ_URL:        z.string().min(1, 'RABBITMQ_URL is required'),
  MINIO_ENDPOINT:      z.string().min(1, 'MINIO_ENDPOINT is required'),
  MINIO_PORT:          z.coerce.number().default(9000),
  MINIO_ACCESS_KEY:    z.string().min(1, 'MINIO_ACCESS_KEY is required'),
  MINIO_SECRET_KEY:    z.string().min(1, 'MINIO_SECRET_KEY is required'),
  MINIO_BUCKET:        z.string().min(1).default('audio-api'),
  API_KEY:             z.string().min(1).optional(),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().default(25_000),
})

export type AppConfig = z.infer<typeof configSchema>

export function loadConfig(): AppConfig {
  return configSchema.parse(process.env)
}
