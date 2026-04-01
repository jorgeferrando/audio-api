import { Router } from 'express'
import { StatusCodes } from 'http-status-codes'

export interface HealthCheck {
  name: string
  check: () => Promise<boolean>
}

/**
 * /health  — liveness probe: always 200 if the process is running.
 * /health/ready — readiness probe: runs all registered health checks.
 */
export function healthRoutes(checks?: HealthCheck[]): Router {
  const router = Router()

  router.get('/', (_req, res) => {
    res.status(StatusCodes.OK).json({ status: 'ok' })
  })

  router.get('/ready', async (_req, res) => {
    if (!checks || checks.length === 0) {
      res.status(StatusCodes.OK).json({ status: 'ok' })
      return
    }

    const results: Record<string, string> = {}

    for (const { name, check } of checks) {
      try {
        results[name] = (await check()) ? 'ok' : 'error'
      } catch {
        results[name] = 'error'
      }
    }

    const allOk = Object.values(results).every(v => v === 'ok')

    res.status(allOk ? StatusCodes.OK : StatusCodes.SERVICE_UNAVAILABLE).json({
      status: allOk ? 'ready' : 'degraded',
      checks: results,
    })
  })

  return router
}
