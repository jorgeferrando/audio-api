# ADR 001 - Result/Either Pattern for Error Handling

## Status
Accepted

## Context
Node.js/TypeScript projects typically handle errors with exceptions (`throw`/`try-catch`).
The problem with exceptions is that they are invisible in function signatures — callers
have no way to know what can go wrong without reading the implementation.

## Decision
Use a `Result<T, E>` type (Ok | Err) for all expected errors in the domain and application layers.
`try-catch` is reserved exclusively for infrastructure boundaries (DB, queues, HTTP calls)
where unexpected exceptions from external systems must be caught and converted to `Result`.

```typescript
// Domain/Application — explicit contract
function findAudio(id: string): Result<AudioTrack, NotFoundError>

// Infrastructure — only place for try-catch
async find(id: string): Promise<Result<AudioTrack, NotFoundError>> {
  try {
    const doc = await AudioModel.findById(id)
    if (!doc) return err(new NotFoundError('AudioTrack', id))
    return ok(toDomain(doc))
  } catch (e) {
    logger.error('AudioRepository.find failed', { error: e, id })
    return err(new DatabaseError('Failed to find audio'))
  }
}
```

## Consequences
- **Positive:** Errors are part of the function signature. TypeScript enforces handling them.
- **Positive:** No unexpected control flow jumps. Code reads top to bottom.
- **Positive:** Forces distinguishing between expected errors (NotFound) and unexpected failures (DB down).
- **Negative:** More verbose than try-catch for simple cases.
- **Negative:** Requires discipline — easy to `unwrap()` without checking, defeating the purpose.
