# Implementation Plan (Repo-Verified): Blockchain Event Indexing

## Objective
Convert raw blockchain events into structured application data with the fields required by the issue:
- `order_id`
- `buyer`
- `seller`
- `amount`
- `token`
- `timestamp`
- `status`

Acceptance criterion:
- Events are correctly mapped to database models.

---

## Current State (Verified in this repo)

1. `server/src/services/contractWatcher.ts` exists and already polls Soroban events.
2. Watcher currently decodes events and writes to `Notification` only.
3. Current Prisma schema (`server/prisma/schema.prisma`) contains only:
  - `Notification`
4. There is no existing Prisma model yet for escrow event indexing/order projection.
5. Event actions currently handled in watcher logic are:
  - `created`
  - `confirmed`
  - `refunded`

---

## Guardrails (to avoid hallucinations)

- Do not assume extra statuses beyond what contract emits today.
- Do not assume existing order/event DB tables; add only what is required.
- Do not assume specific event cursor fields unless confirmed from runtime event object.
- Keep parser/mapping logic aligned with actual decoded `event.value` structure from watcher.

---

## Target Architecture (Clean + Minimal)

We keep a small, testable pipeline:

1. **Source** (`contractWatcher.ts`)
  - Fetches raw events.

2. **Parser** (new)
  - Converts raw Soroban event object into typed intermediate shape.

3. **Mapper/Validator** (new)
  - Extracts required issue fields.
  - Validates required fields are present and minimally correct.

4. **Repository** (new)
  - Persists mapped event to DB model(s).
  - Handles duplicate/replay behavior via unique key.

5. **Orchestrator** (new)
  - Coordinates parse → map → persist.
  - Logs success/failure per event.

This avoids redundant abstractions and keeps responsibilities clear.

---

## File Plan (Concrete)

### New files
1. `server/src/types/escrowEvent.ts`
  - Typed interfaces for parsed and mapped event payloads.

2. `server/src/services/events/escrowEventParser.ts`
  - Pure parsing utilities for watcher raw event.

3. `server/src/services/events/escrowEventMapper.ts`
  - Maps parsed payload to canonical fields required by the issue.

4. `server/src/services/events/escrowEventRepository.ts`
  - DB persistence methods.

5. `server/src/services/events/escrowEventIngestionService.ts`
  - Orchestrates end-to-end ingestion for each raw event.

### Updated files
1. `server/src/services/contractWatcher.ts`
  - Replace inline business logic with call to ingestion service.

2. `server/prisma/schema.prisma`
  - Add minimal model(s) needed to store mapped event fields.

---

## Database Plan (Minimal required)

Since only `Notification` exists now, introduce a minimal event index model (name can be `EscrowEvent`):

Required columns:
- `id` (uuid)
- `orderId` (string)
- `buyer` (string)
- `seller` (string)
- `amount` (string/numeric text-safe)
- `token` (string)
- `timestamp` (DateTime)
- `status` (string)
- `createdAt` (DateTime default now)

Idempotency columns (final choice depends on confirmed event metadata available at runtime):
- Option A: `ledger` + `eventIndex`
- Option B: `txHash` + `eventIndex`
- Option C: normalized deterministic hash of raw event

Add unique index using whichever cursor fields are actually present in watcher event object.

---

## Mapping Spec (Verified-safe)

Map only these status values initially (because they are present today):
- `created`
- `confirmed`
- `refunded`

Field extraction source:
- `status`: from decoded event topic/action
- `order_id`, `buyer`, `seller`, `amount`, `token`: from decoded `event.value` payload structure
- `timestamp`: from event metadata timestamp if available, otherwise ingestion timestamp (explicitly documented)

Important: before implementation, print/log one sample decoded event in non-production mode to freeze exact payload offsets/keys.

---

## Complexity Design

Let $n$ be number of events and $m$ be average decoded fields per event.

- Parse + map: $O(n \cdot m)$ time, $O(1)$ extra space per event in streaming mode.
- Persist: $O(n)$ writes.

Recommended approach:
- Keep current polling approach.
- Process each event in a streaming loop (no large in-memory batching).

---

## Error Handling + Reliability

1. Validation failure (missing required field):
  - Log structured error.
  - Skip event (do not crash watcher loop).

2. Duplicate event:
  - Rely on DB unique key and treat unique violation as safe no-op.

3. DB transient failure:
  - Retry with bounded backoff (e.g., max 3 attempts).

4. Watcher loop resilience:
  - Keep existing try/catch boundary around polling cycle.

---

## Testing Plan (Repo-aligned)

Do **not** use existing `routes/api.integration.test.ts` for this feature (it covers product/cart APIs).

Add focused tests:

1. `server/src/services/events/escrowEventParser.test.ts`
  - raw event → parsed shape

2. `server/src/services/events/escrowEventMapper.test.ts`
  - parsed shape → required issue fields

3. `server/src/services/events/escrowEventIngestionService.test.ts`
  - end-to-end mapping + repository call
  - duplicate handling behavior

Acceptance assertion in tests:
- persisted record contains correct `order_id`, `buyer`, `seller`, `amount`, `token`, `timestamp`, `status`.

---

## Step-by-Step Execution

1. Add Prisma model + migration for minimal escrow event index table.
2. Add typed event contracts.
3. Implement parser (no side effects).
4. Implement mapper/validator for required fields.
5. Implement repository with unique key enforcement.
6. Implement ingestion orchestrator.
7. Wire `contractWatcher.ts` to ingestion service.
8. Add unit/service tests.
9. Run build/tests and fix failures.

---

## Definition of Done

- [ ] All 7 required fields parsed and persisted.
- [ ] Mapping reflects actual on-chain payload shape (not assumptions).
- [ ] Duplicate event replay does not create duplicate DB rows.
- [ ] Watcher remains stable on malformed events.
- [ ] Tests cover happy path + duplicate + malformed event.
- [ ] Build and tests pass.

---

## Explicitly Deferred (until verified)

- Additional status enums beyond `created/confirmed/refunded`.
- Final idempotency key format until runtime event cursor fields are confirmed.
- Any order-state transition rules not defined by current contract events.
