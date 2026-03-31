import path from 'path'
import express, { type RequestHandler } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import type { ILogger } from '@shared/ILogger'
import type { AudioController } from '@presentation/controllers/AudioController'
import { audioRoutes } from '@presentation/routes/audioRoutes'
import { healthRoutes } from '@presentation/routes/healthRoutes'
import { errorHandler } from '@presentation/middlewares/errorHandler'

export function createApp(
  controller: AudioController,
  logger: ILogger,
  limiter?: RequestHandler,
): express.Application {
  const app = express()

  // ── Security & parsing ──────────────────────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        mediaSrc: ["'self'", "blob:"],
      },
    },
  }))
  app.use(cors())
  app.use(express.json())

  if (limiter) app.use('/api', limiter)

  // ── Static UI ────────────────────────────────────────────────────────────
  app.use(express.static(path.resolve(process.cwd(), 'src', 'presentation', 'public')))

  // ── Routes ──────────────────────────────────────────────────────────────
  app.use('/api/v1/health', healthRoutes())
  app.use('/api/v1/audio',  audioRoutes(controller))

  // ── Global error handler (must be last) ─────────────────────────────────
  app.use(errorHandler(logger))

  return app
}
