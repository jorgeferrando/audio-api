import fs from 'fs'
import { stat } from 'fs/promises'
import os from 'os'
import path from 'path'
import { randomUUID } from 'crypto'
import { pipeline } from 'stream/promises'
import type { Readable } from 'stream'
import { ok, err, type Result } from '@shared/Result'
import { AppError } from '@shared/AppError'
import type { ITempFileManager, TempFilePaths } from '@application/job/ITempFileManager'

/**
 * ITempFileManager implementation backed by the local filesystem.
 *
 * Creates temp files in the OS temp directory with random UUIDs.
 * Cleanup is fire-and-forget — these are ephemeral files that the OS
 * will eventually reclaim if cleanup fails.
 */
export class NodeTempFileManager implements ITempFileManager {
  createTempPaths(extension: string): TempFilePaths {
    const dir = os.tmpdir()
    return {
      inputPath:  path.join(dir, `${randomUUID()}${extension}`),
      outputPath: path.join(dir, `${randomUUID()}_processed${extension}`),
    }
  }

  async writeStream(filePath: string, stream: Readable): Promise<Result<void, AppError>> {
    try {
      await pipeline(stream, fs.createWriteStream(filePath))
      return ok(undefined)
    } catch (e) {
      return err(new AppError(`Failed to write stream to ${filePath}: ${(e as Error).message}`, 'STORAGE_ERROR'))
    }
  }

  async getFileSize(filePath: string): Promise<Result<number, AppError>> {
    try {
      const { size } = await stat(filePath)
      return ok(size)
    } catch (e) {
      return err(new AppError(`Failed to stat ${filePath}: ${(e as Error).message}`, 'STORAGE_ERROR'))
    }
  }

  createReadStream(filePath: string): Readable {
    return fs.createReadStream(filePath)
  }

  cleanup(paths: string[]): void {
    for (const f of paths) {
      fs.unlink(f, () => {}) // fire-and-forget
    }
  }
}
