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

- **TDD**: write test first, then implementation
- **SOLID**: especially Single Responsibility and Dependency Inversion
- **YAGNI**: no over-engineering. Simple and functional.
- **Result type**: use `Result<T, E>` instead of throwing exceptions in domain/application layers
- **Dependency Injection**: use constructor injection, no service locators

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
