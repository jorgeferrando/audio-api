import express, { Router } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import type { Redis } from 'ioredis'
import RedisStore from 'rate-limit-redis'
import type { ILogger } from '@shared/ILogger'
import type { AudioController } from '@presentation/controllers/AudioController'
import { audioRoutes } from '@presentation/routes/audioRoutes'
import { healthRoutes, type HealthCheck } from '@presentation/routes/healthRoutes'
import { errorHandler } from '@presentation/middlewares/errorHandler'
import { apiKeyAuth } from '@presentation/middlewares/apiKeyAuth'
import { correlationId } from '@presentation/middlewares/correlationId'

/**
 * Creates the Express app — API only.
 * Static files (HTML, CSS, JS) are served by nginx in production/Docker.
 *
 * When a Redis client is provided, rate limiting state is shared across
 * all instances via Redis instead of being in-memory per process.
 */
export function createApp(
  controller: AudioController,
  logger: ILogger,
  apiKey?: string,
  healthChecks?: HealthCheck[],
  redisClient?: Redis,
): express.Application {
  const app = express()

  const rateLimitStore = redisClient
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? new RedisStore({ sendCommand: (...args: string[]) => (redisClient.call as any)(...args) })
    : undefined

  // ── Security & parsing ──────────────────────────────────────────────────
  app.use(helmet())
  app.use(correlationId())
  app.use(cors())
  app.use(express.json())

  app.use('/api', rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    ...(rateLimitStore ? { store: rateLimitStore } : {}),
  }))

  // ── Routes ──────────────────────────────────────────────────────────────
  const v1 = Router()
  v1.use('/health', healthRoutes(healthChecks))
  v1.use('/audio',  apiKeyAuth(apiKey), audioRoutes(controller, rateLimitStore))

  app.use('/api/v1', v1)

  // ── Global error handler (must be last) ─────────────────────────────────
  app.use(errorHandler(logger))

  return app
}
