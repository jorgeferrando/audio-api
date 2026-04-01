# ADR 005 - Cache in the Use Case, not in the Repository

## Status
Accepted

## Context
When adding Redis as a cache layer for `GetAudioStatusUseCase`, a decision had to be made
about where to place the cache logic: in the repository (transparent to the use case)
or in the use case itself.

Two common patterns:

**Repository Cache Pattern** — the repository checks the cache before hitting the DB.
The use case is unaware that cache exists.

**Use Case Cache Pattern** — the use case explicitly manages cache and DB.
The repository remains pure (DB only).

## Decision
The cache logic lives in the use case (`GetAudioStatusUseCase`), not in the repository.

## Consequences

**Why not in the repository:**

1. **TTL depends on business logic.** Terminal states (`READY`, `FAILED`)
   are immutable — they can be cached for 5 minutes. In-flight states (`PENDING`,
   `PROCESSING`) change frequently — 5 seconds at most. A repository should not
   know about these rules; they belong to the application layer.

2. **The repository can only cache its own entity.** `GetAudioStatusUseCase`
   combines `AudioTrack` + `ProcessingJob` into a single DTO. No individual
   repository can cache that composite response — only the use case can,
   because it is the one orchestrating the two.

3. **Violates SRP.** A repository with cache does two things: persistence and caching.
   If the repository caches, it needs an `ICacheService` as a dependency, which
   increases its responsibility surface without clear benefit.

**Positive consequences:**
- The repository is pure: it only talks to MongoDB. Easy to test and reason about.
- The cache policy (TTL, what to cache, when to invalidate) is explicit and
  co-located with the business logic that motivates it.
- The cached DTO is the same one the use case returns: no additional
  transformations when reading from cache.

**Negative consequences:**
- The use case has one more dependency (`ICacheService`), which adds some
  complexity to the constructor and to the tests.
- If another use case needs the same data, the cache logic is not automatically
  reused (it would need to be extracted to an application service).
