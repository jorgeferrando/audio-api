import { type Request, type Response, type NextFunction } from 'express'
import { StatusCodes } from 'http-status-codes'
import { AppError } from '@shared/AppError'
import type { ILogger } from '@shared/ILogger'

const HTTP_STATUS: Record<string, number> = {
  VALIDATION_ERROR: StatusCodes.BAD_REQUEST,
  NOT_FOUND:        StatusCodes.NOT_FOUND,
  NOT_READY:        StatusCodes.CONFLICT,
  CONFLICT:         StatusCodes.CONFLICT,
  PROCESSING_ERROR: StatusCodes.INTERNAL_SERVER_ERROR,
  DATABASE_ERROR:   StatusCodes.SERVICE_UNAVAILABLE,
  STORAGE_ERROR:    StatusCodes.SERVICE_UNAVAILABLE,
  QUEUE_ERROR:      StatusCodes.SERVICE_UNAVAILABLE,
}

/**
 * Global Express error handler — must be registered last.
 *
 * Handles:
 *   1. AppError — maps code to HTTP status.
 *   2. Error with message — validation or middleware errors.
 *   3. Unknown — generic 500 without leaking internals.
 */
export function errorHandler(logger: ILogger) {
  return (error: unknown, req: Request, res: Response, _next: NextFunction): void => {
    const correlationId = req.correlationId

    if (error instanceof AppError) {
      const status = HTTP_STATUS[error.code] ?? StatusCodes.INTERNAL_SERVER_ERROR
      res.status(status).json({ error: error.code, message: error.message, correlationId })
      return
    }

    if (error instanceof Error && error.message) {
      res.status(StatusCodes.BAD_REQUEST).json({ error: 'VALIDATION_ERROR', message: error.message, correlationId })
      return
    }

    logger.error('Unhandled error', { error, correlationId })
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      error:   'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      correlationId,
    })
  }
}
