# Audio Processing API

REST API for audio processing with async job execution via message queues.

Built with **Node.js**, **Express**, **MongoDB**, **Redis** and **RabbitMQ**.

## Architecture

Clean Architecture with four layers:

```
presentation/     Controllers, routes, HTTP middlewares
application/      Use cases, DTOs, application ports
domain/           Entities, value objects, repository ports
infrastructure/   MongoDB, Redis, RabbitMQ, Express, Winston
```

### System Overview

```
                          ┌──────────────────────────────────────────────────┐
                          │                   CLIENT                        │
                          └──────────────┬───────────────▲──────────────────┘
                                         │               │
                                    POST /audio     GET /audio/:id
                                         │               │
┌────────────────────────────────────────▼───────────────┴──────────────────────┐
│  PRESENTATION                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │  AudioController  ──────────►  Zod Validation  ──────►  errorHandler   │  │
│  └────────┬──────────────────────────────────────────────────┬────────────┘  │
└───────────┼──────────────────────────────────────────────────┼────────────────┘
            │                                                  │
┌───────────▼──────────────────────────────────────────────────▼────────────────┐
│  APPLICATION                                                                  │
│  ┌──────────────────────┐   ┌───────────────────────┐   ┌────────────────┐   │
│  │  UploadAudioUseCase  │   │ GetAudioStatusUseCase │   │ ProcessJobUC   │   │
│  │                      │   │                       │   │  (worker)      │   │
│  │  AudioTrack.create() │   │  Cache hit? ──► DTO   │   │  start()       │   │
│  │  ProcessingJob.create│   │  Cache miss?          │   │  simulate()    │   │
│  │  save both           │   │    ──► DB ──► cache   │   │  complete()    │   │
│  │  publish to queue    │   │    ──► DTO            │   │  invalidate    │   │
│  └──────┬───────────────┘   └──────┬────────────────┘   └──────┬─────────┘   │
└─────────┼──────────────────────────┼───────────────────────────┼─────────────┘
          │                          │                           │
          │   ┌──────────────────────┼───────────────────────────┼──────────┐
          │   │  DOMAIN              │                           │          │
          │   │  ┌───────────────────┼───┐   ┌───────────────────┼──────┐   │
          │   │  │    AudioTrack     │   │   │   ProcessingJob   │      │   │
          │   │  │  ┌─────────────┐  │   │   │  ┌────────────┐  │      │   │
          │   │  │  │ #status     │  │   │   │  │ #status    │  │      │   │
          │   │  │  │ #duration   │  │   │   │  │ #startedAt │  │      │   │
          │   │  │  └─────────────┘  │   │   │  │ #errorMsg  │  │      │   │
          │   │  │  PENDING          │   │   │  └────────────┘  │      │   │
          │   │  │   └► PROCESSING   │   │   │  PENDING         │      │   │
          │   │  │       ├► READY    │   │   │   └► PROCESSING  │      │   │
          │   │  │       └► FAILED   │   │   │       ├► COMPLETED      │   │
          │   │  └───────────────────┘   │   │       └► FAILED  │      │   │
          │   │                          │   └──────────────────┘      │   │
          │   │  ┌──────────────────┐    │   ┌──────────────────┐      │   │
          │   │  │ IAudioTrackRepo  │◄───┘   │ IProcessingJobRepo│◄────┘   │
          │   │  └────────┬─────────┘        └────────┬─────────┘          │
          │   └───────────┼───────────────────────────┼────────────────────┘
          │               │                           │
┌─────────▼───────────────▼───────────────────────────▼────────────────────────┐
│  INFRASTRUCTURE                                                               │
│                                                                               │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │   MongoDB     │  │     Redis        │  │  RabbitMQ     │  │  Winston    │  │
│  │              │  │                  │  │               │  │             │  │
│  │  AudioTrack  │  │  RedisCacheSvc   │  │  Publisher    │  │  ILogger    │  │
│  │  MongoRepo   │  │                  │  │  Consumer     │  │  port impl  │  │
│  │              │  │  TTL: 5s/5min    │  │               │  │             │  │
│  │  ProcessJob  │  │  (terminal vs    │  │  audio.jobs   │  │  dev: color │  │
│  │  MongoRepo   │  │   in-flight)     │  │  audio.dlq    │  │  prod: JSON │  │
│  └──────┬───────┘  └───────┬──────────┘  └──────┬────────┘  └─────────────┘  │
└─────────┼──────────────────┼────────────────────┼────────────────────────────┘
          │                  │                    │
          ▼                  ▼                    ▼
    ┌──────────┐      ┌──────────┐        ┌──────────────┐
    │ MongoDB  │      │  Redis   │        │  RabbitMQ    │
    │ Server   │      │  Server  │        │  Broker      │
    └──────────┘      └──────────┘        └──────────────┘
```

### Request Flow

```
  Upload:   Client ──► Controller ──► UploadAudioUseCase ──► MongoDB + RabbitMQ
                                                                      │
  Worker:                              ProcessJobUseCase ◄─── Consumer ◄┘
                                            │
                                       MongoDB (update) + Redis (invalidate)

  Status:   Client ──► Controller ──► GetAudioStatusUseCase
                                            │
                                      Redis hit? ──► return cached DTO
                                      Redis miss? ──► MongoDB ──► cache ──► return
```

**Key patterns:**
- Result/Either monad for error handling (no throw in domain/application)
- Port & Adapter for all infrastructure (repositories, cache, queue publisher)
- Saga compensation for multi-entity consistency in async processing
- TDD with 120+ tests (unit + integration)

Architecture decisions are documented in [`docs/decisions/`](docs/decisions/).

## Endpoints

| Method | Path               | Description              | Status |
|--------|--------------------|--------------------------|--------|
| POST   | /api/v1/audio      | Upload audio track       | 202    |
| GET    | /api/v1/audio/:id  | Get audio track status   | 200    |
| GET    | /api/v1/health     | Health check             | 200    |

### POST /api/v1/audio

```json
{
  "filename": "song.mp3",
  "mimeType": "audio/mpeg",
  "sizeInBytes": 1048576,
  "effect": "NORMALIZE"
}
```

Available effects: `NORMALIZE`, `REVERB`, `ECHO`, `PITCH_SHIFT`, `NOISE_REDUCTION`

Response `202 Accepted`:
```json
{
  "audioTrackId": "uuid",
  "jobId": "uuid"
}
```

### GET /api/v1/audio/:id

Response `200 OK`:
```json
{
  "audioTrackId": "uuid",
  "filename": "song.mp3",
  "mimeType": "audio/mpeg",
  "sizeInBytes": 1048576,
  "status": "READY",
  "durationSeconds": 243.5,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "job": {
    "jobId": "uuid",
    "effect": "NORMALIZE",
    "status": "COMPLETED",
    "startedAt": "2024-01-01T00:01:00.000Z",
    "completedAt": "2024-01-01T00:01:30.000Z"
  }
}
```

## Tech Stack

- **Runtime:** Node.js 22 + TypeScript 5
- **HTTP:** Express 4 + Zod validation + Helmet + CORS
- **Database:** MongoDB 7 (Mongoose ODM)
- **Cache:** Redis 7 (ioredis)
- **Queue:** RabbitMQ 3 (amqplib) with Dead Letter Queue
- **Logging:** Winston (JSON in prod, pretty print in dev)
- **Testing:** Vitest + mongodb-memory-server
- **Linting:** ESLint 9 (flat config) + @typescript-eslint

## Getting Started

### Prerequisites

- Node.js >= 22
- Docker and Docker Compose

### Setup

```bash
# Clone and install
git clone https://github.com/jorgeferrando/audio-api.git
cd audio-api
npm install

# Start infrastructure
docker compose up -d mongodb redis rabbitmq

# Copy environment variables
cp .env.example .env

# Run the API server
npm run dev

# Run the worker (in a separate terminal)
npm run dev:worker
```

### Scripts

| Script              | Description                           |
|---------------------|---------------------------------------|
| `npm run dev`       | Start API server (hot reload)         |
| `npm run dev:worker`| Start worker (hot reload)             |
| `npm run build`     | Compile TypeScript                    |
| `npm start`         | Start compiled API server             |
| `npm run start:worker` | Start compiled worker              |
| `npm test`          | Run all tests                         |
| `npm run test:watch`| Run tests in watch mode               |
| `npm run test:coverage` | Run tests with coverage report    |
| `npm run lint`      | Run ESLint                            |
| `npm run type-check`| Run TypeScript type checker           |

### Docker

```bash
# Full stack (API + Worker + MongoDB + Redis + RabbitMQ)
docker compose up
```

## Project Structure

```
src/
  domain/
    audio/        AudioTrack entity, repository port
    job/          ProcessingJob entity, repository port
  application/
    audio/        UploadAudioUseCase, GetAudioStatusUseCase, DTO
    job/          ProcessJobUseCase, IJobPublisher port
  infrastructure/
    db/           Mongoose models, repositories, connection
    cache/        RedisCacheService
    queue/        RabbitMQ publisher, consumer, setup
    logger/       WinstonLogger, ConsoleLogger
    http/         Express app setup
  presentation/
    controllers/  AudioController
    routes/       Audio routes, health routes
    middlewares/  Error handler
  shared/         Result, AppError, ILogger, ICacheService
docs/
  decisions/      Architecture Decision Records (ADRs)
tests/
  integration/    MongoDB repository tests
```

## Testing

```bash
npm test                    # 120+ tests
npm run test:coverage       # with coverage report
```

- **Unit tests:** co-located with implementation (`src/**/*.test.ts`)
- **Integration tests:** `tests/integration/` (uses mongodb-memory-server)
- **Contract tests:** shared test suites for port implementations (ILogger)

## License

MIT
