import { randomUUID } from 'crypto'
import type { Request, Response, NextFunction } from 'express'

/**
 * Middleware that attaches a correlation ID to every request.
 *
 * If the client already sends an X-Request-Id header the value is reused;
 * otherwise a new UUID is generated. The ID is set on both the request
 * object (for downstream logging) and the response header (for client
 * correlation).
 */
export function correlationId() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const id = (req.headers['x-request-id'] as string) || randomUUID()
    req.correlationId = id
    res.setHeader('X-Request-Id', id)
    next()
  }
}
