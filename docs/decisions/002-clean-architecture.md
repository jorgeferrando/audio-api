# ADR 002 - Clean Architecture with Four Layers

## Status
Accepted

## Context
Backend Node.js projects often mix business logic with framework and database concerns,
making them hard to test and expensive to change (e.g. swapping MongoDB for PostgreSQL
requires touching business logic files).

## Decision
Organize code in four layers with a strict dependency rule: outer layers depend on inner
layers, never the other way around.

```
domain        ← pure business logic. No Node.js, no Express, no Mongoose.
application   ← use cases. Depends on domain + ports (interfaces).
infrastructure← implements ports. MongoDB, Redis, RabbitMQ, Express live here.
presentation  ← HTTP layer. Controllers, routes, middlewares.
```

Interfaces (Ports) are defined in `shared/` or `domain/` and implemented in `infrastructure/`.
This means the domain never imports from infrastructure — it only knows the interface.

## Consequences
- **Positive:** Domain and application layers are 100% unit-testable without a real DB or queue.
- **Positive:** Infrastructure is swappable (e.g. `WinstonLogger` → `DatadogLogger`) by
  changing only the composition root (`index.ts`).
- **Positive:** Business rules are explicit and isolated — easy to understand and change.
- **Negative:** More files and indirection than a flat structure.
- **Negative:** Requires discipline to not leak infrastructure concerns into domain.
