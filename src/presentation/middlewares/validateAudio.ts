import { type Request, type Response, type NextFunction } from 'express'
import { StatusCodes } from 'http-status-codes'

type AudioValidator = (filePath: string) => Promise<boolean>

/**
 * Middleware that validates uploaded file contains real audio data.
 *
 * Receives the validator function via factory (DI) so the presentation
 * layer does not import infrastructure directly. The composition root
 * wires the concrete ffprobe-based validator.
 */
export function validateAudioMiddleware(validator: AudioValidator) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.file) {
      next()
      return
    }

    const isValid = await validator(req.file.path)
    if (!isValid) {
      // Cleanup the rejected temp file
      const fs = await import('fs')
      fs.unlink(req.file.path, () => {})

      res.status(StatusCodes.BAD_REQUEST).json({
        error: 'VALIDATION_ERROR',
        message: 'file does not contain valid audio data',
      })
      return
    }

    next()
  }
}
