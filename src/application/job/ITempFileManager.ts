import type { Readable } from 'stream'
import type { Result } from '@shared/Result'
import type { AppError } from '@shared/AppError'

export interface TempFilePaths {
  inputPath: string
  outputPath: string
}

/**
 * Port for temp file operations used during audio processing.
 *
 * Isolates filesystem concerns from the application layer so
 * ProcessJobUseCase does not import fs/os/path directly.
 */
export interface ITempFileManager {
  createTempPaths(extension: string): TempFilePaths
  writeStream(filePath: string, stream: Readable): Promise<Result<void, AppError>>
  getFileSize(filePath: string): Promise<Result<number, AppError>>
  createReadStream(filePath: string): Readable
  cleanup(paths: string[]): void
}
