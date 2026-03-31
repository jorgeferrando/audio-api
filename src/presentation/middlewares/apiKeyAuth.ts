import { type Request, type Response, type NextFunction } from 'express'
import { StatusCodes } from 'http-status-codes'

/**
 * Simple API key authentication middleware.
 *
 * Checks the `x-api-key` header against the configured key.
 * Skips authentication if no API_KEY is set (development mode).
 */
export function apiKeyAuth(apiKey: string | undefined) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!apiKey) {
      next()
      return
    }

    const provided = req.header('x-api-key')

    if (provided === apiKey) {
      next()
      return
    }

    res.status(StatusCodes.UNAUTHORIZED).json({
      error: 'UNAUTHORIZED',
      message: 'Invalid or missing API key',
    })
  }
}
