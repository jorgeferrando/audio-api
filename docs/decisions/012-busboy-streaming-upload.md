# ADR 012 — Replace multer with busboy for streaming uploads

## Status

Accepted

## Context

The audio file was being read multiple times during the upload path:

1. **Multer** received the HTTP multipart stream and wrote it to a temp file on disk.
2. **ffprobe validation middleware** read the entire temp file to verify it contained audio data.
3. **AudioController** created a `ReadStream` from the temp file and streamed it to MinIO.

Three full reads of potentially 50MB files, plus disk I/O for a temp file that was immediately deleted. This didn't leverage Node.js streams, the core strength of the platform.

Additionally, the worker's `ProcessJobUseCase` used `readFile()` to buffer the entire processed file into RAM before uploading to MinIO.

## Decision

### Replace multer with busboy

Multer wraps busboy internally but consumes the file stream before handing control to the route handler. Busboy exposes the raw `Readable` stream for each multipart file, enabling:

- **Direct streaming** from HTTP request to MinIO — zero temp files, zero disk reads.
- **Early rejection** by reading only the first 12 bytes (magic bytes) before accepting the rest of the stream.
- **Abort capability** — if validation fails, the connection can be terminated without receiving the full payload.

### Replace ffprobe validation with magic bytes detection

Instead of spawning an ffprobe child process that reads the entire file, we check the first 12 bytes against known audio file signatures:

| Format | Signature |
|--------|-----------|
| WAV    | `RIFF` (0-3) + `WAVE` (8-11) |
| MP3    | `ID3` (ID3v2 tag) or `0xFF 0xFB/F3/F2` (MPEG sync) |
| OGG    | `OggS` (0-3) |
| FLAC   | `fLaC` (0-3) |
| AAC    | `0xFF 0xF1/F9` (ADTS header) |
| WebM   | `0x1A 0x45 0xDF 0xA3` (EBML) |

This runs in microseconds with zero I/O, and the same validation runs in the browser before the upload even starts.

### Stream processed file upload in worker

Replaced `readFile(tempOutput)` with `createReadStream(tempOutput)` in `ProcessJobUseCase` to avoid buffering the entire processed file in RAM.

## Consequences

### Positive

- **Upload path**: 3 file reads → 0 file reads. The HTTP stream flows directly to MinIO.
- **No temp files**: eliminates disk I/O and cleanup logic on the upload path.
- **Early fail**: invalid files are rejected after 12 bytes instead of after receiving the full payload.
- **Frontend validation**: users get instant feedback before the upload starts.
- **Worker memory**: processed files are streamed to MinIO instead of buffered.
- **Fewer dependencies**: busboy was already a transitive dependency of multer.

### Negative

- Magic bytes detection is less thorough than ffprobe — it confirms the file *starts like* an audio file, not that it's fully valid. However, the worker's ffmpeg processing will catch truly corrupt files.
- The busboy middleware is more code than the multer one-liner, though the complexity is justified by the streaming capability.

### Trade-offs

- The `Content-Length` header from the multipart request is not the exact file size (it includes boundaries and headers). The `size` passed to MinIO is approximate. MinIO handles this gracefully — it uses chunked transfer if the size doesn't match.
