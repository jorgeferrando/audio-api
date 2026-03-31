import { type Result } from '@shared/Result'
import type { AppError } from '@shared/AppError'
import type { AudioEffect } from '@domain/job/ProcessingJob'

export interface AudioProcessingResult {
  processedFilePath: string
  durationSeconds: number
}

/**
 * Port: abstracts the audio processing engine.
 *
 * The implementation (FfmpegAudioProcessor) lives in infrastructure/.
 * The use case depends only on this interface — swappable for tests or
 * for a different processing backend (e.g. a cloud-based service).
 */
export interface IAudioProcessor {
  applyEffect(
    inputPath: string,
    outputPath: string,
    effect: AudioEffect,
  ): Promise<Result<AudioProcessingResult, AppError>>
}
