import { createReadStream } from 'fs'
import { type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { StatusCodes } from 'http-status-codes'
import { ValidationError, AppError } from '@shared/AppError'
import { AudioEffect } from '@domain/job/ProcessingJob'
import type { UploadAudioUseCase } from '@application/audio/UploadAudioUseCase'
import type { GetAudioStatusUseCase } from '@application/audio/GetAudioStatusUseCase'

const effectSchema = z.object({
  effect: z.nativeEnum(AudioEffect, { message: 'invalid audio effect' }),
})

/**
 * Thin controller — validates the HTTP request, delegates to use cases,
 * and maps the Result to an HTTP response. No business logic here.
 */
export class AudioController {
  constructor(
    private readonly uploadAudio: UploadAudioUseCase,
    private readonly getAudioStatus: GetAudioStatusUseCase,
  ) {}

  upload = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.file) {
      next(new ValidationError('file is required'))
      return
    }

    const parsed = effectSchema.safeParse(req.body)
    if (!parsed.success) {
      next(new ValidationError(parsed.error.issues[0].message))
      return
    }

    const result = await this.uploadAudio.execute({
      filename:    req.file.originalname,
      mimeType:    req.file.mimetype,
      sizeInBytes: req.file.size,
      effect:      parsed.data.effect,
      filePath:    req.file.path,
    })

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

  download = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.getAudioStatus.execute({
      audioTrackId: req.params.id,
    })

    if (result.isErr()) {
      next(result.error)
      return
    }

    const dto = result.value
    if (dto.status !== 'READY' || !dto.processedFilePath) {
      next(new AppError('Audio is not ready for download', 'NOT_READY'))
      return
    }

    res.setHeader('Content-Disposition', `attachment; filename="processed_${dto.filename}"`)
    res.setHeader('Content-Type', dto.mimeType)
    createReadStream(dto.processedFilePath).pipe(res)
  }
}
