import { describe, it, expect } from 'vitest'
import { AudioTrack, AudioTrackStatus } from './AudioTrack'
import { ValidationError } from '@shared/AppError'

const validProps = {
  filename: 'track.mp3',
  mimeType: 'audio/mpeg',
  sizeInBytes: 1024 * 1024, // 1MB
}

describe('AudioTrack.create', () => {
  it('creates a valid audio track', () => {
    const result = AudioTrack.create(validProps)
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.filename).toBe('track.mp3')
      expect(result.value.mimeType).toBe('audio/mpeg')
      expect(result.value.sizeInBytes).toBe(1024 * 1024)
      expect(result.value.status).toBe(AudioTrackStatus.PENDING)
      expect(result.value.id).toBeDefined()
      expect(result.value.createdAt).toBeInstanceOf(Date)
    }
  })

  it('rejects empty filename', () => {
    const result = AudioTrack.create({ ...validProps, filename: '' })
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(ValidationError)
      expect(result.error.message).toContain('filename')
    }
  })

  it('rejects invalid mime type', () => {
    const result = AudioTrack.create({ ...validProps, mimeType: 'image/png' })
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(ValidationError)
      expect(result.error.message).toContain('mimeType')
    }
  })

  it('rejects size equal to zero', () => {
    const result = AudioTrack.create({ ...validProps, sizeInBytes: 0 })
    expect(result.isErr()).toBe(true)
  })

  it('rejects size exceeding 50MB', () => {
    const result = AudioTrack.create({ ...validProps, sizeInBytes: 51 * 1024 * 1024 })
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.message).toContain('50MB')
    }
  })

  it('accepts all valid audio mime types', () => {
    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/aac', 'audio/webm']
    for (const mimeType of validTypes) {
      expect(AudioTrack.create({ ...validProps, mimeType }).isOk()).toBe(true)
    }
  })
})

describe('AudioTrack status transitions', () => {
  it('transitions from PENDING to PROCESSING', () => {
    const track = AudioTrack.create(validProps)
    if (!track.isOk()) throw new Error('setup failed')

    const result = track.value.markAsProcessing()
    expect(result.isOk()).toBe(true)
    expect(track.value.status).toBe(AudioTrackStatus.PROCESSING)
  })

  it('transitions from PROCESSING to READY with duration', () => {
    const track = AudioTrack.create(validProps)
    if (!track.isOk()) throw new Error('setup failed')

    track.value.markAsProcessing()
    const result = track.value.markAsReady(120.5)

    expect(result.isOk()).toBe(true)
    expect(track.value.status).toBe(AudioTrackStatus.READY)
    expect(track.value.durationSeconds).toBe(120.5)
  })

  it('transitions from PROCESSING to FAILED', () => {
    const track = AudioTrack.create(validProps)
    if (!track.isOk()) throw new Error('setup failed')

    track.value.markAsProcessing()
    const result = track.value.markAsFailed()

    expect(result.isOk()).toBe(true)
    expect(track.value.status).toBe(AudioTrackStatus.FAILED)
  })

  it('cannot mark as READY without going through PROCESSING first', () => {
    const track = AudioTrack.create(validProps)
    if (!track.isOk()) throw new Error('setup failed')

    const result = track.value.markAsReady(120)
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.message).toContain('PROCESSING')
    }
  })

  it('cannot mark as PROCESSING if already READY', () => {
    const track = AudioTrack.create(validProps)
    if (!track.isOk()) throw new Error('setup failed')

    track.value.markAsProcessing()
    track.value.markAsReady(120)

    const result = track.value.markAsProcessing()
    expect(result.isErr()).toBe(true)
  })
})
