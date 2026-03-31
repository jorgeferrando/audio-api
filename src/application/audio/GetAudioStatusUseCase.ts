import { type Result, ok, err } from '@shared/Result'
import type { AppError} from '@shared/AppError';
import { NotFoundError } from '@shared/AppError'
import type { ICacheService } from '@shared/ICacheService'
import type { IAudioTrackRepository } from '@domain/audio/IAudioTrackRepository'
import { AudioTrackStatus } from '@domain/audio/AudioTrack'
import type { IProcessingJobRepository } from '@domain/job/IProcessingJobRepository'
import type { AudioStatusDto } from './AudioStatusDto'

// Terminal states won't change — safe to cache for longer.
const TERMINAL_TTL_SECONDS = 5 * 60 // 5 min
// In-flight states change frequently — short TTL to avoid stale polling responses.
const IN_FLIGHT_TTL_SECONDS = 5 // 5 sec

const cacheKey = (audioTrackId: string): string => `audio:status:${audioTrackId}`

interface GetAudioStatusInput {
  audioTrackId: string
}

export class GetAudioStatusUseCase {
  constructor(
    private readonly audioRepo: IAudioTrackRepository,
    private readonly jobRepo: IProcessingJobRepository,
    private readonly cache: ICacheService,
  ) {}

  async execute(input: GetAudioStatusInput): Promise<Result<AudioStatusDto, AppError>> {
    const key = cacheKey(input.audioTrackId)

    const cached = await this.cache.get<AudioStatusDto>(key)
    if (cached) return ok(cached)

    const audioResult = await this.audioRepo.findById(input.audioTrackId)
    if (audioResult.isErr()) return err(audioResult.error)

    if (audioResult.value === null) {
      return err(new NotFoundError('AudioTrack', input.audioTrackId))
    }

    const audio = audioResult.value

    const jobResult = await this.jobRepo.findByAudioTrackId(input.audioTrackId)
    if (jobResult.isErr()) return err(jobResult.error)

    const job = jobResult.value

    const dto: AudioStatusDto = {
      audioTrackId:    audio.id,
      filename:        audio.filename,
      mimeType:        audio.mimeType,
      sizeInBytes:     audio.sizeInBytes,
      status:            audio.status,
      durationSeconds:   audio.durationSeconds,
      processedFilePath: audio.processedFilePath,
      createdAt:         audio.createdAt,
      job: job ? {
        jobId:        job.id,
        effect:       job.effect,
        status:       job.status,
        startedAt:    job.startedAt,
        completedAt:  job.completedAt,
        errorMessage: job.errorMessage,
      } : null,
    }

    const isTerminal = audio.status === AudioTrackStatus.READY
      || audio.status === AudioTrackStatus.FAILED

    await this.cache.set(key, dto, isTerminal ? TERMINAL_TTL_SECONDS : IN_FLIGHT_TTL_SECONDS)

    return ok(dto)
  }
}
