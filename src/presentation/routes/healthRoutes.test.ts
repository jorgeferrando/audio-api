import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import express from 'express'
import { healthRoutes, type HealthCheck } from './healthRoutes'

function buildApp(checks?: HealthCheck[]) {
  const app = express()
  app.use('/health', healthRoutes(checks))
  return app
}

describe('healthRoutes', () => {
  describe('GET /health', () => {
    it('returns 200 with { status: "ok" }', async () => {
      const res = await request(buildApp()).get('/health')
      expect(res.status).toBe(200)
      expect(res.body.status).toBe('ok')
    })
  })

  describe('GET /health/ready', () => {
    it('returns 200 when all checks pass', async () => {
      const checks: HealthCheck[] = [
        { name: 'mongodb', check: vi.fn().mockResolvedValue(true) },
        { name: 'redis', check: vi.fn().mockResolvedValue(true) },
      ]

      const res = await request(buildApp(checks)).get('/health/ready')

      expect(res.status).toBe(200)
      expect(res.body.status).toBe('ready')
      expect(res.body.checks).toEqual({ mongodb: 'ok', redis: 'ok' })
    })

    it('returns 503 when a check fails', async () => {
      const checks: HealthCheck[] = [
        { name: 'mongodb', check: vi.fn().mockResolvedValue(true) },
        { name: 'redis', check: vi.fn().mockResolvedValue(false) },
      ]

      const res = await request(buildApp(checks)).get('/health/ready')

      expect(res.status).toBe(503)
      expect(res.body.status).toBe('degraded')
      expect(res.body.checks.redis).toBe('error')
    })

    it('returns 503 when a check throws', async () => {
      const checks: HealthCheck[] = [
        { name: 'mongodb', check: vi.fn().mockRejectedValue(new Error('timeout')) },
      ]

      const res = await request(buildApp(checks)).get('/health/ready')

      expect(res.status).toBe(503)
      expect(res.body.checks.mongodb).toBe('error')
    })

    it('returns 200 when no checks are configured', async () => {
      const res = await request(buildApp()).get('/health/ready')
      expect(res.status).toBe(200)
    })
  })
})
