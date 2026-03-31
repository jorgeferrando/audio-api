# ADR 003 - Co-located Unit Tests, Separated Integration Tests

## Status
Accepted

## Context
Two common conventions exist for test file placement:
1. Mirror structure under a top-level `tests/` folder
2. Co-locate test files next to the implementation

## Decision
**Unit tests** are co-located with the implementation:
```
src/domain/audio/AudioTrack.ts
src/domain/audio/AudioTrack.test.ts
```

**Integration tests** live in `tests/integration/` because they test flows that
cross multiple layers and have no single natural owner in `src/`:
```
tests/integration/upload-audio-flow.test.ts
```

**Contract test helpers** (e.g. `loggerContract.ts`) are co-located with the
implementations they describe, and excluded from build and coverage.

## Consequences
- **Positive:** Unit tests are easy to find — same folder as the code they test.
- **Positive:** Renaming/moving a file naturally moves its test with it.
- **Positive:** Integration tests have a clear home that reflects their cross-layer nature.
- **Negative:** `src/` contains both production code and test files (excluded from build via `tsconfig.build.json`).
