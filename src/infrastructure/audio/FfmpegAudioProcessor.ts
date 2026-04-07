import { execFile } from 'child_process'
import { ok, err, type Result } from '@shared/Result'
import { AppError } from '@shared/AppError'
import type { ILogger } from '@shared/ILogger'
import { AudioEffect } from '@domain/job/ProcessingJob'
import type { IAudioProcessor, AudioProcessingResult } from '@application/job/IAudioProcessor'

/**
 * Maps each AudioEffect to an ffmpeg audio filter string.
 * These are real ffmpeg filters — they produce audible changes.
 */
const EFFECT_FILTERS: Record<AudioEffect, string> = {
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
 * Replaces fluent-ffmpeg (unmaintained) with the same underlying
 * mechanism — spawning the ffmpeg binary. The IAudioProcessor port
 * isolates this implementation from the rest of the codebase.
 */
export class FfmpegAudioProcessor implements IAudioProcessor {
  constructor(private readonly logger: ILogger) {}

  applyEffect(
    inputPath: string,
    outputPath: string,
    effect: AudioEffect,
  ): Promise<Result<AudioProcessingResult, AppError>> {
    const filter = EFFECT_FILTERS[effect]

    return new Promise((resolve) => {
      const args = ['-i', inputPath, '-af', filter, '-y', outputPath]

      execFile('ffmpeg', args, (ffmpegErr) => {
        if (ffmpegErr) {
          this.logger.error('FfmpegAudioProcessor: ffmpeg failed', { error: ffmpegErr, inputPath, effect })
          resolve(err(new AppError(`Audio processing failed: ${ffmpegErr.message}`, 'PROCESSING_ERROR')))
          return
        }

        // Get duration of the processed file with ffprobe
        const probeArgs = [
          '-v', 'error',
          '-show_entries', 'format=duration',
          '-of', 'json',
          outputPath,
        ]

        execFile('ffprobe', probeArgs, (probeErr, stdout) => {
          if (probeErr) {
            this.logger.error('FfmpegAudioProcessor: ffprobe failed', { error: probeErr })
            resolve(err(new AppError('Failed to read processed audio metadata', 'PROCESSING_ERROR')))
            return
          }

          let durationSeconds = 0
          try {
            const parsed = JSON.parse(stdout) as { format?: { duration?: string } }
            durationSeconds = Math.round(Number(parsed.format?.duration ?? 0) * 10) / 10
          } catch {
            this.logger.error('FfmpegAudioProcessor: failed to parse ffprobe output', { stdout })
            resolve(err(new AppError('Failed to parse processed audio metadata', 'PROCESSING_ERROR')))
            return
          }

          this.logger.info('FfmpegAudioProcessor: processing complete', {
            inputPath, outputPath, effect, durationSeconds,
          })

          resolve(ok({ processedFilePath: outputPath, durationSeconds }))
        })
      })
    })
  }
}
