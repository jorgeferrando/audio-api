import os from 'os'
import multer from 'multer'
import path from 'path'
import { randomUUID } from 'crypto'

const VALID_MIME_TYPES = new Set([
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/flac',
  'audio/aac',
  'audio/webm',
])

/**
 * Multer configured with diskStorage to a temp directory.
 *
 * Files land in os.tmpdir() (not in RAM), then get streamed to MinIO
 * by the controller. This avoids holding 50MB buffers in memory per request.
 * The temp file is cleaned up after upload to MinIO completes.
 */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, os.tmpdir()),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `upload-${randomUUID()}${ext}`)
  },
})

export const uploadMiddleware = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    if (VALID_MIME_TYPES.has(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error(`Invalid audio type: ${file.mimetype}`))
    }
  },
}).single('file')
