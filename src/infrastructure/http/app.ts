import fs from 'fs'
import path from 'path'
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

export function createApp(
  controller: AudioController,
  logger: ILogger,
  apiKey?: string,
  healthChecks?: HealthCheck[],
  validateAudio?: express.RequestHandler,
): express.Application {
  const app = express()

  // ── Security & parsing ──────────────────────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        mediaSrc: ["'self'", "blob:"],
      },
    },
  }))
  app.use(cors())
  app.use(express.json())

  app.use('/api', rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  }))

  // ── Static UI ────────────────────────────────────────────────────────────
  const publicDir = path.resolve(process.cwd(), 'src', 'presentation', 'public')
  const indexPath = path.join(publicDir, 'index.html')

  app.get('/', (_req, res) => {
    const html = fs.readFileSync(indexPath, 'utf-8')
    res.type('html').send(html.replace('{{API_KEY}}', apiKey ?? ''))
  })
  app.use(express.static(publicDir, { etag: false, lastModified: false }))

  // ── Routes ──────────────────────────────────────────────────────────────
  const v1 = Router()
  v1.use('/health', healthRoutes(healthChecks))
  v1.use('/audio',  apiKeyAuth(apiKey), audioRoutes(controller, validateAudio))

  app.use('/api/v1', v1)

  // ── Global error handler (must be last) ─────────────────────────────────
  app.use(errorHandler(logger))

  return app
}
