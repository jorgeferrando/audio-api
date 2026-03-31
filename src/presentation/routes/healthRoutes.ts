import { Router } from 'express'
import { StatusCodes } from 'http-status-codes'

export function healthRoutes(): Router {
  const router = Router()

  router.get('/', (_req, res) => {
    res.status(StatusCodes.OK).json({ status: 'ok' })
  })

  return router
}
