# ADR 005 - Cache en el Use Case, no en el Repositorio

## Status
Accepted

## Context
Al añadir Redis como capa de cache para `GetAudioStatusUseCase`, había que decidir
dónde colocar la lógica de cache: en el repositorio (transparente para el use case)
o en el use case mismo.

Dos patrones comunes:

**Repository Cache Pattern** — el repositorio comprueba cache antes de ir a la DB.
El use case no sabe que existe cache.

**Use Case Cache Pattern** — el use case gestiona explícitamente cache y DB.
El repositorio permanece puro (solo DB).

## Decision
La lógica de cache vive en el use case (`GetAudioStatusUseCase`), no en el repositorio.

## Consequences

**Por qué no en el repositorio:**

1. **El TTL depende de lógica de negocio.** Los estados terminales (`READY`, `FAILED`)
   son inmutables — se pueden cachear 5 minutos. Los estados en vuelo (`PENDING`,
   `PROCESSING`) cambian frecuentemente — máximo 5 segundos. Un repositorio no debería
   conocer estas reglas; pertenecen a la capa de aplicación.

2. **El repositorio solo puede cachear su propia entidad.** `GetAudioStatusUseCase`
   combina `AudioTrack` + `ProcessingJob` en un único DTO. Ningún repositorio
   individual puede cachear esa respuesta compuesta — solo el use case puede,
   porque es quien orquesta los dos.

3. **Viola SRP.** Un repositorio con cache hace dos cosas: persistencia y cache.
   Si el repositorio cachea, necesita un `ICacheService` como dependencia, lo que
   aumenta su superficie de responsabilidad sin beneficio claro.

**Consecuencias positivas:**
- El repositorio es puro: solo habla con MongoDB. Fácil de testear y razonar.
- La política de cache (TTL, qué cachear, cuándo invalidar) es explícita y
  co-localizada con la lógica de negocio que la motiva.
- El DTO cacheado es el mismo que devuelve el use case: sin transformaciones
  adicionales al leer de cache.

**Consecuencias negativas:**
- El use case tiene una dependencia más (`ICacheService`), lo que añade algo de
  complejidad al constructor y a los tests.
- Si otro use case necesita los mismos datos, la lógica de cache no se reutiliza
  automáticamente (habría que extraerla a un servicio de aplicación).
