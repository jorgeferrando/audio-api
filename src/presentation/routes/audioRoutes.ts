import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import type { RequestHandler } from 'express'
import type { AudioController } from '@presentation/controllers/AudioController'
import { uploadMiddleware } from '@infrastructure/http/multerConfig'

// Fix 4: stricter rate limit for uploads (CPU-intensive due to ffprobe + MinIO streaming)
const uploadLimiter = rateLimit({ windowMs: 60_000, max: 10, standardHeaders: true, legacyHeaders: false })

export function audioRoutes(controller: AudioController, validateAudio?: RequestHandler): Router {
  const router = Router()

  const uploadChain: RequestHandler[] = [uploadLimiter, uploadMiddleware]
  if (validateAudio) uploadChain.push(validateAudio)
  uploadChain.push(controller.upload)

  router.get('/',                controller.list)
  router.post('/', ...uploadChain)
  router.get('/:id',            controller.getStatus)
  router.get('/:id/download',   controller.download)
  router.delete('/:id',         controller.remove)

  return router
}
