import type { UploadedFile } from '@infrastructure/http/busboyUpload'

declare global {
  namespace Express {
    interface Request {
      uploadedFile?: UploadedFile
    }
  }
}
