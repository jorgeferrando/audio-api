import { execFile as execFileCb } from 'child_process'
import { promisify } from 'util'
import { unlink } from 'fs/promises'
import { ok, err, type Result } from '@shared/Result'
import { AppError } from '@shared/AppError'
import type { ILogger } from '@shared/ILogger'
import { AudioEffect } from '@domain/job/ProcessingJob'
import type { IAudioProcessor, AudioProcessingResult } from '@application/job/IAudioProcessor'

const execFileAsync = promisify(execFileCb)

/** Timeout for each ffmpeg/ffprobe invocation (60 seconds). */
const PROCESS_TIMEOUT_MS = 60_000

/**
 * Maps each AudioEffect to an ffmpeg audio filter string.
 * These are real ffmpeg filters — they produce audible changes.
 */
export const EFFECT_FILTERS: Record<AudioEffect, string> = {
  [AudioEffect.NORMALIZE]:       'loudnorm',
  [AudioEffect.REVERB]:          'aecho=0.8:0.9:1000:0.3',
  [AudioEffect.ECHO]:            'aecho=0.8:0.88:60:0.4',
  [AudioEffect.PITCH_SHIFT]:     'asetrate=44100*1.25,aresample=44100',
  [AudioEffect.NOISE_REDUCTION]: 'afftdn=nf=-25',
}

/**
 * Audio processor that calls the ffmpeg/ffprobe binaries directly
 * via child_process.execFile.
 *
 * Each invocation has a timeout to prevent the worker from blocking
 * indefinitely if ffmpeg hangs. On failure the output file is cleaned
 * up to avoid orphaned temp files.
 */
export class FfmpegAudioProcessor implements IAudioProcessor {
  constructor(private readonly logger: ILogger) {}

  async applyEffect(
    inputPath: string,
    outputPath: string,
    effect: AudioEffect,
  ): Promise<Result<AudioProcessingResult, AppError>> {
    const filter = EFFECT_FILTERS[effect]

    // ── Apply effect with ffmpeg ──────────────────────────────────────────
    try {
      await execFileAsync('ffmpeg', ['-i', inputPath, '-af', filter, '-y', outputPath], {
        timeout: PROCESS_TIMEOUT_MS,
      })
    } catch (e) {
      this.logger.error('FfmpegAudioProcessor: ffmpeg failed', { error: e, inputPath, effect })
      await this.tryUnlink(outputPath)
      return err(new AppError(`Audio processing failed: ${(e as Error).message}`, 'PROCESSING_ERROR'))
    }

    // ── Read duration with ffprobe ────────────────────────────────────────
    try {
      const { stdout } = await execFileAsync(
        'ffprobe',
        ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', outputPath],
        { timeout: PROCESS_TIMEOUT_MS },
      )

      const parsed = JSON.parse(stdout) as { format?: { duration?: string } }
      const durationSeconds = Math.round(Number(parsed.format?.duration ?? 0) * 10) / 10

      this.logger.info('FfmpegAudioProcessor: processing complete', {
        inputPath, outputPath, effect, durationSeconds,
      })

      return ok({ processedFilePath: outputPath, durationSeconds })
    } catch (e) {
      this.logger.error('FfmpegAudioProcessor: ffprobe failed', { error: e })
      return err(new AppError('Failed to read processed audio metadata', 'PROCESSING_ERROR'))
    }
  }

  private async tryUnlink(filePath: string): Promise<void> {
    try { await unlink(filePath) } catch { /* file may not exist yet */ }
  }
}
