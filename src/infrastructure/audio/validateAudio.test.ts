import { describe, it, expect } from 'vitest'
import { validateAudioContent } from './validateAudio'

describe('validateAudioContent', () => {
  it('returns true for a valid WAV header', () => {
    const buf = Buffer.alloc(12)
    buf.write('RIFF', 0)
    buf.writeUInt32LE(1000, 4)
    buf.write('WAVE', 8)
    expect(validateAudioContent(buf)).toBe(true)
  })

  it('returns true for MP3 with ID3 tag', () => {
    const buf = Buffer.from('ID3\x04\x00\x00', 'binary')
    expect(validateAudioContent(buf)).toBe(true)
  })

  it('returns true for OGG', () => {
    const buf = Buffer.from('OggS\x00\x02\x00\x00', 'binary')
    expect(validateAudioContent(buf)).toBe(true)
  })

  it('returns false for a PDF', () => {
    const buf = Buffer.from('%PDF-1.4', 'ascii')
    expect(validateAudioContent(buf)).toBe(false)
  })

  it('returns false for an empty buffer', () => {
    expect(validateAudioContent(Buffer.alloc(0))).toBe(false)
  })
})
