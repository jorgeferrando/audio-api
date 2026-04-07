export type AudioFormat = 'wav' | 'mp3' | 'ogg' | 'flac' | 'aac' | 'webm'

/**
 * Detects audio format from the first bytes of a file (magic bytes).
 * Returns the format string or null if unrecognized.
 *
 * Requires at least 12 bytes for WAV detection (RIFF + WAVE at offset 8).
 * Other formats need 2-4 bytes.
 */
export function detectAudioFormat(header: Buffer): AudioFormat | null {
  if (header.length < 2) return null

  // WAV: RIFF (0-3) + WAVE (8-11)
  if (
    header.length >= 12 &&
    header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46 && // RIFF
    header[8] === 0x57 && header[9] === 0x41 && header[10] === 0x56 && header[11] === 0x45   // WAVE
  ) return 'wav'

  // MP3: ID3v2 tag
  if (header[0] === 0x49 && header[1] === 0x44 && header.length >= 3 && header[2] === 0x33) return 'mp3'

  // OGG: OggS
  if (
    header.length >= 4 &&
    header[0] === 0x4F && header[1] === 0x67 && header[2] === 0x67 && header[3] === 0x53
  ) return 'ogg'

  // FLAC: fLaC
  if (
    header.length >= 4 &&
    header[0] === 0x66 && header[1] === 0x4C && header[2] === 0x61 && header[3] === 0x43
  ) return 'flac'

  // WebM/Matroska: EBML header (1A 45 DF A3)
  if (
    header.length >= 4 &&
    header[0] === 0x1A && header[1] === 0x45 && header[2] === 0xDF && header[3] === 0xA3
  ) return 'webm'

  // AAC ADTS: 0xFFF1 or 0xFFF9 (12-bit sync word 0xFFF + ID bit)
  if (header[0] === 0xFF && (header[1] === 0xF1 || header[1] === 0xF9)) return 'aac'

  // MP3 MPEG frame sync: 0xFF + 0xFB/0xF3/0xF2
  if (header[0] === 0xFF && (header[1] === 0xFB || header[1] === 0xF3 || header[1] === 0xF2)) return 'mp3'

  return null
}
