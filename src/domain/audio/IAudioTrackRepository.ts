import { type Result } from '@shared/Result'
import { DatabaseError } from '@shared/AppError'
import { AudioTrack } from './AudioTrack'

/**
 * Port: defines what the application needs from audio track storage.
 *
 * Lives in domain so the domain/application layers depend on this interface,
 * never on Mongoose or any concrete DB driver (Dependency Inversion Principle).
 * The implementation lives in infrastructure/ and is wired at the composition root.
 *
 * `save` handles both insert and update (upsert semantics) — the repository
 * is responsible for detecting whether the entity already exists. This keeps
 * the use cases simple: they always call `save`, regardless of whether it's a
 * create or an update operation.
 */
export interface IAudioTrackRepository {
  save(audio: AudioTrack): Promise<Result<void, DatabaseError>>
  findById(id: string): Promise<Result<AudioTrack | null, DatabaseError>>
}
