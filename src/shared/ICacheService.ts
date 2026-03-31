/**
 * Port: generic cache interface.
 *
 * Values are serialized as JSON — only plain objects (DTOs) should be cached,
 * not domain entities with private fields or class methods.
 */
export interface ICacheService {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>
  del(key: string): Promise<void>
}
