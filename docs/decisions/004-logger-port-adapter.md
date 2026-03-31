# ADR 004 - ILogger as Port, Multiple Adapters

## Status
Accepted

## Context
Logging implementations vary by environment: structured JSON for production observability
tools (Datadog, GCP Logging), human-readable colored output for local development.
Future requirements may add a third-party logging service via API.

## Decision
Define `ILogger` as a Port (interface) in `shared/`. Implement concrete adapters in
`infrastructure/logger/`:
- `WinstonLogger` — dev (pretty print + colors) and prod (JSON)
- `ConsoleLogger` — lightweight fallback, useful in tests

Inject logger via constructor throughout the codebase. No global singleton.

New adapters (e.g. `DatadogLogger`) implement `ILogger` and must pass
`testLoggerContract()` to guarantee behavioral compatibility.

## Consequences
- **Positive:** Swap logging implementation by changing one line in `index.ts`.
- **Positive:** Contract tests enforce LSP — any `ILogger` implementation is substitutable.
- **Positive:** Domain and application layers have zero dependency on Winston.
- **Negative:** Constructor injection means every class that logs must receive a logger.
  Mitigated by wiring everything in the composition root.
