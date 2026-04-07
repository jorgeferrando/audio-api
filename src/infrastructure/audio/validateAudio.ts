import { detectAudioFormat } from './audioSignatures'

/**
 * Validates that a buffer contains magic bytes of a known audio format.
 * Designed to be called with the first 12+ bytes of a file for early
 * rejection without reading the entire file or spawning ffprobe.
 */
export function validateAudioContent(header: Buffer): boolean {
  return detectAudioFormat(header) !== null
}
