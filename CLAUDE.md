# Audio API - Claude Code Context

## Why this project exists

Portfolio showcase for a **Senior Node.js Developer** application at **Voicemod** (audio tech company, Valencia/Spain).

The goal is to demonstrate:
- Modern Node.js + Express + TypeScript
- MongoDB + Redis + RabbitMQ (Voicemod's exact stack)
- Clean Architecture + SOLID + TDD (Jorge's base principles)
- Docker + CI/CD
- Async processing with workers (mirrors real Parclick experience)

**Deadline:** URGENT - apply ASAP (job posted 4+ days ago)

---

## Project: Audio Processing Microservices API

A REST API that handles audio file submissions, processes them asynchronously via workers, and returns results in real-time.

### Core Domain:
- **AudioTrack**: entity representing an uploaded audio file
- **ProcessingJob**: entity representing an async processing task
- **Effect**: value object representing an audio effect to apply

### Flows:
1. Client uploads audio → API creates AudioTrack + ProcessingJob → publishes to RabbitMQ
2. Worker consumes queue → processes job → updates status in MongoDB
3. Client polls status or receives update via SSE
4. Results cached in Redis

---

## Stack
- **Runtime:** Node.js 24 + TypeScript
- **Framework:** Express
- **Database:** MongoDB (via Mongoose)
- **Cache + Queues:** Redis (via ioredis) + RabbitMQ (via amqplib)
- **Testing:** Jest + Supertest
- **Containers:** Docker + docker-compose
- **CI/CD:** GitHub Actions

---

## Architecture: Clean Architecture

```
src/
├── domain/          # Pure business logic. No framework deps.
│   ├── audio/       # AudioTrack entity, value objects
│   ├── job/         # ProcessingJob entity
│   └── shared/      # Result type, errors, interfaces
├── application/     # Use cases, DTOs, ports (interfaces)
│   ├── audio/       # UploadAudio, GetAudioStatus use cases
│   └── job/         # ProcessJob, GetJobStatus use cases
├── infrastructure/  # Implements ports. Framework/DB code lives here.
│   ├── db/          # MongoDB repositories
│   ├── queue/       # RabbitMQ publisher + consumer
│   ├── cache/       # Redis service
│   └── http/        # Express app setup
├── presentation/    # HTTP layer
│   ├── controllers/ # Request/response handling
│   ├── routes/      # Route definitions
│   └── middlewares/ # Auth, error handling, validation
└── shared/          # Cross-cutting: logger, config, types
```

---

## Key Principles

- **TDD**: write test first, then implementation. Red → Green → Refactor. No exceptions.
- **SOLID**: especially Single Responsibility and Dependency Inversion
- **YAGNI**: no over-engineering. Simple and functional. Don't add what isn't needed yet.
- **KISS**: simplest solution that works. No premature abstractions.

### Error handling
- **Result/Either pattern** in domain + application layers. Never `throw` there.
- `try-catch` only in infrastructure (DB, queues, HTTP calls) to catch unexpected exceptions and convert them to `Result`.
- Always log the original exception inside the `catch` before converting to `Result` — it's the last chance to see the real stack trace.

```typescript
// infrastructure — the only place for try-catch
async save(audio: AudioTrack): Promise<Result<void, DatabaseError>> {
  try {
    await this.model.create(audio)
    return ok(undefined)
  } catch (e) {
    this.logger.error('AudioRepository.save failed', { error: e, audioId: audio.id })
    return err(new DatabaseError('Failed to save audio'))
  }
}
```

### Logging
- Define `ILogger` port in `shared/`. Never depend on Winston directly outside infrastructure.
- `WinstonLogger` for dev/prod (already implemented). Add `DatadogLogger`, `SentryLogger`, etc. as new implementations.
- dev format: human-readable with colors. prod format: JSON for observability tools.
- Inject logger via constructor. Never import a global singleton.
- **Contract tests**: every `ILogger` implementation must pass `testLoggerContract()` from `tests/unit/infrastructure/logger/loggerContract.ts`.

### Ports & Adapters
- Define interfaces (Ports) in `shared/` or `domain/`. Implement them in `infrastructure/`.
- Code in domain/application depends only on interfaces, never on concrete classes.
- Swap implementations by changing the composition root (`index.ts`) only.

### Contract Tests
- When two or more classes implement the same interface, extract shared behavior into a contract function:
  ```typescript
  // loggerContract.ts
  export function testLoggerContract(createLogger: () => ILogger) { ... }

  // WinstonLogger.test.ts
  describe('WinstonLogger', () => {
    testLoggerContract(() => new WinstonLogger())
    // ...specific tests
  })
  ```
- This enforces LSP (Liskov Substitution Principle) at the test level.

### Dependency Injection
- Constructor injection only. No service locators, no global singletons.
- Wire everything in `index.ts` (composition root).

### Test file location
- **Unit tests:** co-located with the implementation file in `src/`
  ```
  src/domain/audio/AudioTrack.ts
  src/domain/audio/AudioTrack.test.ts   ← same folder
  ```
- **Integration tests:** in `tests/integration/` (they cross layers, no single owner in src)
  ```
  tests/integration/upload-audio-flow.test.ts
  ```
- **Contract test helpers** (e.g. `loggerContract.ts`): co-located with the implementations they test, excluded from coverage and build.
- `tsconfig.build.json` excludes `**/*.test.ts` and contract helpers — they never go to `dist/`.

### Documentation
This is a portfolio project — documenting decisions is as important as the code itself.

- **ADR (Architecture Decision Records):** for global/architectural decisions. One file per decision in `docs/decisions/NNN-title.md`. Use the format: Status / Context / Decision / Consequences.
  - Create a new ADR whenever introducing a significant pattern or making a non-obvious architectural choice.
  - Existing ADRs: 001 Result pattern, 002 Clean Architecture, 003 Test colocation, 004 ILogger port.

- **Code comments:** for local implementation decisions — why a specific data structure, why a design pattern was chosen for this class, trade-offs made. Use JSDoc-style block comments on classes/functions.
  - Comment the *why*, not the *what*. If the code already says what it does, the comment should explain why it does it that way.
  - Example: why `Set` instead of `Array`, why private constructor + static factory, why a state machine.

- Do NOT add comments that just restate the code (e.g. `// returns the id` above `get id()`).

### Commits
- Conventional commits. No Claude co-author. Jorge's commits only.

---

## API Endpoints

```
POST   /api/v1/audio          → Upload audio, create processing job
GET    /api/v1/audio/:id      → Get audio track + job status
GET    /api/v1/audio/:id/sse  → Real-time status updates (Server-Sent Events)
GET    /api/v1/jobs           → List jobs with filters
GET    /api/v1/jobs/:id       → Get specific job
GET    /api/v1/health         → Health check (DB, Redis, RabbitMQ)
```

---

## Processing Queue

```
Exchange: audio.processing
Queues:
  - audio.jobs       → new jobs to process
  - audio.results    → completed job results
  - audio.dlq        → dead letter queue for failed jobs
```

---

## Environment Variables

See `.env.example`

---

## Commands

```bash
npm run dev          # Start with hot reload
npm test             # Run all tests
npm run test:watch   # Watch mode
npm run test:coverage
docker-compose up    # Start all services
docker-compose down  # Stop all services
```

---

## Development Plan

### Phase 1: Core Domain + Tests (TDD)
- [ ] Result type + AppError
- [ ] AudioTrack entity + tests
- [ ] ProcessingJob entity + tests
- [ ] Repository interfaces (ports)

### Phase 2: Infrastructure
- [ ] MongoDB connection + AudioTrack repository
- [ ] Redis service (cache + simple queue)
- [ ] RabbitMQ publisher + consumer

### Phase 3: Application Layer
- [ ] UploadAudioUseCase + tests
- [ ] GetAudioStatusUseCase + tests
- [ ] ProcessJobUseCase + tests

### Phase 4: HTTP Layer
- [ ] Express setup + middlewares
- [ ] Controllers + routes
- [ ] Error handling
- [ ] Integration tests

### Phase 5: Worker
- [ ] Worker process (consumes RabbitMQ)
- [ ] Simulated audio processing

### Phase 6: DevOps
- [ ] Dockerfile
- [ ] docker-compose (already done)
- [ ] GitHub Actions CI
- [ ] README professional

---

## Commit style

Conventional commits. No Claude co-author. Jorge's commits only.

```
feat: add AudioTrack entity with validation
test: add ProcessingJob unit tests
fix: handle reconnection in RabbitMQ consumer
docs: update README with architecture diagram
```
