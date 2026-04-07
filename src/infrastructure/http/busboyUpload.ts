import { type Readable, PassThrough } from 'stream'
import Busboy from 'busboy'
import { randomUUID } from 'crypto'
import path from 'path'
import type { Request, Response, NextFunction } from 'express'
import { validateAudioContent } from '@infrastructure/audio/validateAudio'

const VALID_MIME_TYPES = new Set([
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/flac',
  'audio/aac',
  'audio/webm',
])

/** Minimum bytes needed to detect all supported audio signatures. */
const MAGIC_BYTES_LENGTH = 12

export const UPLOAD_LIMITS = {
  maxFileSize: 50 * 1024 * 1024, // 50MB
} as const

export interface UploadedFile {
  stream: Readable
  filename: string
  mimeType: string
  size: number
  storageKey: string
}

// Type augmentation handled in src/types/express.d.ts

interface BusboyUploadOptions {
  maxFileSize?: number
}

/**
 * Busboy-based multipart upload middleware.
 *
 * Replaces multer to enable:
 *   1. Streaming — file bytes flow directly to the consumer (MinIO), no temp file on disk.
 *   2. Early fail — first 12 bytes are checked against audio magic bytes before accepting the rest.
 *   3. MIME type validation as defense in depth.
 *
 * Populates `req.uploadedFile` with a Readable stream + metadata if valid.
 * Populates `req.body` with non-file form fields.
 */
export function busboyUpload(options?: BusboyUploadOptions) {
  const maxFileSize = options?.maxFileSize ?? UPLOAD_LIMITS.maxFileSize

  return (req: Request, res: Response, next: NextFunction): void => {
    const contentType = req.headers['content-type']
    if (!contentType?.includes('multipart/form-data')) {
      next()
      return
    }

    let responded = false

    const bb = Busboy({
      headers: req.headers as Record<string, string>,
      limits: { fileSize: maxFileSize, files: 1 },
    })

    function reject(status: number, error: string, message: string): void {
      if (responded) return
      responded = true
      res.status(status).json({ error, message })
    }

    bb.on('field', (name, value) => {
      req.body ??= {}
      req.body[name] = value
    })

    bb.on('file', (_fieldname, fileStream, info) => {
      const { filename, mimeType } = info

      // Defense in depth: reject non-audio MIME types
      if (!VALID_MIME_TYPES.has(mimeType)) {
        fileStream.resume() // drain the stream
        reject(400, 'VALIDATION_ERROR', `Invalid audio type: ${mimeType}`)
        return
      }

      // Collect first N bytes for magic bytes validation
      const headerChunks: Buffer[] = []
      let headerBytesRead = 0
      let validated = false
      let truncated = false

      const output = new PassThrough()

      fileStream.on('data', (chunk: Buffer) => {
        if (truncated || responded) return

        if (!validated) {
          headerChunks.push(chunk)
          headerBytesRead += chunk.length

          if (headerBytesRead >= MAGIC_BYTES_LENGTH) {
            validated = true
            const header = Buffer.concat(headerChunks)

            if (!validateAudioContent(header)) {
              fileStream.resume()
              reject(400, 'VALIDATION_ERROR', 'file does not contain valid audio data')
              output.destroy()
              return
            }

            // Valid — push collected header bytes + continue piping
            const ext = path.extname(filename)
            const storageKey = `originals/${randomUUID()}${ext}`

            req.uploadedFile = {
              stream: output,
              filename,
              mimeType,
              size: Number(req.headers['content-length'] ?? 0),
              storageKey,
            }

            output.write(header)
          }
        } else {
          output.write(chunk)
        }
      })

      fileStream.on('limit', () => {
        truncated = true
        fileStream.resume()
        output.destroy()
        reject(400, 'UPLOAD_ERROR', 'File exceeds the maximum allowed size of 50MB')
      })

      fileStream.on('end', () => {
        if (responded || truncated) return

        // Handle small files where we didn't reach MAGIC_BYTES_LENGTH
        if (!validated && headerBytesRead > 0) {
          const header = Buffer.concat(headerChunks)
          if (!validateAudioContent(header)) {
            reject(400, 'VALIDATION_ERROR', 'file does not contain valid audio data')
            output.destroy()
            return
          }

          validated = true
          const ext = path.extname(filename)
          const storageKey = `originals/${randomUUID()}${ext}`

          req.uploadedFile = {
            stream: output,
            filename,
            mimeType,
            size: Number(req.headers['content-length'] ?? 0),
            storageKey,
          }

          output.write(header)
        }

        output.end()
      })

      fileStream.on('error', () => {
        output.destroy()
      })
    })

    bb.on('close', () => {
      if (!responded) next()
    })

    bb.on('error', (err: Error) => {
      reject(500, 'UPLOAD_ERROR', err.message)
    })

    req.pipe(bb)
  }
}
