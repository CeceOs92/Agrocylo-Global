# ADR: Marketplace/Production-Escrow Backend Unification

Status: **Accepted**
Issue: #746 (supersedes the half-finished bridging that caused the dangling
`Campaign.products` relation, tracked as "Issue 1" in that issue's history)

## Context

Two independent Node/Express + Prisma backends exist:

- `server/` — marketplace (`server/prisma/schema.prisma`), database `agrocylo_db`.
- `agro-production/server/` — campaigns/investment/escrow
  (`agro-production/server/prisma/schema.prisma`), database `agrocylo_production`.

Both already model identity independently: each has its own `User` model
keyed on `walletAddress String @unique`, with different `role` enums and no
foreign key between them (they're separate Postgres databases — a real FK
is not possible). Someone began bridging the two by adding a
`products Product[]` relation onto `agro-production`'s `Campaign` model,
pointing at `Product`, a model that only exists in the *other* schema's
database. Prisma cannot validate a relation across two independent
datasources; this was dead code (nothing in `agro-production/server/src`
ever referenced `campaign.products`) that would fail `prisma generate`/
`prisma migrate` the moment anyone tried to use it for real.

## Decision

**(b) Keep the databases separate. `walletAddress` is the canonical,
already-in-use cross-service identity key — formalize it as the only
sanctioned way to join marketplace and production-escrow data, and
explicitly forbid direct Prisma `@relation` fields across the two schema
files.**

Full convergence onto one database (option a) was rejected for this pass:
it requires reconciling two independently-evolved `User`/role models, a
tested migration + backfill against both live datasets, and a rollback
plan — a large, high-risk change disproportionate to what's actually
blocking today (a dead field), and not something to attempt as a rider on
removing dead code. Scoping the two backends as fully uncoupled (option c)
was also rejected: real cross-service features are already wanted (a
farmer's marketplace reputation informing campaign trust; a harvested
campaign becoming sellable marketplace inventory), so an explicit "no
coupling allowed" rule would just be re-litigated the next time someone
needs it, the same pressure that produced the broken relation in the first
place.

### Rules going forward

1. **No Prisma relation field may span `server/prisma/schema.prisma` and
   `agro-production/server/prisma/schema.prisma`.** If a model needs to
   reference an entity owned by the other backend, store the natural key
   (`walletAddress`, or the other side's `id` as an opaque string) as a
   plain scalar field — never a `@relation`.
2. **`walletAddress` is the join key.** Any code needing both a farmer's
   marketplace and campaign identity queries both Prisma clients
   independently by `walletAddress` and joins in application code (or via a
   read-side aggregation service, if/when that becomes a bottleneck) — never
   via a database-level join.
3. **Each backend owns its own `role`/profile semantics.** No attempt to
   unify the `role` enums; a wallet can be a marketplace `BUYER` and a
   production `INVESTOR` simultaneously, and that's a legitimate, expected
   state, not a data-quality bug.
4. Cross-service features (e.g. "marketplace reputation feeds campaign
   trust") are implemented as an explicit service-to-service call or a
   dedicated read-model, proposed and reviewed on their own merits — not
   bolted on as a schema relation because it's the field that happened to
   need it next.

## Consequences

- The dangling `Campaign.products` relation is removed (see companion PR);
  it had no callers.
- Future PRs adding cross-backend features must query-and-join by
  `walletAddress` in application code; a PR adding a cross-schema
  `@relation` should be rejected in review with a pointer to this ADR.
- If cross-service query volume ever justifies it, a dedicated read-model /
  cache table keyed on `walletAddress` (populated by an event or batch job,
  not a live FK) is the next escalation — still not full convergence.
