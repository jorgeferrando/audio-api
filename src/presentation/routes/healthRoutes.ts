import { Router } from 'express'
import { StatusCodes } from 'http-status-codes'
import mongoose from 'mongoose'
import type { Redis } from 'ioredis'
import type { Client as MinioClient } from 'minio'

export interface HealthDependencies {
  redis: Redis
  minio: MinioClient
  minioBucket: string
}

/**
 * /health  — liveness probe: always 200 if the process is running.
 * /health/ready — readiness probe: checks MongoDB, Redis, MinIO connectivity.
 *
 * K8s uses liveness to decide when to restart a pod and readiness to decide
 * when to route traffic to it. A pod that can't reach MongoDB should not
 * receive requests, but it doesn't need to be killed — the DB might recover.
 */
export function healthRoutes(deps?: HealthDependencies): Router {
  const router = Router()

  router.get('/', (_req, res) => {
    res.status(StatusCodes.OK).json({ status: 'ok' })
  })

  router.get('/ready', async (_req, res) => {
    if (!deps) {
      res.status(StatusCodes.OK).json({ status: 'ok' })
      return
    }

    const checks: Record<string, string> = {}

    // MongoDB
    try {
      const state = mongoose.connection.readyState
      checks.mongodb = state === 1 ? 'ok' : 'disconnected'
    } catch {
      checks.mongodb = 'error'
    }

    // Redis
    try {
      const pong = await deps.redis.ping()
      checks.redis = pong === 'PONG' ? 'ok' : 'error'
    } catch {
      checks.redis = 'error'
    }

    // MinIO
    try {
      await deps.minio.bucketExists(deps.minioBucket)
      checks.minio = 'ok'
    } catch {
      checks.minio = 'error'
    }

    const allOk = Object.values(checks).every(v => v === 'ok')
    const status = allOk ? StatusCodes.OK : StatusCodes.SERVICE_UNAVAILABLE

    res.status(status).json({ status: allOk ? 'ready' : 'degraded', checks })
  })

  return router
}
