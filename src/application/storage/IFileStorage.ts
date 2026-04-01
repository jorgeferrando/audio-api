import { type Readable } from 'stream'
import { type Result } from '@shared/Result'
import type { StorageError } from '@shared/AppError'

/**
 * Port: abstracts file storage (local disk, MinIO, S3, GCS).
 *
 * Keys are opaque strings like 'originals/uuid.mp3' — the implementation
 * decides how to map them to physical storage (bucket + object key, directory
 * + filename, etc.). The domain and application layers never know where files
 * physically live.
 */
export interface IFileStorage {
  upload(key: string, content: Buffer, contentType: string): Promise<Result<void, StorageError>>
  download(key: string): Promise<Result<Readable, StorageError>>
  delete(key: string): Promise<Result<void, StorageError>>
}
