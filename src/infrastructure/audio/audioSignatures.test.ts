import { describe, it, expect } from 'vitest'
import { detectAudioFormat } from './audioSignatures'

describe('detectAudioFormat', () => {
  it('detects WAV (RIFF + WAVE)', () => {
    // RIFF....WAVE
    const buf = Buffer.alloc(12)
    buf.write('RIFF', 0)
    buf.writeUInt32LE(1000, 4)
    buf.write('WAVE', 8)
    expect(detectAudioFormat(buf)).toBe('wav')
  })

  it('detects MP3 with ID3v2 tag', () => {
    const buf = Buffer.from('ID3\x04\x00\x00\x00\x00\x00\x00\x00\x00', 'binary')
    expect(detectAudioFormat(buf)).toBe('mp3')
  })

  it('detects MP3 with MPEG frame sync (0xFF 0xFB)', () => {
    const buf = Buffer.from([0xFF, 0xFB, 0x90, 0x00])
    expect(detectAudioFormat(buf)).toBe('mp3')
  })

  it('detects MP3 with MPEG frame sync (0xFF 0xF3)', () => {
    const buf = Buffer.from([0xFF, 0xF3, 0x90, 0x00])
    expect(detectAudioFormat(buf)).toBe('mp3')
  })

  it('detects MP3 with MPEG frame sync (0xFF 0xF2)', () => {
    const buf = Buffer.from([0xFF, 0xF2, 0x90, 0x00])
    expect(detectAudioFormat(buf)).toBe('mp3')
  })

  it('detects OGG (OggS)', () => {
    const buf = Buffer.from('OggS\x00\x02\x00\x00\x00\x00\x00\x00', 'binary')
    expect(detectAudioFormat(buf)).toBe('ogg')
  })

  it('detects FLAC (fLaC)', () => {
    const buf = Buffer.from('fLaC\x00\x00\x00\x22\x00\x00\x00\x00', 'binary')
    expect(detectAudioFormat(buf)).toBe('flac')
  })

  it('detects AAC with ADTS header (0xFF 0xF1)', () => {
    const buf = Buffer.from([0xFF, 0xF1, 0x50, 0x80])
    expect(detectAudioFormat(buf)).toBe('aac')
  })

  it('detects AAC with ADTS header (0xFF 0xF9)', () => {
    const buf = Buffer.from([0xFF, 0xF9, 0x50, 0x80])
    expect(detectAudioFormat(buf)).toBe('aac')
  })

  it('detects WebM/Matroska (EBML header)', () => {
    const buf = Buffer.from([0x1A, 0x45, 0xDF, 0xA3, 0x01, 0x00, 0x00, 0x00])
    expect(detectAudioFormat(buf)).toBe('webm')
  })

  it('returns null for PDF', () => {
    const buf = Buffer.from('%PDF-1.4\x00\x00\x00\x00', 'binary')
    expect(detectAudioFormat(buf)).toBeNull()
  })

  it('returns null for plain text', () => {
    const buf = Buffer.from('Hello world!')
    expect(detectAudioFormat(buf)).toBeNull()
  })

  it('returns null for empty buffer', () => {
    expect(detectAudioFormat(Buffer.alloc(0))).toBeNull()
  })

  it('returns null for buffer too short to match any signature', () => {
    expect(detectAudioFormat(Buffer.from([0xFF]))).toBeNull()
  })
})
