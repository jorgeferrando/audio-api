# ADR 008 - MinIO Object Storage en vez de Disco Local

## Status
Accepted

## Context
El sistema originalmente almacenaba ficheros de audio en disco local vía multer
(`uploads/originals/`, `uploads/processed/`). API y worker compartían un volumen
Docker (`uploads_data`) y en K8s un PVC con `ReadWriteMany`.

Problema: con múltiples réplicas, el pod que recibe el upload puede no ser el
que sirve el download. `ReadWriteMany` no está disponible en la mayoría de
providers de cloud (EBS, hostPath). Esto causa fallos intermitentes sin error
obvio — el peor tipo de bug en producción.

## Decision
Migrar el file storage a **MinIO**, un object storage S3-compatible que corre
como servicio independiente. Todos los pods leen/escriben del mismo MinIO.

**Flujo después de la migración:**
1. Upload: multer `memoryStorage` → buffer en RAM → `IFileStorage.upload()` → MinIO
2. Worker: `IFileStorage.download()` → temp file → ffmpeg → `IFileStorage.upload()` → MinIO → cleanup temp
3. Download: `IFileStorage.download()` → stream desde MinIO → HTTP response

## Consequences

**Positivo:**
- Elimina el split-brain de multi-réplica — todos los pods acceden al mismo storage.
- El Port `IFileStorage` permite cambiar a S3 o GCS sin tocar dominio ni aplicación.
- No se necesita PVC ni volumen compartido — simplifica los manifests de K8s.
- MinIO corre en Docker para dev, en producción se migra a GCS/S3 cambiando solo
  la implementación del port.

**Negativo:**
- El worker necesita descargar el fichero a un temp local para ffmpeg (ffmpeg no
  soporta streams S3). Añade latencia de descarga + subida.
- Buffer en memoria para upload (multer memoryStorage) — con ficheros de 50MB, cada
  request consume 50MB de RAM. Aceptable para el volumen esperado; en producción
  con alto tráfico, se usaría streaming directo a MinIO con multer-s3.
- MinIO es un servicio más que mantener (Docker container, healthcheck, volumen).

**Alternativas descartadas:**
- *NFS/EFS para PVC ReadWriteMany*: añade complejidad de infra y no es portable
  entre providers de cloud.
- *Streaming directo a MinIO sin buffer*: requiere multer-s3 o similar, más complejo
  de implementar y testear. YAGNI para el scope actual.
