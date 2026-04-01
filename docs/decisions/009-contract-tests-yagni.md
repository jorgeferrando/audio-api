# ADR 009 - Contract Tests solo para Ports con Múltiples Implementaciones

## Status
Accepted

## Context
El proyecto tiene 7 ports (interfaces): ILogger, IFileStorage, ICacheService,
IAudioTrackRepository, IProcessingJobRepository, IAudioProcessor, IJobPublisher.

Solo ILogger tiene contract tests compartidos (`loggerContract.ts`), porque es
el único port con dos implementaciones (WinstonLogger + ConsoleLogger). Los
demás ports tienen una sola implementación cada uno.

Una revisión externa señaló que sin contract tests en todos los ports, un nuevo
adaptador podría derivar del comportamiento esperado sin que los tests lo detecten.

## Decision
Aplicar YAGNI: solo crear contract tests cuando un port tenga más de una
implementación. Con una sola implementación, los tests unitarios y de integración
de esa implementación son el contract test de facto.

## Consequences

**Positivo:**
- Menos código de test que mantener sin beneficio real.
- Cuando se añada una segunda implementación (e.g. `S3FileStorage` para
  `IFileStorage`), el contract test se crea en ese momento con conocimiento
  real de qué comportamientos importa verificar — no especulativamente.

**Negativo:**
- Si alguien añade una segunda implementación sin crear el contract test,
  puede haber divergencia de comportamiento. Mitigado por code review.

**Candidatos futuros:**
- `IFileStorage` es el port con más probabilidad de tener una segunda
  implementación (MinIO en dev, S3/GCS en producción). Cuando eso ocurra,
  crear `fileStorageContract.ts` siguiendo el patrón de `loggerContract.ts`.
