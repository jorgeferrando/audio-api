import ffmpeg from 'fluent-ffmpeg'
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

export class FfmpegAudioProcessor implements IAudioProcessor {
  constructor(private readonly logger: ILogger) {}

  applyEffect(
    inputPath: string,
    outputPath: string,
    effect: AudioEffect,
  ): Promise<Result<AudioProcessingResult, AppError>> {
    const filter = EFFECT_FILTERS[effect]

    return new Promise((resolve) => {
      ffmpeg(inputPath)
        .audioFilter(filter)
        .output(outputPath)
        .on('end', () => {
          // Get duration of the processed file with ffprobe
          ffmpeg.ffprobe(outputPath, (probeErr, metadata) => {
            if (probeErr) {
              this.logger.error('FfmpegAudioProcessor: ffprobe failed', { error: probeErr })
              resolve(err(new AppError('Failed to read processed audio metadata', 'PROCESSING_ERROR')))
              return
            }

            const durationSeconds = Math.round((metadata.format.duration ?? 0) * 10) / 10

            this.logger.info('FfmpegAudioProcessor: processing complete', {
              inputPath,
              outputPath,
              effect,
              durationSeconds,
            })

            resolve(ok({ processedFilePath: outputPath, durationSeconds }))
          })
        })
        .on('error', (e: Error) => {
          this.logger.error('FfmpegAudioProcessor: ffmpeg failed', { error: e, inputPath, effect })
          resolve(err(new AppError(`Audio processing failed: ${e.message}`, 'PROCESSING_ERROR')))
        })
        .run()
    })
  }
}
