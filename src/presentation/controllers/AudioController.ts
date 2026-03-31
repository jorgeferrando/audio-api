import { type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { StatusCodes } from 'http-status-codes'
import { ValidationError } from '@shared/AppError'
import { AudioEffect } from '@domain/job/ProcessingJob'
import type { UploadAudioUseCase } from '@application/audio/UploadAudioUseCase'
import type { GetAudioStatusUseCase } from '@application/audio/GetAudioStatusUseCase'

const uploadSchema = z.object({
  filename:    z.string().min(1, 'filename is required'),
  mimeType:    z.string().min(1, 'mimeType is required'),
  sizeInBytes: z.number().int().positive('sizeInBytes must be a positive integer'),
  effect:      z.nativeEnum(AudioEffect, { message: 'invalid audio effect' }),
})

/**
 * Thin controller — validates the HTTP request, delegates to use cases,
 * and maps the Result to an HTTP response. No business logic here.
 *
 * Errors are forwarded to Express's `next()` so the errorHandler middleware
 * can map them to HTTP status codes consistently across all endpoints.
 */
export class AudioController {
  constructor(
    private readonly uploadAudio: UploadAudioUseCase,
    private readonly getAudioStatus: GetAudioStatusUseCase,
  ) {}

  upload = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const parsed = uploadSchema.safeParse(req.body)
    if (!parsed.success) {
      next(new ValidationError(parsed.error.issues[0].message))
      return
    }

    const result = await this.uploadAudio.execute(parsed.data)

    if (result.isErr()) {
      next(result.error)
      return
    }

    res.status(StatusCodes.ACCEPTED).json(result.value)
  }

  getStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.getAudioStatus.execute({
      audioTrackId: req.params.id,
    })

    if (result.isErr()) {
      next(result.error)
      return
    }

    res.status(StatusCodes.OK).json(result.value)
  }
}
