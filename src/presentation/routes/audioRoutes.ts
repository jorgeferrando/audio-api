import { Router } from 'express'
import type { AudioController } from '@presentation/controllers/AudioController'

export function audioRoutes(controller: AudioController): Router {
  const router = Router()

  router.post('/',    controller.upload)
  router.get('/:id',  controller.getStatus)

  return router
}
