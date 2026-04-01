import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { StatusCodes } from 'http-status-codes'
import { ValidationError } from '@shared/AppError'
import { AudioEffect } from '@domain/job/ProcessingJob'
import type { IFileStorage } from '@application/storage/IFileStorage'
import type { UploadAudioUseCase } from '@application/audio/UploadAudioUseCase'
import type { GetAudioStatusUseCase } from '@application/audio/GetAudioStatusUseCase'
import type { DownloadAudioUseCase } from '@application/audio/DownloadAudioUseCase'

const effectSchema = z.object({
  effect: z.nativeEnum(AudioEffect, { message: 'invalid audio effect' }),
})

export class AudioController {
  constructor(
    private readonly uploadAudio: UploadAudioUseCase,
    private readonly getAudioStatus: GetAudioStatusUseCase,
    private readonly downloadAudio: DownloadAudioUseCase,
    private readonly fileStorage: IFileStorage,
  ) {}

  upload = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.file) {
      next(new ValidationError('file is required'))
      return
    }

    const parsed = effectSchema.safeParse(req.body)
    if (!parsed.success) {
      this.cleanupTempFile(req.file.path)
      next(new ValidationError(parsed.error.issues[0].message))
      return
    }

    // Stream from temp file to MinIO (no full buffer in RAM)
    const ext = path.extname(req.file.originalname)
    const storageKey = `originals/${randomUUID()}${ext}`
    const stream = fs.createReadStream(req.file.path)

    const uploadResult = await this.fileStorage.upload(storageKey, stream, req.file.mimetype, req.file.size)
    this.cleanupTempFile(req.file.path)

    if (uploadResult.isErr()) {
      next(uploadResult.error)
      return
    }

    const result = await this.uploadAudio.execute({
      filename:    req.file.originalname,
      mimeType:    req.file.mimetype,
      sizeInBytes: req.file.size,
      effect:      parsed.data.effect,
      filePath:    storageKey,
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
    const result = await this.downloadAudio.execute({
      audioTrackId: req.params.id,
    })

    if (result.isErr()) {
      next(result.error)
      return
    }

    const { filePath, filename, mimeType } = result.value

    const streamResult = await this.fileStorage.download(filePath)
    if (streamResult.isErr()) {
      next(streamResult.error)
      return
    }

    res.setHeader('Content-Disposition', `attachment; filename="processed_${filename}"`)
    res.setHeader('Content-Type', mimeType)
    streamResult.value.pipe(res)
  }

  private cleanupTempFile(filePath: string): void {
    fs.unlink(filePath, () => {}) // fire-and-forget, non-blocking
  }
}
