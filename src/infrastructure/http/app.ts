import fs from 'fs'
import path from 'path'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import type { ILogger } from '@shared/ILogger'
import type { AudioController } from '@presentation/controllers/AudioController'
import { audioRoutes } from '@presentation/routes/audioRoutes'
import { healthRoutes } from '@presentation/routes/healthRoutes'
import { errorHandler } from '@presentation/middlewares/errorHandler'
import { apiKeyAuth } from '@presentation/middlewares/apiKeyAuth'

export function createApp(
  controller: AudioController,
  logger: ILogger,
  apiKey?: string,
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

  app.use('/api', rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  }))

  // ── Static UI ────────────────────────────────────────────────────────────
  const publicDir = path.resolve(process.cwd(), 'src', 'presentation', 'public')
  const indexHtml = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf-8')
  const indexWithKey = indexHtml.replace('{{API_KEY}}', apiKey ?? '')

  app.get('/', (_req, res) => {
    res.type('html').send(indexWithKey)
  })

  // ── Routes ──────────────────────────────────────────────────────────────
  app.use('/api/v1/health', healthRoutes())
  app.use('/api/v1/audio',  apiKeyAuth(apiKey), audioRoutes(controller))

  // ── Global error handler (must be last) ─────────────────────────────────
  app.use(errorHandler(logger))

  return app
}
