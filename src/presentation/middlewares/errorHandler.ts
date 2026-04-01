import { type Request, type Response, type NextFunction } from 'express'
import { StatusCodes } from 'http-status-codes'
import multer from 'multer'
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

const MULTER_MESSAGES: Record<string, string> = {
  LIMIT_FILE_SIZE:       'File exceeds the maximum allowed size of 50MB',
  LIMIT_UNEXPECTED_FILE: 'Unexpected file field',
}

/**
 * Global Express error handler — must be registered last.
 *
 * Handles three error types:
 *   1. AppError — maps code to HTTP status.
 *   2. MulterError — file upload validation failures (size, field name).
 *   3. Other Error with message — multer fileFilter rejections or middleware errors.
 *   4. Unknown — generic 500 without leaking internals.
 */
export function errorHandler(logger: ILogger) {
  return (error: unknown, _req: Request, res: Response, _next: NextFunction): void => {
    if (error instanceof AppError) {
      const status = HTTP_STATUS[error.code] ?? StatusCodes.INTERNAL_SERVER_ERROR
      res.status(status).json({ error: error.code, message: error.message })
      return
    }

    if (error instanceof multer.MulterError) {
      const message = MULTER_MESSAGES[error.code] ?? error.message
      res.status(StatusCodes.BAD_REQUEST).json({ error: 'UPLOAD_ERROR', message })
      return
    }

    if (error instanceof Error && error.message) {
      res.status(StatusCodes.BAD_REQUEST).json({ error: 'VALIDATION_ERROR', message: error.message })
      return
    }

    logger.error('Unhandled error', { error })
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      error:   'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    })
  }
}
