import ffmpeg from 'fluent-ffmpeg'

/**
 * Validates that a file contains real audio data using ffprobe.
 * Returns true if ffprobe can detect an audio stream, false otherwise.
 *
 * Accepts a file path (not a buffer) to avoid loading the file into memory.
 */
export function validateAudioContent(filePath: string): Promise<boolean> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) { resolve(false); return }
      const hasAudio = metadata.streams?.some(s => s.codec_type === 'audio') ?? false
      resolve(hasAudio)
    })
  })
}
