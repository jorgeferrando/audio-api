import { type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { StatusCodes } from 'http-status-codes'
import { ValidationError } from '@shared/AppError'
import { AudioEffect } from '@domain/job/ProcessingJob'
import type { IFileStorage } from '@application/storage/IFileStorage'
import type { UploadAudioUseCase } from '@application/audio/UploadAudioUseCase'
import type { GetAudioStatusUseCase } from '@application/audio/GetAudioStatusUseCase'
import type { DownloadAudioUseCase } from '@application/audio/DownloadAudioUseCase'
import type { ListAudioTracksUseCase } from '@application/audio/ListAudioTracksUseCase'
import type { DeleteAudioUseCase } from '@application/audio/DeleteAudioUseCase'

const effectSchema = z.object({
  effect: z.nativeEnum(AudioEffect, { message: 'invalid audio effect' }),
})

export class AudioController {
  constructor(
    private readonly uploadAudio: UploadAudioUseCase,
    private readonly getAudioStatus: GetAudioStatusUseCase,
    private readonly downloadAudio: DownloadAudioUseCase,
    private readonly listAudioTracks: ListAudioTracksUseCase,
    private readonly deleteAudio: DeleteAudioUseCase,
    private readonly fileStorage: IFileStorage,
  ) {}

  upload = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.uploadedFile) {
      next(new ValidationError('file is required'))
      return
    }

    const parsed = effectSchema.safeParse(req.body)
    if (!parsed.success) {
      req.uploadedFile.stream.destroy()
      next(new ValidationError(parsed.error.issues[0].message))
      return
    }

    const { stream, filename, mimeType, size, storageKey } = req.uploadedFile

    const uploadResult = await this.fileStorage.upload(storageKey, stream, mimeType, size)
    if (uploadResult.isErr()) {
      next(uploadResult.error)
      return
    }

    const result = await this.uploadAudio.execute({
      filename,
      mimeType,
      sizeInBytes: size,
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

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const limit  = Number(req.query.limit)  || undefined
    const offset = Number(req.query.offset) || undefined

    const result = await this.listAudioTracks.execute({ limit, offset })

    if (result.isErr()) {
      next(result.error)
      return
    }

    res.status(StatusCodes.OK).json(result.value)
  }

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deleteAudio.execute({
      audioTrackId: req.params.id,
    })

    if (result.isErr()) {
      next(result.error)
      return
    }

    res.status(StatusCodes.NO_CONTENT).end()
  }
}
