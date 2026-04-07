import { type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { StatusCodes } from 'http-status-codes'
import { ValidationError } from '@shared/AppError'
import { isValidUUID } from '@shared/isValidUUID'
import { sanitizeFilename } from '@shared/sanitizeFilename'
import { AudioEffect } from '@domain/job/ProcessingJob'
import { AudioTrackStatus } from '@domain/audio/AudioTrack'
import type { IFileStorage } from '@application/storage/IFileStorage'
import type { UploadAudioUseCase } from '@application/audio/UploadAudioUseCase'
import type { GetAudioStatusUseCase } from '@application/audio/GetAudioStatusUseCase'
import type { DownloadAudioUseCase } from '@application/audio/DownloadAudioUseCase'
import type { ListAudioTracksUseCase } from '@application/audio/ListAudioTracksUseCase'
import type { DeleteAudioUseCase } from '@application/audio/DeleteAudioUseCase'

const effectSchema = z.object({
  effect: z.nativeEnum(AudioEffect, { message: 'invalid audio effect' }),
})

const SSE_POLL_INTERVAL_MS = 2000
const SSE_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes max

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
    if (!isValidUUID(req.params.id)) {
      next(new ValidationError('invalid audio track id format'))
      return
    }

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
    if (!isValidUUID(req.params.id)) {
      next(new ValidationError('invalid audio track id format'))
      return
    }

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

    const safe = sanitizeFilename(filename)
    res.setHeader('Content-Disposition', `attachment; filename="processed_${safe}"`)
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
    if (!isValidUUID(req.params.id)) {
      next(new ValidationError('invalid audio track id format'))
      return
    }

    const result = await this.deleteAudio.execute({
      audioTrackId: req.params.id,
    })

    if (result.isErr()) {
      next(result.error)
      return
    }

    res.status(StatusCodes.NO_CONTENT).end()
  }

  /**
   * SSE endpoint — streams real-time status updates for an audio track.
   *
   * Polls the database every 2 seconds and sends an event when the status
   * changes. Closes the connection when a terminal state is reached
   * (READY or FAILED) or after 5 minutes.
   */
  streamStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!isValidUUID(req.params.id)) {
      next(new ValidationError('invalid audio track id format'))
      return
    }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders()

    const audioTrackId = req.params.id
    let lastStatus: string | null = null
    let closed = false
    let intervalId: ReturnType<typeof setInterval>
    let timeoutId: ReturnType<typeof setTimeout>

    const cleanup = () => {
      closed = true
      clearInterval(intervalId)
      clearTimeout(timeoutId)
    }

    req.on('close', cleanup)

    const poll = async () => {
      if (closed) return

      const result = await this.getAudioStatus.execute({ audioTrackId })

      if (result.isErr()) {
        res.write(`data: ${JSON.stringify({ error: result.error.message })}\n\n`)
        cleanup()
        res.end()
        return
      }

      const dto = result.value
      if (dto.status !== lastStatus) {
        lastStatus = dto.status
        res.write(`data: ${JSON.stringify(dto)}\n\n`)
      }

      if (lastStatus === AudioTrackStatus.READY || lastStatus === AudioTrackStatus.FAILED) {
        cleanup()
        res.end()
      }
    }

    await poll()
    if (closed) return

    intervalId = setInterval(poll, SSE_POLL_INTERVAL_MS)
    timeoutId = setTimeout(() => { cleanup(); res.end() }, SSE_TIMEOUT_MS)
  }
}
