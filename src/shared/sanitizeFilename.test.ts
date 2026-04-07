import { describe, it, expect } from 'vitest'
import { sanitizeFilename } from './sanitizeFilename'

describe('sanitizeFilename', () => {
  it('keeps normal ASCII filenames unchanged', () => {
    expect(sanitizeFilename('song.mp3')).toBe('song.mp3')
  })

  it('strips newlines and carriage returns', () => {
    expect(sanitizeFilename('file\nwith\rnewlines.mp3')).toBe('filewithnewlines.mp3')
  })

  it('replaces quotes with underscore', () => {
    expect(sanitizeFilename('file"with"quotes.mp3')).toBe('file_with_quotes.mp3')
  })

  it('replaces backslashes with underscore', () => {
    expect(sanitizeFilename('file\\path.mp3')).toBe('file_path.mp3')
  })

  it('strips non-ASCII characters', () => {
    expect(sanitizeFilename('archivo.mp3')).toBe('archivo.mp3')
    expect(sanitizeFilename('\u6587\u4EF6.mp3')).toBe('.mp3')
  })

  it('returns "download" for an empty string', () => {
    expect(sanitizeFilename('')).toBe('download')
  })

  it('returns "download" when only control chars remain', () => {
    expect(sanitizeFilename('\x00\x01\x02')).toBe('download')
  })
})
