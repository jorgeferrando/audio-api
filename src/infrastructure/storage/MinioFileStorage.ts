import type { Readable } from 'stream'
import type { Client } from 'minio'
import { ok, err, type Result } from '@shared/Result'
import { StorageError } from '@shared/AppError'
import type { ILogger } from '@shared/ILogger'
import type { IFileStorage } from '@application/storage/IFileStorage'

export class MinioFileStorage implements IFileStorage {
  constructor(
    private readonly client: Client,
    private readonly bucket: string,
    private readonly logger: ILogger,
  ) {}

  async upload(key: string, content: Buffer | Readable, contentType: string, size?: number): Promise<Result<void, StorageError>> {
    try {
      const len = Buffer.isBuffer(content) ? content.length : size
      await this.client.putObject(this.bucket, key, content, len, { 'Content-Type': contentType })
      return ok(undefined)
    } catch (e) {
      this.logger.error('MinioFileStorage.upload failed', { error: e, key })
      return err(new StorageError('Failed to upload file'))
    }
  }

  async download(key: string): Promise<Result<Readable, StorageError>> {
    try {
      const stream = await this.client.getObject(this.bucket, key)
      return ok(stream)
    } catch (e) {
      this.logger.error('MinioFileStorage.download failed', { error: e, key })
      return err(new StorageError('Failed to download file'))
    }
  }

  async delete(key: string): Promise<Result<void, StorageError>> {
    try {
      await this.client.removeObject(this.bucket, key)
      return ok(undefined)
    } catch (e) {
      this.logger.error('MinioFileStorage.delete failed', { error: e, key })
      return err(new StorageError('Failed to delete file'))
    }
  }
}
