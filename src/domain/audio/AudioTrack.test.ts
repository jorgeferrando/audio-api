import { describe, it, expect } from 'vitest'
import { AudioTrack, AudioTrackStatus, type AudioTrackPersistence } from './AudioTrack'
import { ValidationError } from '@shared/AppError'

const validProps = {
  filename: 'track.mp3',
  mimeType: 'audio/mpeg',
  sizeInBytes: 1024 * 1024, // 1MB
  filePath: '/uploads/originals/abc.mp3',
}

describe('AudioTrack.create', () => {
  it('creates a valid audio track with filePath', () => {
    const result = AudioTrack.create(validProps)
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.filename).toBe('track.mp3')
      expect(result.value.mimeType).toBe('audio/mpeg')
      expect(result.value.sizeInBytes).toBe(1024 * 1024)
      expect(result.value.filePath).toBe('/uploads/originals/abc.mp3')
      expect(result.value.processedFilePath).toBeUndefined()
      expect(result.value.status).toBe(AudioTrackStatus.PENDING)
      expect(result.value.id).toBeDefined()
      expect(result.value.createdAt).toBeInstanceOf(Date)
    }
  })

  it('rejects empty filePath', () => {
    const result = AudioTrack.create({ ...validProps, filePath: '' })
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(ValidationError)
      expect(result.error.message).toContain('filePath')
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

describe('AudioTrack.reconstitute', () => {
  const persistedData: AudioTrackPersistence = {
    id: 'existing-uuid',
    filename: 'track.mp3',
    mimeType: 'audio/mpeg',
    sizeInBytes: 1024,
    filePath: '/uploads/originals/existing.mp3',
    processedFilePath: '/uploads/processed/existing_NORMALIZE.mp3',
    status: AudioTrackStatus.READY,
    durationSeconds: 180,
    createdAt: new Date('2024-01-01'),
  }

  it('restores the entity with the persisted id', () => {
    const track = AudioTrack.reconstitute(persistedData)
    expect(track.id).toBe('existing-uuid')
  })

  it('restores the persisted status (not always PENDING)', () => {
    const track = AudioTrack.reconstitute(persistedData)
    expect(track.status).toBe(AudioTrackStatus.READY)
  })

  it('restores durationSeconds', () => {
    const track = AudioTrack.reconstitute(persistedData)
    expect(track.durationSeconds).toBe(180)
  })

  it('restores createdAt', () => {
    const track = AudioTrack.reconstitute(persistedData)
    expect(track.createdAt).toEqual(new Date('2024-01-01'))
  })

  it('restores filePath and processedFilePath', () => {
    const track = AudioTrack.reconstitute(persistedData)
    expect(track.filePath).toBe('/uploads/originals/existing.mp3')
    expect(track.processedFilePath).toBe('/uploads/processed/existing_NORMALIZE.mp3')
  })

  it('restores a FAILED track without durationSeconds or processedFilePath', () => {
    const track = AudioTrack.reconstitute({
      ...persistedData,
      status: AudioTrackStatus.FAILED,
      durationSeconds: undefined,
      processedFilePath: undefined,
    })
    expect(track.status).toBe(AudioTrackStatus.FAILED)
    expect(track.durationSeconds).toBeUndefined()
    expect(track.processedFilePath).toBeUndefined()
  })
})

describe('AudioTrack.setProcessedFilePath', () => {
  it('sets the processed file path', () => {
    const result = AudioTrack.create(validProps)
    if (!result.isOk()) throw new Error('setup failed')
    const track = result.value

    track.setProcessedFilePath('/uploads/processed/out.mp3')

    expect(track.processedFilePath).toBe('/uploads/processed/out.mp3')
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
