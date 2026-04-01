# ADR 009 - Contract Tests only for Ports with Multiple Implementations

## Status
Accepted

## Context
The project has 7 ports (interfaces): ILogger, IFileStorage, ICacheService,
IAudioTrackRepository, IProcessingJobRepository, IAudioProcessor, IJobPublisher.

Only ILogger has shared contract tests (`loggerContract.ts`), because it is
the only port with two implementations (WinstonLogger + ConsoleLogger). The
remaining ports have a single implementation each.

An external review noted that without contract tests on all ports, a new
adapter could deviate from the expected behavior without the tests detecting it.

## Decision
Apply YAGNI: only create contract tests when a port has more than one
implementation. With a single implementation, the unit and integration tests
of that implementation are the de facto contract test.

## Consequences

**Positive:**
- Less test code to maintain without real benefit.
- When a second implementation is added (e.g. `S3FileStorage` for
  `IFileStorage`), the contract test is created at that point with real knowledge
  of which behaviors matter to verify — not speculatively.

**Negative:**
- If someone adds a second implementation without creating the contract test,
  there may be behavioral divergence. Mitigated by code review.

**Future candidates:**
- `IFileStorage` is the port most likely to have a second
  implementation (MinIO in dev, S3/GCS in production). When that happens,
  create `fileStorageContract.ts` following the pattern of `loggerContract.ts`.
