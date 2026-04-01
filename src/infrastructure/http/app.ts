import express, { Router } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import type { ILogger } from '@shared/ILogger'
import type { AudioController } from '@presentation/controllers/AudioController'
import { audioRoutes } from '@presentation/routes/audioRoutes'
import { healthRoutes, type HealthCheck } from '@presentation/routes/healthRoutes'
import { errorHandler } from '@presentation/middlewares/errorHandler'
import { apiKeyAuth } from '@presentation/middlewares/apiKeyAuth'

/**
 * Creates the Express app — API only.
 * Static files (HTML, CSS, JS) are served by nginx in production/Docker.
 */
export function createApp(
  controller: AudioController,
  logger: ILogger,
  apiKey?: string,
  healthChecks?: HealthCheck[],
  validateAudio?: express.RequestHandler,
): express.Application {
  const app = express()

  // ── Security & parsing ──────────────────────────────────────────────────
  app.use(helmet())
  app.use(cors())
  app.use(express.json())

  app.use('/api', rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  }))

  // ── Routes ──────────────────────────────────────────────────────────────
  const v1 = Router()
  v1.use('/health', healthRoutes(healthChecks))
  v1.use('/audio',  apiKeyAuth(apiKey), audioRoutes(controller, validateAudio))

  app.use('/api/v1', v1)

  // ── Global error handler (must be last) ─────────────────────────────────
  app.use(errorHandler(logger))

  return app
}
