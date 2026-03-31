import { type Request, type Response, type NextFunction } from 'express'
import { StatusCodes } from 'http-status-codes'
import { AppError } from '@shared/AppError'
import type { ILogger } from '@shared/ILogger'

const HTTP_STATUS: Record<string, number> = {
  VALIDATION_ERROR: StatusCodes.BAD_REQUEST,
  NOT_FOUND:        StatusCodes.NOT_FOUND,
  CONFLICT:         StatusCodes.CONFLICT,
  DATABASE_ERROR:   StatusCodes.SERVICE_UNAVAILABLE,
  QUEUE_ERROR:      StatusCodes.SERVICE_UNAVAILABLE,
}

/**
 * Global Express error handler — must be registered last.
 *
 * Maps AppError codes to HTTP status codes. Any unrecognised error
 * (including unexpected exceptions from infrastructure) returns 500
 * without leaking internal details to the client.
 */
export function errorHandler(logger: ILogger) {
  return (error: unknown, _req: Request, res: Response, _next: NextFunction): void => {
    if (error instanceof AppError) {
      const status = HTTP_STATUS[error.code] ?? StatusCodes.INTERNAL_SERVER_ERROR
      res.status(status).json({ error: error.code, message: error.message })
      return
    }

    logger.error('Unhandled error', { error })
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      error:   'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    })
  }
}
