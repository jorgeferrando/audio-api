# Audio Processing API

REST API for audio processing with async job execution via message queues.

Upload an audio file, apply an effect (reverb, echo, pitch shift...), and download the processed result.

Built with **Node.js**, **Express**, **MongoDB**, **Redis**, **RabbitMQ** and **MinIO**.

![Web UI](docs/screenshot.png)

## Architecture

Clean Architecture with four layers:

```
presentation/     Controllers, routes, middlewares (auth, validation, error handling)
application/      Use cases, DTOs, application ports
domain/           Entities, value objects, repository ports
infrastructure/   MongoDB, Redis, RabbitMQ, MinIO, Express, ffmpeg, nginx, Winston
```

### Request Flow

```
  Upload:   Client ──► nginx ──► multer ──► AudioController
                                                │
                              ffprobe validates audio content
                                                │
                              Stream to MinIO ──► UploadAudioUseCase ──► MongoDB + RabbitMQ

  Worker:                     ProcessJobUseCase ◄── Consumer ◄── RabbitMQ
                                   │
                              MinIO (download) → ffmpeg (apply effect) → MinIO (upload)
                                   │
                              MongoDB (READY) + Redis (invalidate)

  Status:   Client ──► nginx ──► AudioController ──► GetAudioStatusUseCase
                                                          │
                                                    Redis hit? ──► cached DTO
                                                    Redis miss? ──► MongoDB ──► cache

  Download: Client ──► nginx ──► AudioController ──► DownloadAudioUseCase ──► MinIO stream
```

**Key patterns:**
- Result/Either monad for error handling (no throw in domain/application)
- Port & Adapter for all infrastructure (repositories, cache, queue, audio processor, file storage)
- Saga compensation with graceful drain for multi-entity consistency
- API key authentication, CSP-compliant frontend (no inline styles/scripts)
- TDD with 176+ tests (unit + integration + contract + frontend)

Architecture decisions are documented in [`docs/decisions/`](docs/decisions/) (11 ADRs).

## Endpoints

| Method | Path                       | Auth | Description              | Status |
|--------|----------------------------|------|--------------------------|--------|
| GET    | /api/v1/audio              | Yes  | List tracks (paginated)  | 200    |
| POST   | /api/v1/audio              | Yes  | Upload audio + process   | 202    |
| GET    | /api/v1/audio/:id          | Yes  | Get audio track status   | 200    |
| GET    | /api/v1/audio/:id/download | Yes  | Download processed audio | 200    |
| DELETE | /api/v1/audio/:id          | Yes  | Delete track + files     | 204    |
| GET    | /api/v1/health             | No   | Health check (liveness)  | 200    |
| GET    | /api/v1/health/ready       | No   | Readiness probe          | 200    |

`GET /api/v1/audio` supports pagination: `?limit=50&offset=0` (default). Max limit: 100.

Authentication: send `x-api-key` header. Set `API_KEY` in `.env` to enable.

### POST /api/v1/audio

Multipart form-data:
- `file`: audio file (mp3, wav, ogg, flac, aac, webm — max 50MB)
- `effect`: one of `NORMALIZE`, `REVERB`, `ECHO`, `PITCH_SHIFT`, `NOISE_REDUCTION`

Response `202 Accepted`:
```json
{
  "audioTrackId": "uuid",
  "jobId": "uuid"
}
```

### GET /api/v1/audio

Response `200 OK`:
```json
{
  "items": [{ "audioTrackId": "...", "filename": "...", "status": "READY", ... }],
  "total": 42,
  "limit": 50,
  "offset": 0
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
  "downloadReady": true,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "job": {
    "jobId": "uuid",
    "effect": "REVERB",
    "status": "COMPLETED",
    "startedAt": "2024-01-01T00:01:00.000Z",
    "completedAt": "2024-01-01T00:01:30.000Z"
  }
}
```

## Tech Stack

- **Runtime:** Node.js 22 + TypeScript 5
- **HTTP:** Express 4 (API only) + nginx (static files, reverse proxy, cache headers)
- **Database:** MongoDB 7 (Mongoose ODM)
- **Cache:** Redis 7 (ioredis) with TTL strategy (5s in-flight, 5min terminal)
- **Queue:** RabbitMQ 3 (amqplib) with Dead Letter Queue + graceful drain
- **Storage:** MinIO (S3-compatible object storage, streaming upload/download)
- **Audio:** ffmpeg via fluent-ffmpeg + ffprobe content validation
- **Auth:** API key middleware (x-api-key header)
- **Logging:** Winston (JSON in prod, pretty print in dev)
- **Frontend:** Vanilla JS (ES modules, AbortController, CSS nesting, oklch, Stylelint)
- **Testing:** Vitest + mongodb-memory-server + Supertest + jsdom
- **Linting:** ESLint 9 + @typescript-eslint + Stylelint
- **Deployment:** Docker Compose + Kubernetes + nginx + ghcr.io

## Getting Started

### Prerequisites

- Node.js >= 22
- Docker and Docker Compose

### Quick Start (Docker Compose)

```bash
git clone https://github.com/jorgeferrando/audio-api.git
cd audio-api

# One-button deploy + test
bash scripts/docker-deploy.sh    # Build and start all 7 services
bash scripts/docker-test.sh      # Run production smoke tests

# Open the web UI
open http://localhost:3000
```

The web UI includes a demo tone generator — no audio files needed to test.
No registry login required — everything runs locally.

### Development (without Docker for API/worker)

```bash
# Start only infrastructure
docker compose up -d mongodb redis rabbitmq minio nginx

# Copy environment variables
cp .env.example .env

# Run the API server (hot reload)
npm run dev

# Run the worker in a separate terminal (hot reload)
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
| `npm run lint`      | Run ESLint + Stylelint                |
| `npm run type-check`| Run TypeScript type checker           |

## Project Structure

```
src/
  domain/
    audio/          AudioTrack entity, IAudioTrackRepository port
    job/            ProcessingJob entity, IProcessingJobRepository port
  application/
    audio/          UploadAudio, GetAudioStatus, DownloadAudio, ListAudioTracks, DeleteAudio
    job/            ProcessJobUseCase, IJobPublisher, IAudioProcessor ports
    storage/        IFileStorage port
  infrastructure/
    audio/          FfmpegAudioProcessor, validateAudio (ffprobe)
    cache/          RedisCacheService
    db/             Mongoose models, repositories, connection
    http/           Express app setup, multer config
    logger/         WinstonLogger, ConsoleLogger
    queue/          RabbitMQ publisher, consumer (with graceful drain), setup
    storage/        MinioFileStorage
  presentation/
    controllers/    AudioController
    middlewares/    API key auth, audio validation, error handler
    public/         Web UI (HTML + CSS + 9 JS modules)
    routes/         Audio routes (paginated), health routes (liveness + readiness)
  shared/           Result, AppError, ILogger, ICacheService
nginx/              Reverse proxy config, Dockerfile, entrypoint
docs/
  decisions/        Architecture Decision Records (11 ADRs)
k8s/                Kubernetes manifests (7 files)
scripts/            Deploy and test scripts (Docker + K8s)
tests/
  integration/      MongoDB repository + HTTP integration tests
```

## Kubernetes

The `k8s/` directory contains tested manifests that deploy the full stack. Two scripts automate the workflow:

```bash
bash scripts/k8s-deploy.sh      # Build, push, deploy all manifests, wait for pods
bash scripts/k8s-test.sh        # Health + auth + upload + process + download + cleanup
```

Both scripts are cross-platform (Windows git bash, Linux, Mac).

**Prerequisites for K8s deploy:**
- Docker running + kubectl configured with a cluster (e.g. Docker Desktop with K8s enabled)
- Logged in to ghcr.io: `echo $(gh auth token) | docker login ghcr.io -u YOUR_USER --password-stdin`
- Requires GitHub token with `write:packages` scope: `gh auth refresh --hostname github.com --scopes write:packages`
- The container package must be **public** for K8s to pull without imagePullSecrets (set at GitHub package settings)

API and worker share the same Docker image but are deployed as **separate Deployments** with independent scaling:

| Deployment | Replicas | CPU | Memory | Entry point |
|---|---|---|---|---|
| `audio-api` | 2 | 100m - 500m | 128Mi - 512Mi | `src/index.ts` (default CMD) |
| `audio-worker` | 2 | 250m - 1000m | 256Mi - 1Gi | `npx tsx src/worker.ts` (command override) |

Storage uses MinIO (S3-compatible) — see [ADR 008](docs/decisions/008-minio-object-storage.md).
TLS in production via cert-manager + Ingress — see [ADR 011](docs/decisions/011-tls-in-production.md).

## Testing

```bash
npm test                    # 176+ tests
npm run test:coverage       # 85%+ statements, 91%+ branches
```

- **Unit tests:** co-located with implementation (`src/**/*.test.ts`)
- **Integration tests:** `tests/integration/` (mongodb-memory-server + Supertest)
- **Contract tests:** shared test suites for port implementations (ILogger)
- **Frontend tests:** DOM utilities and constants (`src/**/js/*.test.js`)
- **Smoke tests:** end-to-end via scripts (`scripts/docker-test.sh`, `scripts/k8s-test.sh`)

## License

MIT
