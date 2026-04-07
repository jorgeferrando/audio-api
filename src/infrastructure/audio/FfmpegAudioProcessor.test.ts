import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AudioEffect } from '@domain/job/ProcessingJob'
import type { ILogger } from '@shared/ILogger'

// ── Hoisted mock fns (safe to reference inside vi.mock factories) ────────
const { mockExecFileFn, mockUnlink } = vi.hoisted(() => {
  const mockExecFileFn = vi.fn()
  // Attach custom promisify so util.promisify(execFile) returns our async mock.
  // Node's real execFile has this built-in; our mock needs it too.
  const customSymbol = Symbol.for('nodejs.util.promisify.custom')
  ;(mockExecFileFn as unknown as Record<symbol, unknown>)[customSymbol] = vi.fn()
  return {
    mockExecFileFn,
    mockUnlink: vi.fn().mockResolvedValue(undefined),
  }
})

vi.mock('child_process', () => ({ execFile: mockExecFileFn }))
vi.mock('fs/promises', () => ({ unlink: mockUnlink }))

// Must import AFTER mocks are set up (vi.mock is hoisted anyway)
import { FfmpegAudioProcessor, EFFECT_FILTERS } from './FfmpegAudioProcessor'

/**
 * Set up the promisified execFile mock to resolve/reject with the given results.
 * promisify(execFile) returns the [nodejs.util.promisify.custom] function,
 * which is what we mock here.
 */
function getPromisifiedMock() {
  const sym = Symbol.for('nodejs.util.promisify.custom')
  return (mockExecFileFn as unknown as Record<symbol, ReturnType<typeof vi.fn>>)[sym]
}

function setupExecFile(results: Array<{ err?: Error; stdout?: string }>): void {
  const promisified = getPromisifiedMock()
  for (const r of results) {
    promisified.mockImplementationOnce(async () => {
      if (r.err) throw r.err
      return { stdout: r.stdout ?? '', stderr: '' }
    })
  }
}

function makeLogger(): ILogger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}

describe('FfmpegAudioProcessor', () => {
  let logger: ILogger
  let processor: FfmpegAudioProcessor

  beforeEach(() => {
    vi.clearAllMocks()
    logger = makeLogger()
    processor = new FfmpegAudioProcessor(logger)
  })

  it('applies effect and returns duration on success', async () => {
    setupExecFile([
      { stdout: '' },
      { stdout: JSON.stringify({ format: { duration: '12.345' } }) },
    ])

    const result = await processor.applyEffect('/tmp/in.mp3', '/tmp/out.mp3', AudioEffect.REVERB)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.processedFilePath).toBe('/tmp/out.mp3')
      expect(result.value.durationSeconds).toBe(12.3)
    }
  })

  it('passes the correct ffmpeg filter for each effect', async () => {
    const promisified = getPromisifiedMock()
    for (const [effect, filter] of Object.entries(EFFECT_FILTERS)) {
      vi.clearAllMocks()
      setupExecFile([
        { stdout: '' },
        { stdout: JSON.stringify({ format: { duration: '1.0' } }) },
      ])

      await processor.applyEffect('/tmp/in.mp3', '/tmp/out.mp3', effect as AudioEffect)

      const firstCall = promisified.mock.calls[0]
      const args = firstCall[1] as string[]
      expect(args).toContain('-af')
      expect(args).toContain(filter)
    }
  })

  it('passes timeout option to both execFile calls', async () => {
    setupExecFile([
      { stdout: '' },
      { stdout: JSON.stringify({ format: { duration: '1.0' } }) },
    ])

    await processor.applyEffect('/tmp/in.mp3', '/tmp/out.mp3', AudioEffect.NORMALIZE)

    const promisified = getPromisifiedMock()
    expect(promisified).toHaveBeenCalledTimes(2)
    for (const call of promisified.mock.calls) {
      const opts = call[2] as { timeout?: number }
      expect(opts.timeout).toBe(60_000)
    }
  })

  it('returns error and cleans up output file when ffmpeg fails', async () => {
    setupExecFile([{ err: new Error('ffmpeg crashed') }])

    const result = await processor.applyEffect('/tmp/in.mp3', '/tmp/out.mp3', AudioEffect.ECHO)

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe('PROCESSING_ERROR')
      expect(result.error.message).toContain('ffmpeg crashed')
    }
    expect(mockUnlink).toHaveBeenCalledWith('/tmp/out.mp3')
    expect(logger.error).toHaveBeenCalled()
  })

  it('returns error when ffprobe fails', async () => {
    setupExecFile([
      { stdout: '' },
      { err: new Error('ffprobe not found') },
    ])

    const result = await processor.applyEffect('/tmp/in.mp3', '/tmp/out.mp3', AudioEffect.NORMALIZE)

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe('PROCESSING_ERROR')
      expect(result.error.message).toContain('metadata')
    }
  })

  it('returns error when ffprobe output is invalid JSON', async () => {
    setupExecFile([
      { stdout: '' },
      { stdout: 'not-json{{{' },
    ])

    const result = await processor.applyEffect('/tmp/in.mp3', '/tmp/out.mp3', AudioEffect.NORMALIZE)

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe('PROCESSING_ERROR')
    }
  })

  it('defaults duration to 0 when ffprobe output lacks duration field', async () => {
    setupExecFile([
      { stdout: '' },
      { stdout: JSON.stringify({ format: {} }) },
    ])

    const result = await processor.applyEffect('/tmp/in.mp3', '/tmp/out.mp3', AudioEffect.NORMALIZE)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.durationSeconds).toBe(0)
    }
  })
})
