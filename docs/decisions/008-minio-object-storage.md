# ADR 008 - MinIO Object Storage instead of Local Disk

## Status
Accepted

## Context
The system originally stored audio files on local disk via multer
(`uploads/originals/`, `uploads/processed/`). API and worker shared a Docker
volume (`uploads_data`) and in K8s a PVC with `ReadWriteMany`.

Problem: with multiple replicas, the pod that receives the upload may not be the
one that serves the download. `ReadWriteMany` is not available on most
cloud providers (EBS, hostPath). This causes intermittent failures with no obvious
error — the worst kind of bug in production.

## Decision
Migrate file storage to **MinIO**, an S3-compatible object storage that runs
as an independent service. All pods read/write from the same MinIO.

**Flow after migration:**
1. Upload: multer `memoryStorage` → buffer in RAM → `IFileStorage.upload()` → MinIO
2. Worker: `IFileStorage.download()` → temp file → ffmpeg → `IFileStorage.upload()` → MinIO → cleanup temp
3. Download: `IFileStorage.download()` → stream from MinIO → HTTP response

## Consequences

**Positive:**
- Eliminates the multi-replica split-brain — all pods access the same storage.
- The `IFileStorage` port allows switching to S3 or GCS without touching domain or application.
- No PVC or shared volume needed — simplifies K8s manifests.
- MinIO runs in Docker for dev; in production it migrates to GCS/S3 by changing only
  the port implementation.

**Negative:**
- The worker needs to download the file to a local temp for ffmpeg (ffmpeg does not
  support S3 streams). Adds download + upload latency.
- In-memory buffer for upload (multer memoryStorage) — with 50MB files, each
  request consumes 50MB of RAM. Acceptable for the expected volume; in production
  with high traffic, direct streaming to MinIO with multer-s3 would be used.
- MinIO is one more service to maintain (Docker container, healthcheck, volume).

**Discarded alternatives:**
- *NFS/EFS for PVC ReadWriteMany*: adds infrastructure complexity and is not portable
  across cloud providers.
- *Direct streaming to MinIO without buffer*: requires multer-s3 or similar, more complex
  to implement and test. YAGNI for the current scope.
