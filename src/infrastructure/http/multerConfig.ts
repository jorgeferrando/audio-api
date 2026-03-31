import multer from 'multer'
import path from 'path'
import { randomUUID } from 'crypto'

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads', 'originals')

const VALID_MIME_TYPES = new Set([
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/flac',
  'audio/aac',
  'audio/webm',
])

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `${randomUUID()}${ext}`)
  },
})

export const uploadMiddleware = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB — matches domain's MAX_SIZE_BYTES
  fileFilter: (_req, file, cb) => {
    if (VALID_MIME_TYPES.has(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error(`Invalid audio type: ${file.mimetype}`))
    }
  },
}).single('file')
