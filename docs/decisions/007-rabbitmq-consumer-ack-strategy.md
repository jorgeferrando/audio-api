# ADR 007 - RabbitMQ Consumer: Prefetch 1 and Nack without Requeue

## Status
Accepted

## Context
The worker consumes messages from `audio.jobs` and processes them with `ProcessJobUseCase`.
There are two operational decisions that affect the consumer's behavior in production:
how aggressively it receives messages (prefetch) and what it does when a message fails
(ack/nack strategy).

## Decision

### Prefetch 1
The consumer sets `channel.prefetch(1)`: the broker only sends one message to the worker
until it acks the previous one.

### Nack without requeue → DLQ
When `ProcessJobUseCase` returns an error, or the message has an invalid format,
`channel.nack(msg, false, false)` is called — the third `false` argument prevents requeueing.
The queue configuration (`x-dead-letter-routing-key: audio.dlq`) automatically moves
the message to the Dead Letter Queue.

## Consequences

**Why prefetch 1:**
- Audio processing is CPU/IO intensive and has variable duration.
  With a high prefetch, a slow worker would accumulate messages that other workers could
  process — the broker cannot redistribute them if it has already delivered them.
- Simplifies reasoning about load: one worker = one active job at all times.
- If throughput is insufficient, workers are scaled (more instances),
  not the prefetch.

**Why nack without requeue:**
- Requeueing a message that fails due to corrupt data or a deterministic bug creates
  an infinite loop: the message goes back to the head of the queue and fails again
  immediately, blocking other messages.
- The DLQ allows manual inspection and controlled retry when the problem
  is resolved (e.g. after a bug fix, messages are moved from the DLQ
  back to `audio.jobs`).
- RabbitMQ also allows configuring `x-message-ttl` and `x-max-retries` on the
  DLQ for automatic retries with backoff — a natural extension if needed.

**Null messages:**
RabbitMQ sends `null` to the callback when the broker cancels the consumer
(e.g. the queue is deleted). They are explicitly ignored — there is no message to
ack or nack.

**Negative consequences:**
- Prefetch 1 limits throughput per worker. For audio.jobs with fast processing,
  a higher prefetch would be more efficient. Adjust if profiling indicates so.
- Without automatic retry, a transient failure (network, DB momentarily down)
  sends the message to the DLQ instead of retrying it. Mitigation: add retry logic
  with exponential backoff before the final nack (out of current scope).

## DLQ recovery strategy

Messages in `audio.dlq` are not automatically retried. The intended recovery
flow is:

1. **Monitoring:** alert when `audio.dlq` has messages (via RabbitMQ
   management API or Prometheus exporter).
2. **Inspection:** manually review the message content and worker logs
   to identify the cause of the failure.
3. **Manual retry:** once the problem is fixed, move messages from the
   DLQ back to `audio.jobs` (`rabbitmqadmin` or a dedicated script).
4. **Client notification:** the `GET /audio/:id` endpoint returns `status: FAILED`
   with the job's error message, so the client knows their audio was not processed.

**Future extensions (out of current scope):**
- Automatic retry with exponential backoff (TTL + re-routing in RabbitMQ).
- Webhook notification to the client when a job fails.
