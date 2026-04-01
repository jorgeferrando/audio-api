# ADR 006 - Saga Compensation Pattern in ProcessJobUseCase

## Status
Accepted

## Context
`ProcessJobUseCase` needs to keep two entities consistent — `ProcessingJob`
and `AudioTrack` — across several sequential persistence operations.
The happy path is: both transition to PROCESSING, they are processed, both transition
to COMPLETED/READY.

The problem: without a distributed transaction, a failure mid-flow can
leave the entities in inconsistent states (e.g. job COMPLETED in memory but
PROCESSING in DB, audio still in PROCESSING).

MongoDB offers multi-document transactions since version 4, but they add
session complexity, latency, and do not cover the case where the failure occurs
*after* the domain logic has already mutated the entities in memory.

## Decision
Apply the **Saga pattern with local compensation**: if any operation fails
after both entities are in PROCESSING in DB, compensating actions are executed
to mark them as FAILED.

```
PENDING ──► PROCESSING ──► COMPLETED   ← happy path
                  │
                  └──► FAILED           ← compensation if something fails post-PROCESSING
```

The compensation uses `reconstitute()` to create fresh entities in PROCESSING
state (the last confirmed persisted state), since the original entities
may have been mutated in memory to COMPLETED/READY and the state machine
would reject a direct transition to FAILED from those states.

## Consequences

**Positive:**
- Entities never get stuck in PROCESSING indefinitely.
- The state in DB is always interpretable: PENDING (queued), PROCESSING (active
  worker), COMPLETED/READY (finished), FAILED (known error).
- No dependency on MongoDB transactions — the compensation logic is explicit
  and testable in isolation.

**Negative:**
- The compensation is *best-effort*: if the FAILED save itself fails, the entities
  remain in PROCESSING in DB. Mitigated by RabbitMQ: if the worker does not `ack`,
  the message is requeued or goes to the DLQ for manual retry.
- It is not atomic: there is a window between the failure and the compensation where
  the state is transiently inconsistent. Acceptable for this domain (it is not finance).

**Discarded alternatives:**
- *MongoDB transactions*: add session and latency; do not cover failure after
  mutating entities in memory.
- *Domain events + rollback*: more correct in pure DDD, but over-engineering
  for the scope of this project (YAGNI).
