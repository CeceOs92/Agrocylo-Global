# Database Production Readiness

## Overview

This document covers connection pooling, proposed indexes, load-test extension, and SLOs for the Agrocylo backend database at mainnet volume.

**Status:** Scaffolding complete. Actual query-plan validation and load-test results require real execution (see [Execution Required](#execution-required) below).

## Connection Pooling

### Recommended Configuration

For production deployments, use **PgBouncer** as a connection pooler between the application and PostgreSQL:

#### PgBouncer Configuration

```ini
[databases]
agrocylo_prod = host=db.internal port=5432 dbname=agrocylo

[pgbouncer]
pool_mode = transaction
max_client_conn = 1000
max_db_connections = 100
default_pool_size = 20
min_pool_size = 10
reserve_pool_size = 5
reserve_pool_timeout = 3s
server_idle_timeout = 600s
server_lifetime = 3600s
```

**Rationale:**

- **pool_mode = transaction:** Reduces lock contention for short-lived OLTP queries; Prisma works well with this mode.
- **max_client_conn = 1000:** Supports up to 1000 concurrent application connections (reasonable for a 10-instance Kubernetes deployment with 100 VUs per instance).
- **max_db_connections = 100:** Actual PostgreSQL connection limit; avoids the "too many connections" error. Tune based on PostgreSQL `max_connections` setting (typically 100–200 for managed databases).
- **default_pool_size = 20:** Each slot gets 20 connections; total ~100 when 5 client slots are active.
- **server_idle_timeout = 600s:** Recycles idle backend connections after 10 minutes to prevent stale connection states.

### Prisma Connection Pool Configuration

In `.env.production`:

```env
DATABASE_URL="postgresql://user:pass@pgbouncer-host:6432/agrocylo"
PRISMA_CLIENT_ENGINE_TYPE=library
```

Prisma's built-in connection pool (when using `@prisma/client@5+`) manages 10–20 connections by default, which works well behind PgBouncer in transaction pooling mode.

### Connection Pool Monitoring

- Monitor PgBouncer stats: `SHOW STATS;` and `SHOW CLIENTS;` via `psql -d pgbouncer`.
- Alert on:
  - `max_client_conn` breaches → scale application or pooler.
  - Average transaction duration > 1s → may indicate slow queries or lock contention.
  - Idle server connections > 50% → reduce `reserve_pool_size` or `default_pool_size`.

## Proposed Indexes

The following indexes are proposed based on the three risky query shapes identified in the issue:

### 1. Campaign Listing with Pagination + Aggregate Joins

**Query Pattern:**

```sql
SELECT c.* FROM campaigns c
  LEFT JOIN investments i ON i.campaign_id_on_chain = c.campaign_id_on_chain
  WHERE c.status = 'Active'
  ORDER BY c.created_at DESC
  LIMIT 20 OFFSET 0;
```

**Proposed Index:**

```sql
CREATE INDEX idx_campaigns_status_created_desc
  ON campaigns (status, created_at DESC)
  WHERE status IN ('Active', 'FUNDING', 'FUNDED', 'IN_PRODUCTION', 'HARVESTED');
```

**Rationale:** Enables index-only scans for status filtering + sorted pagination. The partial index filters to active statuses, reducing index size.

### 2. Investment Lookups by investorAddress Across Campaigns

**Query Pattern:**

```sql
SELECT i.* FROM investments i
  WHERE i.investor_address = $1
  ORDER BY i.created_at DESC
  LIMIT 50;
```

**Proposed Index:**

```sql
CREATE INDEX idx_investments_investor_address_created_desc
  ON investments (investor_address, created_at DESC);
```

**Rationale:** Enables fast lookups by investor wallet and efficient ordered retrieval. Covers both the WHERE clause and ORDER BY for an index-only scan.

### 3. Watcher's Per-Event findUnique on `@@unique([ledger, eventIndex])`

**Query Pattern:**

```sql
SELECT * FROM transactions
  WHERE ledger = $1 AND event_index = $2;
```

**Current Index:** Already defined as `@@unique([ledger, eventIndex])` in Prisma schema.

**Verification:**

- This unique constraint automatically creates an index, so no additional index is needed.
- Query plan should show `Index Only Scan` using the unique index.
- Monitor for index bloat if the `transactions` table grows rapidly (run `REINDEX` monthly or configure autovacuum `INDEX_CLEANUP` to `auto`).

**Recommended Check:**

```sql
-- In production, run monthly:
EXPLAIN ANALYZE
SELECT * FROM transactions
  WHERE ledger = $1 AND event_index = $2;

-- Should show: "Index Only Scan using transactions_ledger_event_index_key"
-- with zero Heap Fetches (if full index coverage).
```

### Migration File

Create `server/prisma/migrations/<timestamp>_production_indexes/migration.sql`:

```sql
-- Add index for campaign listing with pagination
CREATE INDEX IF NOT EXISTS idx_campaigns_status_created_desc
  ON campaigns (status, created_at DESC)
  WHERE status IN ('Active', 'FUNDING', 'FUNDED', 'IN_PRODUCTION', 'HARVESTED');

-- Add index for investment lookups by investor address
CREATE INDEX IF NOT EXISTS idx_investments_investor_address_created_desc
  ON investments (investor_address, created_at DESC);

-- Verify unique constraint on transactions (already exists from schema)
-- SELECT constraint_name FROM information_schema.table_constraints
-- WHERE table_name = 'transactions' AND constraint_type = 'UNIQUE';
```

## Load-Test Harness Extension

### New Scenario: `concurrent-read-write.js`

This scenario simulates realistic production load: simultaneous read-heavy browsing (campaign listing with pagination) and write-heavy indexing (sustained event throughput from the Stellar contract watcher).

**Location:** `load-test/scenarios/concurrent-read-write.js`

**Test Profile:**

- **50 VUs** browsing campaigns (GET /campaigns with pagination, aggregates)
- **20 VUs** simulating indexer writes (POST /transactions, creating BlockchainTransaction records)
- **Duration:** 5 minutes (smoke) / 30 minutes (soak)
- **Assertions:**
  - Read-path p95 latency < 500 ms
  - Write-path p95 latency < 200 ms
  - Error rate < 1%
  - No transaction deadlocks

**Running:**

```bash
LOAD_PROFILE=smoke k6 run load-test/scenarios/concurrent-read-write.js

LOAD_PROFILE=soak K6_SOAK_DURATION=30m k6 run load-test/scenarios/concurrent-read-write.js
```

(See `load-test/scenarios/concurrent-read-write.js` for full implementation.)

## Service Level Objectives (SLOs)

All SLOs below are **proposed targets** pending validation via real load-test execution. They are based on reasonable expectations for a B2B agricultural marketplace (not a high-frequency trading system).

### Read Paths (Campaign Listing, Order History, etc.)

| SLO | Target | Rationale |
|-----|--------|-----------|
| p95 latency | < 500 ms | Acceptable for browsing; users expect sub-second list loads. |
| p99 latency | < 1000 ms | Outlier tolerance; occasional slow queries OK if rare. |
| Error rate | < 0.1% | Production-grade expectation; < 1 error per 1000 requests. |
| Availability | 99.9 % | Three 9s; ~43 min/month downtime budget. |

### Write Paths (Order Creation, Checkout)

| SLO | Target | Rationale |
|-----|--------|-----------|
| p95 latency | < 200 ms | Fast transactional processing; order confirmation within 200 ms. |
| p99 latency | < 500 ms | Outlier tolerance; blockchain confirmations may add 1–2s on top. |
| Error rate | < 0.1% | Transactional integrity critical; very low error tolerance. |

### Indexer Write Throughput

| SLO | Target | Rationale |
|-----|--------|-----------|
| Max sustainable throughput | ≥ 100 events/sec | Each contract invocation generates 1–3 events; 30 concurrent Soroban invocations need ~90 evt/sec headroom. |
| Indexer lag (median) | < 5 seconds | Events visible in read model within 5 seconds of Soroban ledger close. |
| Indexer lag (p99) | < 15 seconds | Tail tolerance; occasional batch delays OK. |

### Connection Pool

| SLO | Target | Rationale |
|-----|--------|-----------|
| Pooler availability | 99.95 % | Even higher than app; pooler failure = all app instances fail. |
| Max connection time | < 50 ms | Pooler overhead should be negligible vs. query time. |

## Execution Required

**The following validation steps MUST be performed by a maintainer with access to a realistic environment:**

1. **EXPLAIN ANALYZE on each proposed index** against a production-volume dataset (or close simulation):
   - Verify each index is actually used (shows in query plan, not skipped).
   - Check actual row counts and cost estimates match reality.
   - Confirm index selectivity (e.g., partial index on campaigns filters to ~30% of rows).

2. **Load-test execution** with the full harness (including `concurrent-read-write.js`):
   - Run smoke (5 min) to detect basic errors before committing to soak.
   - Run load (30 min with 100 VUs) to measure p95/p99 latencies.
   - Run soak (several hours with 50 VUs) to detect cumulative memory/cache degradation.
   - Measure actual p95 latencies and compare against SLO targets.
   - If any metric breaches SLO, iterate: profile slow queries, add missing indexes, increase pooler size, etc.

3. **Query-plan collection** at realistic scale:
   - Use `pg_stat_statements` to identify top-N slow queries.
   - Document before/after plans for each index addition.
   - Archive results in `server/docs/query-plans-production-before-after.md`.

4. **Index maintenance baseline**:
   - Measure index bloat monthly: `SELECT schemaname, tablename, ROUND(100 * (OTTA - live_tuple_percent) / OTTA) AS n_dead_tup_percent ...`.
   - Set up `REINDEX` schedule (monthly or triggered by bloat threshold).
   - Monitor autovacuum performance (`autovacuum_naptime`, `autovacuum_vacuum_scale_factor`).

## Production Checklist

Before deploying to production, ensure:

- [ ] PgBouncer deployed and health-checked.
- [ ] Proposed indexes created via migration (run `prisma migrate deploy`).
- [ ] Connection pool config documented in runbook.
- [ ] Monitoring alerts set for pool saturation and slow queries.
- [ ] Load-test passing all SLOs at target VU count.
- [ ] Backup and PITR strategy confirmed.
- [ ] Query-plan validation complete and documented.

## Monitoring Queries

Keep these queries handy for production troubleshooting:

```sql
-- Top slow queries
SELECT query, calls, mean_exec_time, max_exec_time
  FROM pg_stat_statements
  ORDER BY mean_exec_time DESC
  LIMIT 20;

-- Index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
  FROM pg_stat_user_indexes
  ORDER BY idx_scan DESC;

-- Connection pool status (via PgBouncer psql)
SHOW STATS;

-- Table bloat
SELECT current_database(), schemaname, tablename,
       round(100 * pg_total_relation_size(schemaname||'.'||tablename) / pg_database_size(current_database())) AS pct_of_db,
       round(pg_total_relation_size(schemaname||'.'||tablename) / 1024 / 1024) AS size_mb
  FROM pg_tables
  WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## References

- [PostgreSQL Connection Pooling with PgBouncer](https://www.postgresql.org/docs/current/runtime-config-connection.html)
- [Prisma Connection Pool Tuning](https://www.prisma.io/docs/orm/overview/databases/connection-management)
- [k6 Load Testing Best Practices](https://grafana.com/docs/k6/latest/testing-guides/load-testing/)
- [Query Plan Analysis Guide](https://www.postgresql.org/docs/current/using-explain.html)
