import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import type { ILogger } from '@shared/ILogger'
import type { AudioController } from '@presentation/controllers/AudioController'
import { audioRoutes } from '@presentation/routes/audioRoutes'
import { healthRoutes } from '@presentation/routes/healthRoutes'
import { errorHandler } from '@presentation/middlewares/errorHandler'

/**
 * Creates and configures the Express app.
 *
 * Receives the controller (already wired with use cases) so the app
 * itself has no knowledge of domain or infrastructure. The composition
 * root builds the dependency graph and passes the controller in.
 */
export function createApp(controller: AudioController, logger: ILogger): express.Application {
  const app = express()

  // ── Security & parsing ──────────────────────────────────────────────────
  app.use(helmet())
  app.use(cors())
  app.use(express.json())

  // ── Routes ──────────────────────────────────────────────────────────────
  app.use('/api/v1/health', healthRoutes())
  app.use('/api/v1/audio',  audioRoutes(controller))

  // ── Global error handler (must be last) ─────────────────────────────────
  app.use(errorHandler(logger))

  return app
}
