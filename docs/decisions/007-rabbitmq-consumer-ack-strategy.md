# ADR 007 - RabbitMQ Consumer: Prefetch 1 y Nack sin Reencolar

## Status
Accepted

## Context
El worker consume mensajes de `audio.jobs` y los procesa con `ProcessJobUseCase`.
Hay dos decisiones operativas que afectan al comportamiento del consumer en producción:
cómo de agresivo es recibiendo mensajes (prefetch) y qué hace cuando un mensaje falla
(ack/nack strategy).

## Decision

### Prefetch 1
El consumer establece `channel.prefetch(1)`: el broker solo envía un mensaje al worker
hasta que este haga ack del anterior.

### Nack sin reencolar → DLQ
Cuando `ProcessJobUseCase` retorna error, o el mensaje tiene formato inválido, se llama
`channel.nack(msg, false, false)` — el tercer argumento `false` impide el reencole.
La configuración de la cola (`x-dead-letter-routing-key: audio.dlq`) mueve el mensaje
automáticamente al Dead Letter Queue.

## Consequences

**Por qué prefetch 1:**
- El procesamiento de audio es intensivo en CPU/IO y tiene duración variable.
  Con prefetch alto, un worker lento acumularía mensajes que otros workers podrían
  procesar — el broker no puede redistribuirlos si ya los entregó.
- Simplifica el razonamiento sobre carga: un worker = un job activo en todo momento.
- Si el throughput es insuficiente, se escalan los workers (más instancias),
  no el prefetch.

**Por qué nack sin reencolar:**
- Reencolar un mensaje que falla por datos corruptos o bug determinista crea
  un bucle infinito: el mensaje vuelve a la cabeza de la cola y falla de nuevo
  inmediatamente, bloqueando a otros mensajes.
- El DLQ permite inspección manual y reintento controlado cuando el problema
  esté resuelto (e.g. tras un fix del bug, se mueven los mensajes del DLQ
  de vuelta a `audio.jobs`).
- RabbitMQ también permite configurar `x-message-ttl` y `x-max-retries` en el
  DLQ para reintentos automáticos con backoff — extensión natural si se necesita.

**Mensajes null:**
RabbitMQ envía `null` al callback cuando el broker cancela el consumer
(e.g. la cola es eliminada). Se ignoran explícitamente — no hay mensaje que
ackear ni nackear.

**Consecuencias negativas:**
- Prefetch 1 limita el throughput por worker. Para audio.jobs con procesamiento
  rápido, un prefetch mayor sería más eficiente. Ajustar si el profiling lo indica.
- Sin reintento automático, un fallo transitorio (red, DB caída momentáneamente)
  manda el mensaje al DLQ en vez de reintentarlo. Mitigación: añadir lógica de
  retry con backoff exponencial antes del nack final (fuera del scope actual).

## DLQ recovery strategy

Los mensajes en `audio.dlq` no se reintentan automáticamente. El flujo de
recuperación previsto es:

1. **Monitorización:** alertar cuando `audio.dlq` tiene mensajes (via RabbitMQ
   management API o Prometheus exporter).
2. **Inspección:** revisar manualmente el contenido del mensaje y los logs del
   worker para identificar la causa del fallo.
3. **Reintento manual:** una vez corregido el problema, mover los mensajes del
   DLQ de vuelta a `audio.jobs` (`rabbitmqadmin` o script dedicado).
4. **Notificación al cliente:** el endpoint `GET /audio/:id` devuelve `status: FAILED`
   con el error message del job, para que el cliente sepa que su audio no se procesó.

**Extensiones futuras (fuera del scope actual):**
- Retry automático con backoff exponencial (TTL + re-routing en RabbitMQ).
- Webhook de notificación al cliente cuando un job falla.
