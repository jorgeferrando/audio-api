# ADR 006 - Saga Compensation Pattern en ProcessJobUseCase

## Status
Accepted

## Context
`ProcessJobUseCase` necesita mantener dos entidades consistentes — `ProcessingJob`
y `AudioTrack` — a través de varias operaciones de persistencia secuenciales.
El flujo feliz es: ambas transicionan a PROCESSING, se procesan, ambas transicionan
a COMPLETED/READY.

El problema: sin una transacción distribuida, un fallo a mitad del flujo puede
dejar las entidades en estados inconsistentes (e.g. job COMPLETED en memoria pero
PROCESSING en DB, audio aún en PROCESSING).

MongoDB ofrece transacciones multi-documento desde la versión 4, pero añaden
complejidad de sesión, latencia, y no cubren el caso donde el fallo ocurre
*después* de que la lógica de dominio ya mutó las entidades en memoria.

## Decision
Aplicar el **patrón Saga con compensación local**: si cualquier operación falla
después de que ambas entidades están en PROCESSING en DB, se ejecutan acciones
compensatorias que las marcan como FAILED.

```
PENDING ──► PROCESSING ──► COMPLETED   ← flujo feliz
                  │
                  └──► FAILED           ← compensación si falla algo post-PROCESSING
```

La compensación usa `reconstitute()` para crear entidades frescas en estado
PROCESSING (el último estado persistido confirmado), ya que las entidades originales
pueden haber sido mutadas en memoria a COMPLETED/READY y la máquina de estados
rechazaría una transición directa a FAILED desde esos estados.

## Consequences

**Positivo:**
- Las entidades nunca quedan atascadas en PROCESSING indefinidamente.
- El estado en DB es siempre interpretable: PENDING (en cola), PROCESSING (worker
  activo), COMPLETED/READY (terminado), FAILED (error conocido).
- Sin dependencia de transacciones MongoDB — la lógica de compensación es explícita
  y testeable en aislamiento.

**Negativo:**
- La compensación es *best-effort*: si el propio save de FAILED falla, las entidades
  quedan en PROCESSING en DB. Mitigado por RabbitMQ: si el worker no hace `ack`,
  el mensaje se reencola o va al DLQ para reintento manual.
- No es atómica: hay una ventana entre el fallo y la compensación donde el estado
  es transitoriamente inconsistente. Aceptable para este dominio (no es finanzas).

**Alternativas descartadas:**
- *Transacciones MongoDB*: añaden sesión y latencia; no cubren el fallo después
  de mutar entidades en memoria.
- *Eventos de dominio + rollback*: más correcto en DDD puro, pero sobreingeniería
  para el scope de este proyecto (YAGNI).
