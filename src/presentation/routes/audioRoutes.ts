import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import type { AudioController } from '@presentation/controllers/AudioController'
import { busboyUpload } from '@infrastructure/http/busboyUpload'

const uploadLimiter = rateLimit({ windowMs: 60_000, max: 10, standardHeaders: true, legacyHeaders: false })

export function audioRoutes(controller: AudioController): Router {
  const router = Router()

  router.get('/',                controller.list)
  router.post('/', uploadLimiter, busboyUpload(), controller.upload)
  router.get('/:id',            controller.getStatus)
  router.get('/:id/download',   controller.download)
  router.delete('/:id',         controller.remove)

  return router
}
