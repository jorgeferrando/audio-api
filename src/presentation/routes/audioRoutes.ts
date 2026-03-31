import { Router } from 'express'
import type { AudioController } from '@presentation/controllers/AudioController'
import { uploadMiddleware } from '@infrastructure/http/multerConfig'

export function audioRoutes(controller: AudioController): Router {
  const router = Router()

  router.post('/',              uploadMiddleware, controller.upload)
  router.get('/:id',            controller.getStatus)
  router.get('/:id/download',   controller.download)

  return router
}
