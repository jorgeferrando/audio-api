import { Router } from 'express'
import rateLimit, { type Store } from 'express-rate-limit'
import type { AudioController } from '@presentation/controllers/AudioController'
import { busboyUpload } from '@infrastructure/http/busboyUpload'

export function audioRoutes(controller: AudioController, rateLimitStore?: Store): Router {
  const router = Router()

  const uploadLimiter = rateLimit({
    windowMs: 60_000, max: 10, standardHeaders: true, legacyHeaders: false,
    ...(rateLimitStore ? { store: rateLimitStore } : {}),
  })

  router.get('/',                controller.list)
  router.post('/', uploadLimiter, busboyUpload(), controller.upload)
  router.get('/:id',            controller.getStatus)
  router.get('/:id/sse',        controller.streamStatus)
  router.get('/:id/download',   controller.download)
  router.delete('/:id',         controller.remove)

  return router
}
