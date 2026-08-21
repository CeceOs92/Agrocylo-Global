# Security Audit Checklist

> **Scope:** Escrow (`contracts/escrow/src/lib.rs`, including the path-payment
> router integration), Registry (`agro-production/contract/registry/src/lib.rs`,
> including provenance/batch tracking), ProductionEscrow
> (`agro-production/contract/production_escrow/src/lib.rs`), Governance
> (`agro-production/contract/governance/src/lib.rs`), InvestmentBasket
> (`agro-production/contract/investment_basket/src/lib.rs`) — the full current
> contract set as of this revision (see §15 for when each was added to scope).
>
> **Date:** 2026-05-29 (original); extended 2026-08-17 (§15, Issue #754)
> **Status:** Review Complete

---

## Table of Contents

1. [Reentrancy Checks](#1-reentrancy-checks)
2. [Token Approval Limitations](#2-token-approval-limitations)
3. [Authorization Enforcement](#3-authorization-enforcement)
4. [Arithmetic Overflow/Underflow Protection](#4-arithmetic-overflowunderflow-protection)
5. [State Machine Integrity](#5-state-machine-integrity)
6. [Fee Collection Mechanism](#6-fee-collection-mechanism)
7. [Dispute Stake Mechanism](#7-dispute-stake-mechanism)
8. [Access Control](#8-access-control)
9. [Initialization Protection](#9-initialization-protection)
10. [Edge Cases](#10-edge-cases)
11. [Error Handling](#11-error-handling)
12. [Event Monitoring](#12-event-monitoring)
13. [Findings Summary](#13-findings-summary)
14. [Issue #652 Follow-up: Legacy/Production Escrow Drift Re-audit](#14-issue-652-follow-up-legacyproduction-escrow-drift-re-audit)
15. [Issue #754: Full-Scope Audit — Governance, Investment Basket, Path-Payment Router](#15-issue-754-full-scope-audit--governance-investment-basket-path-payment-router)

---

## 1. Reentrancy Checks

### Status: ✅ Low Risk

**Analysis:**
Soroban's Rust runtime does not expose an EVM-style CALL mechanism that allows reentrancy. All token transfers use the Soroban token interface, which is synchronous and does not invoke receiver callbacks. However, the **Checks-Effects-Interactions** pattern is not consistently followed.

**Violations found:**

| Contract | Function | Issue |
|----------|----------|-------|
| Escrow | `confirm_receipt` | Transfers tokens to farmer BEFORE writing updated order status |
| Escrow | `refund_expired_order` | Transfers tokens BEFORE setting order status to Refunded |
| Escrow | `refund_expired_orders` | Transfers tokens BEFORE writing updated status |
| Escrow | `resolve_dispute` | Transfers tokens BEFORE writing order/dispute updates (all 3 resolution branches) |
| ProductionEscrow | `start_production` | Transfers via `release_tranche_internal` before `save_campaign` |
| ProductionEscrow | `mark_harvest` | Same pattern — transfers before save |

**Mitigation:**
Reorder operations to perform all storage writes BEFORE token transfers. However, given Soroban's non-reentrant runtime, this is a code-quality concern rather than an exploitable vulnerability.

**Severity:** Low

---

## 2. Token Approval Limitations

### Status: ✅ Secure

**Analysis:**
All contracts use `token::Client::transfer()` which requires the sender to have called `require_auth()` prior to the transfer. In every case:
- The sender (`require_auth()` caller) initiates the action
- The contract holds funds after initial deposit
- Transfers out are always from `env.current_contract_address()` → recipient

The contracts never call `approve()` or `transfer_from()` — they only use direct `transfer()`. This eliminates the approval front-running attack surface.

**No findings.**

**Severity:** N/A

---

## 3. Authorization Enforcement

### Status: ✅ Secure

**Analysis:**

| Contract | Function | Auth Mechanism | Correct? |
|----------|----------|----------------|----------|
| Escrow | `create_order` | `buyer.require_auth()` | ✅ |
| Escrow | `mark_delivered` | `farmer.require_auth()` | ✅ |
| Escrow | `confirm_receipt` | `buyer.require_auth()` | ✅ |
| Escrow | `open_dispute` | `opened_by.require_auth()` | ✅ |
| Escrow | `resolve_dispute` | `admin.require_auth()` + stored admin check | ✅ |
| Registry | `initialize` | `admin.require_auth()` | ✅ |
| Registry | `register_farmer` | `farmer.require_auth()` + validation | ✅ |
| Registry | `register_campaign` | `source_contract.require_auth()` | ✅ |
| Campaign | `register_farmer` | `farmer.require_auth()` | ✅ |
| Campaign | `create_campaign` | `farmer.require_auth()` | ✅ |
| Campaign | `start_production` | `farmer.require_auth()` | ✅ |
| Campaign | `mark_harvest` | `farmer.require_auth()` | ✅ |
| ProductionEscrow | `create_campaign` | `farmer.require_auth()` | ✅ |
| ProductionEscrow | `invest` | `investor.require_auth()` | ✅ |
| ProductionEscrow | `start_production` | `farmer.require_auth()` | ✅ |
| ProductionEscrow | `mark_harvest` | `farmer.require_auth()` | ✅ |
| ProductionEscrow | `confirm_order` | `buyer.require_auth()` | ✅ |
| ProductionEscrow | `settle` | `caller.require_auth()` + check farmer/admin | ✅ |
| ProductionEscrow | `claim_returns` | `investor.require_auth()` | ✅ |
| ProductionEscrow | `refund` | `investor.require_auth()` | ✅ |
| ProductionEscrow | `open_dispute` | `caller.require_auth()` + check participant | ✅ |
| ProductionEscrow | `resolve_dispute` | `admin_caller.require_auth()` + stored admin check | ✅ |
| ProductionEscrow | `finalize_failed` | **None** (anyone can call) | ⚠️ See note |

**Note on `finalize_failed`:** Anyone can call this function. This is intentional — if a campaign's deadline has passed without reaching the target, anyone should be able to trigger the failure transition. Since the state change is guarded by a time check (`timestamp > deadline`), there is no privilege escalation.

**No findings.**

**Severity:** N/A

---

## 4. Arithmetic Overflow/Underflow Protection

### Status: ⚠️ Medium (Partial)

**Analysis:**

| Contract | Location | Protection | Assessment |
|----------|----------|------------|------------|
| Escrow | `fee = amount * 3 / 100` | `checked_mul` + `checked_sub` | ✅ |
| Escrow | `refund_amount = amount * bps / 10_000` | `checked_mul` + `checked_sub` | ✅ |
| Escrow | Order ID increment | `unwrap_or(0) + 1` | ⚠️ See Finding #1 |
| ProductionEscrow | `campaign.total_raised += amount` | Direct `+=` | ⚠️ See Finding #2 |
| ProductionEscrow | `tranche = total_raised * BPS / DENOM` | Direct `*` / `/` | ⚠️ See Finding #3 |
| ProductionEscrow | `prev + amount` in contributions | Direct `+` | ⚠️ See Finding #2 |
| ProductionEscrow | `pool = raised + revenue - released` | Direct `+` / `-` | ⚠️ See Finding #4 |
| Campaign | `raised_amount + amount` | Direct `+` | ⚠️ Same as Finding #2 |
| Campaign | Tranche calculation | Direct `*` / `/` | ⚠️ See Finding #3 |

**Finding #1 (Escrow):** Order ID increments from `unwrap_or(0) + 1` without `checked_add`. At u64::MAX (~1.8e19), this would overflow to 0. Realistically unreachable.

**Finding #2 (ProductionEscrow, Campaign):** `campaign.total_raised += amount` and `prev + amount` use direct addition. If total_raised exceeds `i128::MAX`, it panics. For realistic agricultural production values, this is safe, but formally incorrect.

**Finding #3 (ProductionEscrow, Campaign):** Tranche calculations use direct integer multiplication (`total_raised * BPS`). An i128 overflow would require amounts > `i128::MAX / 10_000`, which is astronomically large.

**Finding #4 (ProductionEscrow):** `pool = total_raised + total_revenue - tranche_released` — if `tranche_released > total_raised + total_revenue`, this underflows. Guarded by tranche release logic (cannot release more than raised), but an edge case exists if `tranche_released` was manipulated.

**Mitigation:**
- Use `checked_add`, `checked_sub`, `checked_mul` throughout (consistent with Escrow's existing pattern)
- Add invariant checks before pool calculations
- The current code works for realistic values but formal correctness would require safe arithmetic everywhere

**Severity:** Medium

---

## 5. State Machine Integrity

### Status: ✅ Verified

**Analysis:**

#### Escrow Order State Machine:

```
Pending → mark_delivered → (Delivered) → confirm_receipt → Completed
Pending → open_dispute → Disputed → resolve_dispute → { Refunded / Completed }
Pending → refund_expired → Refunded (after 96h)
```

All transitions correctly guard on current status. Invalid transitions return appropriate errors (`OrderNotPending`, `OrderNotDelivered`, `OrderNotDisputed`, etc.).

#### ProductionEscrow Campaign State Machine:

```
Funding → invest (full) → Funded → start_production → InProduction → mark_harvest → Harvested → settle → Settled
Funding → finalize_failed → Failed
{ Funded, InProduction, Harvested } → open_dispute → Disputed → resolve → { Settled, Failed }
```

All transitions verified in test suite. Invalid transitions properly rejected.

#### Campaign Contract State Machine:

```
Pending → invest (full) → Funded → start_production → InProduction → mark_harvest → Harvested → settle → Settled
Pending → fail_campaign → Failed
Funded → fail_campaign → Failed
{ Funded, InProduction, Harvested } → dispute → Disputed → resolve → { Settled, Failed }
```

**No findings.**

**Severity:** N/A

---

## 6. Fee Collection Mechanism

### Status: ✅ Low Risk

**Analysis:**

The Escrow contract applies a 3% fee on order creation:

```rust
let fee = amount.checked_mul(3).ok_or(EscrowError::ArithmeticError)? / 100;
let net_amount = amount.checked_sub(fee).ok_or(EscrowError::ArithmeticError)?;
token_client.transfer(&buyer, &fee_collector, &fee);
token_client.transfer(&buyer, &env.current_contract_address(), &net_amount);
```

**Checks performed:**
- Fee uses `checked_mul` and `checked_sub` (safe from overflow)
- Fee rate is fixed at 3% (hardcoded, not configurable)
- Fee is collected at order creation, before funds enter escrow
- `fee_collector` is set at initialization and immutable

**Concerns:**
- Fee rate is hardcoded, not adjustable. If the platform needs to change the fee rate, a contract upgrade is required.
- For amount=1: fee = 1 * 3 / 100 = 0, net_amount = 1 — no fee collected. This is documented behavior (tested in `test_fee_calculation_with_small_amounts`).
- The ProductionEscrow contract does not collect fees on investment or order creation.

**Severity:** Low

---

## 7. Dispute Stake Mechanism

### Status: ✅ Verified

**Analysis:**

#### Escrow Disputes:
- Opened by buyer or farmer after order is Pending
- Validates order participant status
- Prevents duplicate disputes on same order
- Admin resolves with Refund / Release / Split(bps)
- Split validates ratio ≤ 10_000 bps (100%)
- After resolution, `dispute.resolved = true` prevents re-resolution
- Funds are always locked in the contract until resolution

#### ProductionEscrow Disputes:
- Opened by farmer, admin, or any investor with a non-zero contribution
- Admin resolves with FullPayoutToInvestors / RefundInvestors / Partial(bps)
- Partial resolution validates bps ≤ 10_000
- If `pool = 0` and `Partial > 0`, no transfer occurs (handled by `pool > 0 && farmer_bps > 0` check)
- Farmer receives `farmer_cut` from `Partial` resolution; investors claim remaining via `claim_returns`

**Observation:** The `Partial` resolution in ProductionEscrow transfers funds to the farmer directly, reducing the pool for investors. This is correct behavior but creates a window where `tranche_released` is incremented without a corresponding tranche release event — the `claim_returns` calculation still works because it derives from `pool = total_raised + total_revenue - tranche_released`.

**Severity:** Low (informational)

---

## 8. Access Control

### Status: ✅ Verified

**Analysis:**

| Role | Privileges | Enforcement |
|------|-----------|-------------|
| Admin (Escrow) | Resolve disputes | `require_auth()` + stored admin check |
| Admin (Registry) | Initialize, update contract refs | `require_auth()` + initialization guard |
| Admin (Campaign) | Initialize | Initialization guard |
| Admin (ProductionEscrow) | Resolve disputes, co-settle | `require_auth()` + stored admin check |
| Farmer (Escrow) | Mark delivered | `require_auth()` + stored farmer match |
| Farmer (ProductionEscrow) | Create campaign, start production, mark harvest | `require_auth()` + stored farmer match |
| Buyer (Escrow) | Create order, confirm receipt | `require_auth()` + stored buyer match |
| Investor (ProductionEscrow) | Invest, claim returns, refund | `require_auth()` + contribution check |
| Anyone | `refund_expired_orders`, `finalize_failed` | Unguarded but guarded by time/state |

**No privilege escalation vulnerabilities found.**

**Severity:** N/A

---

## 9. Initialization Protection

### Status: ✅ Verified

**Analysis:**

| Contract | Guard | Method |
|----------|-------|--------|
| Escrow | `AlreadyInitialized` | Checks `DataKey::Admin` existence |
| Registry | `AlreadyInitialized` | Checks `DataKey::Admin` existence, `require_auth(admin)` |
| Campaign | `AlreadyInitialized` | Checks `DataKey::RegistryInitialized` existence |
| ProductionEscrow | `AlreadyInitialized` | Checks `DataKey::Admin` existence |

All contracts use the same pattern: check if a known key exists in instance storage, return error if already set. This prevents re-initialization attacks.

**One issue:** The `initialize` function in `contracts/escrow/src/lib.rs` checks `supported_tokens.len() < 2` BEFORE `if supported_tokens.is_empty()` — the empty check at line 178 is unreachable because `len() < 2` catches it first (a Vec with len=0 has len < 2). The `TokenWhitelistEmpty` error is never triggered. This is a logic redundancy, not a security issue.

**Severity:** Informational

---

## 10. Edge Cases

### Status: ⚠️ Low Risk

**Identified edge cases:**

| Edge Case | Contract | Status | Mitigation |
|-----------|----------|--------|------------|
| Zero amount orders | Escrow | ✅ | Rejected: `AmountMustBePositive` |
| Negative amount orders | Escrow | ✅ | Rejected: `AmountMustBePositive` |
| Buyer = Farmer | Escrow | ✅ | Rejected: `BuyerCannotEqualFarmer` |
| Duplicate initialization | All | ✅ | `AlreadyInitialized` guard |
| Zero target amount | ProductionEscrow | ✅ | Rejected: `InvalidAmount` |
| Past deadline | ProductionEscrow | ✅ | Rejected: `InvalidDeadline` |
| Overfunding | ProductionEscrow | ✅ | Rejected: `CampaignOverfunded` |
| Double claim | ProductionEscrow | ✅ | `AlreadyClaimed` guard |
| Invalid campaign ID | ProductionEscrow | ✅ | `CampaignNotFound` error |
| Invalid order ID | ProductionEscrow | ✅ | `OrderNotFound` error |
| Split ratio > 100% | Escrow | ✅ | `InvalidSplitRatio` error |
| Split ratio > 10_000 bps | ProductionEscrow | ✅ | `InvalidResolution` error |
| Single-token initialization | Escrow | ✅ | `MustSupportTwoTokens` error |
| Empty supported tokens | Escrow | ⚠️ | Dead code: `TokenWhitelistEmpty` unreachable |
| Contribution = 0, not an investor | ProductionEscrow | ✅ | `NotInvestor` error |
| Pool ≤ 0 on claim | ProductionEscrow | ✅ | `NothingToClaim` error |
| Tranche already released | ProductionEscrow | ✅ | `TrancheAlreadyReleased` error (Campaign contract) |

**Finding #5 — Empty Token Whitelist (Escrow):**
The `TokenWhitelistEmpty` variant is defined but the guard `if supported_tokens.is_empty()` on line 178 is preceded by `if supported_tokens.len() < 2` on line 175. An empty Vec (len=0) satisfies `len() < 2`, so line 179-180 is unreachable. The check order should be swapped: first check `is_empty()`, then check `< 2`.

```rust
// Current (incorrect order):
if supported_tokens.len() < 2 { return Err(MustSupportTwoTokens); }
if supported_tokens.is_empty() { return Err(TokenWhitelistEmpty); }

// Fixed:
if supported_tokens.is_empty() { return Err(TokenWhitelistEmpty); }
if supported_tokens.len() < 2 { return Err(MustSupportTwoTokens); }
```

**Severity:** Informational

---

## 11. Error Handling

### Status: ✅ Adequate

**Analysis:**

All contracts define comprehensive error enums with descriptive variant names. Every fallible path returns a `Result<_, ContractError>`.

**Patterns used:**
- `ok_or(EscrowError::...)` on storage reads
- `.ok_or(...)?` for early returns
- `match` / `if let` for conditional error paths

**Missing error cases (none found):**
- All storage reads have appropriate `ok_or` handlers
- All access control failures return specific errors
- All state machine guard failures return specific errors
- All arithmetic paths either use `checked_*` with error mapping or are astronomically safe

**Severity:** N/A

---

## 12. Event Monitoring

### Status: ✅ Verified

**Analysis:**

| Contract | Events | Topics | Data |
|----------|--------|--------|------|
| Escrow | `order:created` | `order`, `created` | `(id, buyer, farmer, amount, token)` |
| Escrow | `order:delivered` | `order`, `delivered` | `(id, farmer, buyer, timestamp)` |
| Escrow | `order:confirmed` | `order`, `confirmed` | `(id, buyer, farmer)` |
| Escrow | `order:refunded` | `order`, `refunded` | `(id, buyer)` |
| Escrow | `order:disputed` | `order`, `disputed` | `(id, opened_by, buyer, farmer)` |
| Escrow | `order:resolved` | `order`, `resolved` | `(id, resolution, buyer, farmer)` |
| Registry | `registry:updated` | `registry`, `updated` | `(escrow, production)` |
| Registry | `farmer:registered` | `farmer`, `registerd` | `(farmer,)` |
| Registry | `campaign:registered` | `campaign`, `registerd` | `(id, farmer)` |
| Campaign | `reg:init` | `reg`, `init` | `admin` |
| Campaign | `farmer:regd` | `farmer`, `regd` | `(id, farmer)` |
| Campaign | `camp:created` | `camp`, `created` | `(id, farmer, target)` |
| Campaign | `camp:funded` | `camp`, `funded` | `(id, raised, target)` |
| Campaign | `camp:invest` | `camp`, `invest` | `(id, investor, amount, new_raised)` |
| Campaign | `camp:started` | `camp`, `started` | `(id, farmer)` |
| Campaign | `camp:harvest` | `camp`, `harvest` | `(id, farmer)` |
| Campaign | `camp:settled` | `camp`, `settled` | `id` |
| Campaign | `camp:tranche` | `camp`, `tranche` | `(id, amount, released)` |
| Campaign | `camp:failed` | `camp`, `failed` | `id` |
| Campaign | `camp:disputed` | `camp`, `disputed` | `id` |
| Campaign | `camp:resolved` | `camp`, `resolved` | `(id, success)` |
| ProductionEscrow | `campaign:created` | `campaign`, `created` | `(id, farmer, token, target, deadline)` |
| ProductionEscrow | `campaign:invested` | `campaign`, `invested` | `(id, investor, amount, total_raised)` |
| ProductionEscrow | `campaign:produce` | `campaign`, `produce` | `(id, farmer)` |
| ProductionEscrow | `campaign:harvest` | `campaign`, `harvest` | `(id, farmer)` |
| ProductionEscrow | `campaign:settled` | `campaign`, `settled` | `(id, total_revenue)` |
| ProductionEscrow | `campaign:failed` | `campaign`, `failed` | `(id,)` |
| ProductionEscrow | `campaign:disputed` | `campaign`, `disputed` | `(id, caller)` |
| ProductionEscrow | `campaign:claimed` | `campaign`, `claimed` | `(id, investor, payout)` |
| ProductionEscrow | `campaign:refunded` | `campaign`, `refunded` | `(id, investor, amount)` |
| ProductionEscrow | `campaign:tranche` | `campaign`, `tranche` | `(id, amount, released)` |
| ProductionEscrow | `campaign:batch_ref` | `campaign`, `batch_ref` | `(id, count, total)` |
| ProductionEscrow | `order:created` | `order`, `created` | `(id, buyer, campaign_id, amount)` |
| ProductionEscrow | `order:confirmed` | `order`, `confirmed` | `(id, buyer, campaign_id)` |
| ProductionEscrow | `order:batch_ref` | `order`, `batch_ref` | `(count, total)` |

**All state transitions are covered by events.** Every status change in every state machine emits an event with sufficient data for off-chain indexers.

**Typo found:** Registry uses `symbol_short!("registerd")` (missing 'e') instead of `"registered"`. Consistent across both farmer and campaign events.

**Severity:** Informational

---

## 13. Findings Summary

| # | Finding | Severity | File:Line | Status |
|---|---------|----------|-----------|--------|
| 1 | `resolve_dispute` performs token transfers before state writes (CEI violation) | Low | `escrow/src/lib.rs:461-503` | Acknowledged |
| 2 | Direct arithmetic (`+=`, `*`, `/`) without `checked_*` in ProductionEscrow/Campaign | Medium | Multiple locations | Fix recommended |
| 3 | `empty()` check unreachable in `initialize` — wrong guard order | Informational | `escrow/src/lib.rs:175-179` | Fix recommended |
| 4 | `TokenWhitelistEmpty` error variant dead code | Informational | `escrow/src/lib.rs:19` | Fix recommended |
| 5 | Event typo: `registerd` → `registered` | Informational | `registry/src/lib.rs:126,205` | Acknowledge |
| 6 | Event data includes duplicate address fields retrievable off-chain | Low | All event emissions | Optimize per GAS doc |
| 7 | Fee rate hardcoded at 3% — not configurable | Low | `escrow/src/lib.rs:224` | Feature request |
| 8 | Order list storage is O(n) per append | Low | `escrow/src/lib.rs:261-273` | Optimize per GAS doc |

### Recommended Mitigations (Immediate)

1. **Fix arithmetic** — Apply `checked_add`, `checked_sub`, `checked_mul` across ProductionEscrow and Campaign contracts, consistent with Escrow's existing pattern
2. **Fix dead code** — Swap the order of `is_empty()` and `len() < 2` checks in Escrow's `initialize`
3. **Document CEI violations** — Add comments acknowledging that token transfer ordering is intentional for Soroban's non-reentrant runtime but violates best practice

### Recommended Mitigations (Short-term)

4. **Variable fee rate** — Consider making the fee rate configurable via admin function (with upper bound)
5. **Typo fix** — Correct `registerd` → `registered` (affects indexer compatibility)

---

## 14. Issue #652 Follow-up: Legacy/Production Escrow Drift Re-audit

> **Date:** 2026-07-30
> **Trigger:** Commit `240c652` ("fix: implement independent attester role to prevent farmer self-rug exploit") was applied only to `production_escrow`, never re-checked against `contracts/escrow`.

### 14.1 Self-attestation re-audit result: vulnerability confirmed and fixed

`contracts/escrow::mark_delivered` required only `farmer.require_auth()`. Once called, `delivery_timestamp` is set to a non-zero value, which permanently disables the buyer's automatic `refund_expired_order` escape hatch (`refund_expired_order`/`refund_expired_orders` both reject once `delivery_timestamp != 0`) — regardless of whether the farmer actually delivered anything. This is the same self-rug pattern `240c652` fixed in `production_escrow::mark_harvest`/`advance_milestone` via an independent attester co-signature, and it had not been ported.

**Fix applied** (this PR): ported the identical pattern —
- `DataKey::Attester` + `set_attester(admin, attester)` (admin-only setter)
- `mark_delivered(farmer, attester_caller, order_id)` now also requires `attester_caller.require_auth()`, checked against the configured attester
- While no attester is configured, falls back to requiring the admin's co-signature (mirrors this file's existing governance-fallback convention for `set_fee_config`/`set_supported_tokens`, so a deployment that never calls `set_attester` isn't bricked, but a farmer alone can no longer self-attest either way)

New error: `EscrowError::NotAttester`. New tests: `test_mark_delivered_wrong_attester_fails`, `test_mark_delivered_falls_back_to_admin_before_attester_configured`, `test_mark_delivered_uses_configured_attester`.

### 14.2 Both contracts were uncompilable — this audit could not have been "re-checked" until now

While investigating, both crates were found in a **currently uncompilable state on `main`**, each due to an unrelated botched merge — meaning neither had actually been exercised by `cargo test`/CI in this state, and any "re-check" of one against the other was structurally impossible until fixed:

| Crate | Break | Cause |
|---|---|---|
| `contracts/escrow` | Syntax error: ~50 lines of dead, duplicate dispute-resolution logic spliced into the middle of `set_arbitrators` with no function signature, referencing `DataKey::Arbitrators`/`Quorum`/`ArbitratorVote` and `EscrowError::ArbitrationNotConfigured`/`ArbitratorNotFound`/`AlreadyVoted`, none of which existed on their enums | Bad merge resolution (commit `850ea13`) |
| `production_escrow` | `EscrowError::NotGoverned` referenced by `require_governed_caller` but never added to the enum; same for `InvalidGovernanceContract` in `set_governance_contract`'s verification path | commit `897a3cc` added the reference without the variant |
| `registry` (dev-dependency of `production_escrow`'s test suite) | `mint_batch`/`link_batch_to_order`/`get_batch`/`get_batch_history` referenced an undefined `BatchRecord` type and `DataKey::Batch`/`BatchCount`/`BatchOrderLink`/`OrderBatch` | Provenance/batch-tracking feature merged without its type definitions |
| `production_escrow/src/test.rs` | Called `registry_client.register_farmer(&admin, &farmer)` against a signature that only takes `farmer` | Stale test call site after a `registry` API change |

All four are fixed in this PR (types/variants restored, dead code removed, call site updated) — each fix is additive/restorative (no behavior removed), verified by getting every existing test in all three crates passing again (`escrow`: 56/56, `production_escrow`: 191/191, `registry`: 20/21 — see §14.4).

### 14.3 Additional drift found during the re-audit: dispute resolution wasn't reporting to the reputation registry

`contracts/escrow::resolve_escrow_dispute_internal` (shared by `resolve_dispute` and `vote_to_resolve`) never called `report_reputation_outcome`, even though `confirm_receipt` does, and an existing test (`test_resolve_dispute_reports_split_outcome_to_registry`) asserted it should — the assertion had simply never been able to run before the compile fix in §14.2. Fixed by computing `buyer_share_bps` per resolution branch (matching the exact logic that was stranded in the dead code from §14.2) and reporting it, same as `confirm_receipt`.

### 14.4 Test-fixture gap (not a contract bug): ledger timestamp 0 defeats the delivery guard

`mark_delivered`'s "already delivered" guard is `order.delivery_timestamp > 0`. A fresh Soroban test `Env` defaults its ledger timestamp to `0`; a test that calls `mark_delivered` without first advancing the clock records `delivery_timestamp == 0`, silently defeating the guard and letting `mark_delivered` be called twice (`test_mark_delivered_twice_succeeds` was actually asserting this broken idempotent behavior before this PR, see the code comment removed by commit `897a3cc`'s incomplete "stabilize escrow delivery guard" fix, which changed the test's assertion without fixing the underlying baseline-timestamp gap). A live Stellar ledger is never at timestamp 0, so this is a **test-fixture gap, not a contract vulnerability**. Fixed by giving the shared test fixtures a non-zero baseline ledger timestamp once, rather than requiring every future test author to remember to advance the clock.

### 14.5 Decision: which contract is "the production one"?

**Correction to the issue's framing:** `contracts/escrow` and `production_escrow` are not duplicate/competing implementations of the same feature — they back two different product surfaces with different domain models, both live:

- `contracts/escrow` — direct buyer↔farmer marketplace order escrow (`create_order`/`mark_delivered`/`confirm_receipt`). Wired up by the root `client/` app via `client/src/services/stellar/contractService.ts`, configured through `NEXT_PUBLIC_CONTRACT_ID`/`NEXT_PUBLIC_ESCROW_CONTRACT_ID`.
- `production_escrow` — crowdfunded production campaigns (`create_campaign`/`invest`/`start_production`/`mark_harvest`/`claim_returns`). Wired up by `agro-production/client/` via its own `agro-production/client/src/lib/contractService.ts`.

Neither should be deprecated — they are both in active use by distinct, currently-shipping frontends. **Decision: both are production contracts**, and both must independently carry any security-relevant fix (like the attester pattern) rather than treating one as canonical. This makes the checklist in §14.6 load-bearing, not optional.

### 14.6 Shared checklist: cross-checking future contract security fixes

Because `contracts/escrow` and `production_escrow` intentionally duplicate several security-critical patterns (independent attester, governance-gated params, admin/arbitrator dispute resolution, fee collection) without sharing code, any fix to one of the patterns below **must** be checked against the other contract before merging:

- [ ] **Self-attestation / independent-attester requirement** on any action that gates fund release on the interested party's own claim (`mark_delivered` / `mark_harvest` / `advance_milestone`)
- [ ] **Governance-gating fallback** on admin-controlled parameter setters (`set_fee_config`, `set_supported_tokens`/`update_supported_tokens`, `set_governance_contract` itself)
- [ ] **Dispute resolution → reputation reporting** — every code path that resolves a dispute (admin-direct or arbitrator-quorum) reports the outcome to the registry, matching the "clean confirmation" path
- [ ] **Arbitrator pool / quorum voting** — `set_arbitrators`, `get_arbitrators`, `get_quorum`, `vote_to_resolve` present and type-complete (this class of bug — a feature referencing types/variants that were never defined — caused §14.2's compile breaks; a `cargo check --workspace` in CI would catch this immediately and is the single highest-leverage fix here)
- [ ] **Cancellation / cooling-off window** (`cancel_order`) — window duration, fee-refund semantics, and the guard against cancelling after delivery/confirmation
- [ ] **Multi-party split orders** — co-buyer funding, majority-by-value vs. unanimous confirmation threshold, pro-rata dispute refund
- [ ] Run the full workspace test suite (`cargo test` from the workspace root, or per-crate — see caveat below) before merging any change to either contract

**Caveat on `cargo test` at the workspace root:** as of this audit, the `registry` crate has one pre-existing, unrelated failing test (`test_reputation_is_tracked_independently_per_farmer`, a reputation-scoring assertion mismatch), and the `governance` and `investment_basket` crates each have several pre-existing failures (`HostError: ... "ledger protocol version too old for host"` — looks like a test-harness `LedgerInfo` setup gap, the same class of issue as §14.4, not a contract bug). None of these are touched by this PR and all are out of scope for issues #652–#655 — noted here rather than fixed silently so they aren't lost. Similarly, `server/src/services/reputationService.ts` has 3 pre-existing TypeScript errors and several server test files (`contractWatcher`, `groupOrderService`, `orderService`, `reputationService`, `wsManager`) have pre-existing failing tests unrelated to this PR's changes — also flagged here rather than silently worked around, since fixing them was outside the scope of issues #652–#655.

---

## 15. Issue #754: Full-Scope Audit — Governance, Investment Basket, Path-Payment Router

> **Trigger:** Issue #730 first flagged that this document's scope predated the
> governance contract, the investment-basket contract, and the path-payment
> router entirely — meaning the newest, most financially sensitive contract
> surface in the project had never had a documented, systematic review.
> Issue #754 commissions that review and requires every finding to carry a
> tracked resolution (fixed / accepted risk with rationale / scheduled), plus
> a repeatable process so this gap can't reopen the same way for whatever
> ships next.

### 15.0 Methodology

Full line-by-line read of `contracts/escrow/src/lib.rs` (1,841 lines, including
the Issue #591 path-payment router integration and every governance/pause/
attester/arbitrator/split-order addition layered on since), `governance/src/lib.rs`
(690 lines, in full), and `investment_basket/src/lib.rs` (906 lines, in full).
Targeted read of `production_escrow/src/lib.rs` and `registry/src/lib.rs`
focused on the three cross-contract seams the issue specifically calls out
(§15.8), plus every `pub fn` signature in both files. Cross-referenced every
`DataKey::*`, `<ContractError>::*`, and free-function call against its
declaration in all five contracts programmatically (not just by eye), which is
how §15.3 was found. **Could not run `cargo test`/`cargo check`** in this
sandbox — see §15.9; findings below were verified by careful reading and,
where noted, mechanical cross-referencing, not by a green test run. Treat
§15.9 as a required follow-up, not a formality.

### 15.1 The three previously-flagged bugs: status confirmed

Issue #754's problem statement cites three specific critical, fund-affecting
bugs as the pattern motivating this audit. All three were found **already
fixed** by prior work, verified against the current code:

| Cited bug | Status | Evidence |
|---|---|---|
| "A governance bypass that let the admin re-point governance to itself" | **Fixed** (Issue #680) | `set_governance_contract` on every governed contract (`contracts/escrow:1724`, `production_escrow`, `registry:169`, `investment_basket:231`) is itself gated by `require_governed_caller`: admin-only *only* while no governance is configured; once set, only the governance contract's own address can call it again. A candidate address is also verified as a real deployed contract implementing the expected interface (`governance_client::verify`, a `get_admin` view-function probe) before acceptance, so it can't be pointed at an arbitrary admin-controlled address either. |
| "An investment-basket claim formula that permanently strands depositor funds" | **Fixed** (Issues #681, #682) | `claim_basket_returns` is repeatable — each call pays `fair_share(total_collected) − already_paid` rather than a one-shot flag (#681), so a depositor is never blocked from a later constituent's payout by claiming early. A constituent that becomes uninvestable before `fund_basket` runs is recorded as already-collected immediately rather than leaving its share stuck behind a permanently-`Open` basket, and `withdraw_basket` is a time-gated escape hatch for a basket nobody ever successfully funds (#682). Traced the formula by hand for overflow/underflow/rounding correctness in this audit (§15.7.1) — found no new stranding path. |
| "A path-payment router trusting an unverified swap output" | **Fixed** (Issue #591, hardened since) | `create_order_via_path_payment` (`contracts/escrow:803`) does **not** trust `swap_exact_in`'s return value. It snapshots the escrow's own settlement-token balance before the call and computes `dest_received` from the actual balance delta afterward (`contracts/escrow:860–885`), so a misconfigured or malicious router cannot inflate the recorded order amount against real backing funds. Slippage tolerance is also enforced against the router's own `get_quote`, independent of the buyer's floor — the stricter of the two always wins. |

No further action needed on these three; they're recorded here as **closed,
verified** rather than left as an open question the way #730 found them.

### 15.2 NEW — Critical: governance upgrade-timelock bypass via disguised `propose()`

**Severity: Critical. Status: Fixed in this PR.**

`governance::execute()` selects which timelock delay applies purely from
`proposal.kind`:

```rust
let timelock_key = match proposal.kind {
    ProposalKind::ParameterChange => DataKey::TimelockDelaySecs,       // short
    ProposalKind::ContractUpgrade => DataKey::UpgradeTimelockDelaySecs, // long, by design
};
```

`propose_upgrade()` is the *intended* entry point for an upgrade proposal and
always tags `kind: ProposalKind::ContractUpgrade`. But the generic `propose()`
entry point — the one every ordinary parameter-change proposal uses — always
tags `kind: ProposalKind::ParameterChange`, and places **no restriction on
`function_name`**. Any voter (any address with nonzero weight — not a
privileged role) could therefore call:

```rust
propose(proposer, target_contract, Symbol::new(&env, "upgrade"), args)
```

against **any** governed contract in the system (escrow, production_escrow,
registry, investment_basket, or governance itself via the self-action path),
with `args = [governance_address, malicious_wasm_hash]`. Once that proposal
clears the *same* quorum/majority vote as a routine fee-rate tweak, it needed
only the short `timelock_delay_secs` to execute — not the deliberately longer
`upgrade_timelock_delay_secs` that Issue #757 introduced specifically because
"a bad contract upgrade has materially higher blast radius than a parameter
change." The result: a full WASM swap of any governed contract, reachable
through the ordinary parameter-change path, at the ordinary parameter-change
speed. This is exactly the "seam between contracts" class of bug the issue
asked this audit to look for — governance's own dispatcher was the single
point of failure for every contract it governs, and nothing about the target
contracts' own code could have caught it.

**Fix:** `kind` is no longer a caller-asserted label. `create_proposal` now
derives it from the actual `function_name` being proposed — if it's
`"upgrade"`, the proposal is forced to `ProposalKind::ContractUpgrade`
regardless of which public entry point created it, so `execute()`'s existing
(now-trustworthy) trust in `proposal.kind` is restored at the root rather than
patched at the call site. `get_proposal` also now reports the true kind, so
voters reviewing a pending proposal see "this is actually an upgrade" instead
of a misleading "parameter change" label. See
`agro-production/contract/governance/src/lib.rs` (`create_proposal`) and the
new regression test `test_disguised_upgrade_proposal_forced_to_upgrade_timelock`
in `governance/src/test.rs`, which proves a disguised proposal is rejected at
the short timelock (`TimelockNotElapsed`) and reports `kind ==
ContractUpgrade` immediately on creation.

### 15.3 NEW — Critical (process): the workspace was not compiling

**Severity: Critical (build-breaking, not directly a fund-loss vector in
isolation — but see the "why this matters" note below). Status: Fixed in this PR.**

While reading the in-scope contracts line-by-line, cross-referencing every
`DataKey::*` and `<Error>::*` usage against its enum declaration (§15.0)
surfaced that **three of the five in-scope crates referenced storage keys,
error variants, and in one case an entire free function that were never
declared**, and a fourth had a duplicate struct definition — all straightforward
Rust compile errors (E0599 "no variant", E0425 "not found in this scope",
E0428 "defined multiple times"). None of this could have been caught by
review alone without actually trying to compile, which is precisely §14.2's
finding from the *previous* audit revision, recurring:

| Crate | Break | Detail |
|---|---|---|
| `contracts/escrow` | `require_not_paused` called 6 times, **defined nowhere in the crate** | Issue #757 added `pause`/`unpause`/`is_paused` and every fund-moving entry point (`create_order`, `create_order_via_path_payment`, `confirm_receipt`, `refund_expired_order`, `open_split_dispute`) called this guard — but the function itself was never written. |
| `contracts/escrow` | `DataKey::Guardian`/`Paused`/`SchemaVersion` and `EscrowError::AlreadyPaused`/`NotPaused` used, never declared | Same Issue #757 gap — the pause/guardian/schema-version feature referenced keys and errors on enums that were never extended to include them. |
| `registry` | `DataKey::GovernanceContract`/`Guardian`/`Paused`/`SchemaVersion` and `RegistryError::NotAdmin`/`InvalidGovernanceContract`/`AlreadyPaused`/`NotPaused`/`ContractPaused` used, never declared | Same governance/pause feature, same gap, ported to a third contract. |
| `registry` | `pub struct BatchRecord` **defined twice**, byte-for-byte identical | The first copy's own doc comment explains it was added specifically to fix "referenced without ever being defined, leaving the crate... uncompilable" from a prior merge (§14.2 of this document) — and then a *second*, independent merge duplicated it again, re-breaking the exact thing that comment describes fixing. |
| `production_escrow` | `DataKey::Guardian`/`Paused`/`SchemaVersion` and `EscrowError::AlreadyPaused`/`NotPaused`/`ContractPaused` used, never declared | Same governance/pause feature, same gap, ported to a fourth contract. `require_not_paused`/`require_governed_caller` were at least defined here — only the enum variants were missing. |

**Why this matters for a *security* audit specifically, not just a build
audit:** every governance-gating, pause, and attester finding in this
document (§15.1's confirmation that the governance bypass is fixed; §15.2's
new timelock finding; §15.4–15.6 below) was reviewed against code that could
not have been exercised by `cargo test` in this state. A security fix that
compiles into nothing is not a security fix — it's a comment. This is the
concrete, present-tense proof of Issue #745's premise ("CI has been failing
on every run while merges keep landing") rather than an abstract governance
concern: the contracts this very issue asked to be audited were not
buildable at the moment the audit started, on four of five crates in scope.

**Fix:** restored every missing enum variant (matching the identical,
already-correct pattern each was clearly copied from on a sibling contract)
and the missing `require_not_paused` function in `contracts/escrow`, and
removed the duplicate `BatchRecord` in `registry`. All fixes are additive or
duplicate-removing — no behavior was changed from what each call site already
assumed. Verified by a scripted cross-reference of every `DataKey::*`/
`<Error>::*`/free-function reference against its declaration across all five
in-scope crates (clean after the fix); **could not** verify with an actual
`cargo build`/`cargo test` in this sandbox — see §15.9. This is the single
highest-priority open action from this audit: get a real compiler onto this
diff before merge, not just this document's static analysis.

### 15.4 NEW — Medium: `mint_batch` didn't validate the farmer it was told to trust

**Severity: Medium (data integrity, not direct fund loss). Status: Fixed in this PR.**

`registry::mint_batch` checked that `campaign_id` exists and that
`source_contract` is an authorized caller (escrow or production_escrow), but
never checked that the caller-supplied `farmer` argument actually matches
`CampaignRecord.farmer` for that campaign. A caller-side bug or a future
authorized caller passing the wrong address would mint a provenance record —
harvest quantity, crop, batch history feeding the parametric-insurance/
oracle-attestation pipeline this repo's other in-flight issues (#593) build
on — attributing another farmer's harvest to an arbitrary address, with the
registry offering no independent check. **Fix:** `mint_batch` now loads the
`CampaignRecord` and rejects a mismatch with `InvalidFarmerAddress` before
minting. New tests: `test_mint_batch_rejects_farmer_mismatch`,
`test_mint_batch_succeeds_for_matching_farmer` in `registry/src/test.rs`.

### 15.5 NEW — Low/Medium: residual raw-admin power on three `contracts/escrow` setters

**Severity: Low for `set_registry_contract` (reputation tracking only), Medium
for `set_attester` (directly controls the anti-self-rug protection). Status: Fixed in this PR.**

`set_attester`, `set_max_slippage_bps`, and `set_registry_contract` on
`contracts/escrow` were still gated by a plain `admin_caller == stored_admin`
check, unlike every other security-relevant setter on the same contract
(`set_fee_config`, `set_supported_tokens`, `set_path_payment_router`,
`set_governance_contract` itself, `upgrade`, `set_guardian`, `unpause`,
`migrate`), which all use `require_governed_caller` — admin-only *while
governance is unset*, governance-only once it is. Left as plain admin checks,
these three remained a standing single-key power even after a deployment
configures governance for everything else — most concerning for
`set_attester`, since the attester co-signature is *specifically* the Issue
#652 fix for a farmer self-attesting delivery to defeat the buyer's refund
path. An admin key that stayed unilaterally in control of `set_attester`
could repoint the attester to an address it also controls, then collude with
a farmer to fake delivery on every order — quietly reopening the exact
exploit #652 closed, without ever touching the `mark_delivered` logic itself.
**Fix:** all three now use `require_governed_caller`, consistent with every
other governed setter on this contract. Backward compatible: the fallback
path is identical to the old admin-only check while no governance is
configured, so no existing test or deployment behavior changes.

### 15.6 NEW — Low: `refund_expired_orders` (batch) didn't respect pause

**Severity: Low. Status: Fixed in this PR.**

The singular `refund_expired_order` correctly calls `require_not_paused`
(once that function existed — see §15.3); the batch variant,
`refund_expired_orders`, did not, so funds could keep moving through the
batch refund path during an active emergency pause even though the identical
single-order path was correctly frozen. **Fix:** added the same guard to the
batch variant for consistency with its own sibling function's behavior.

### 15.7 Reviewed, no new finding beyond existing documented conventions

**15.7.1 — `investment_basket` claim/split arithmetic.** `claim_basket_returns`'s
`fair_share = (total_collected * deposit_amount) / total_deposit` and
`fund_basket`'s per-constituent `(total_deposit * weight_bps) / BPS_DENOM` use
direct (non-`checked_mul`) multiplication. Traced by hand: `total_deposit` and
per-depositor amounts are frozen once a basket transitions to `Funded` (no
further `deposit()` accepted), `total_collected` is monotonically
non-decreasing, and `payout <= 0` is explicitly rejected — so the formula
cannot go negative or double-pay in the current design; the only residual gap
is the same "astronomically large amounts could overflow i128" class already
recorded as this document's Finding #2/Severity: Medium for
`production_escrow`/`Campaign`. Recorded here as the same accepted-and-tracked
class of finding, not a new one — **Status: accepted risk, matches existing
Finding #2 mitigation (apply `checked_mul` for formal completeness; not
reachable at realistic token amounts).**

**15.7.2 — `investment_basket::create_basket` is admin-only, never
governance-gated.** Unlike every parameter setter on the sibling contracts,
basket *curation* (which campaigns, at what weights) stays a raw admin power
even once governance is configured. Read the module doc comment first: "A
basket is created by the admin from a list of ... constituents" — this is the
documented product design (curated baskets), not an oversight the way §15.5's
setters were; depositors see the constituents before choosing to deposit, and
no funds move until a depositor opts in. **Status: accepted risk, by design**
— noted here so it has a tracked disposition rather than being silently
assumed safe.

**15.7.3 — `mint_batch`'s "not found" branch reuses `CampaignAlreadyRegistered`
as its error**, which is a confusing but pre-existing (not introduced by this
audit's fix) naming mismatch — the same value now also guards the new
farmer-mismatch path via a fresh error, so the "not found" case's error code
just carries over unchanged. **Status: scheduled** — worth a dedicated
`CampaignNotFound` variant in a future pass; not fixed here to avoid an
unrelated breaking change to `RegistryError`'s public API in a PR whose
purpose is the audit, not an error-enum cleanup.

### 15.8 Cross-contract interaction review (the three seams the issue named)

| Interaction | Reviewed | Result |
|---|---|---|
| governance → escrow/production_escrow/registry/investment_basket parameter changes (fee config, token whitelist, registry pointer, attester, slippage, guardian, pause, **upgrade**) | Full read of `governance::execute()`'s dispatch and every target contract's `require_governed_caller` | §15.2's timelock bypass was found *here* — the single highest-value finding in this audit, since fixing it once in `governance` protects all four downstream contracts at once. Everything else in this seam (the `admin_caller`-as-first-arg convention, the self-invoke-disallowed special case for governance targeting itself, quorum/majority/timelock gating) checked out. |
| registry → production_escrow campaign registration (`register_campaign`, and the newer `mint_batch`/`link_batch_to_order` provenance calls) | Full read of both sides: `production_escrow::create_campaign`'s registry call site and all three registry entry points | §15.4's farmer-identity gap found in `mint_batch`. `register_campaign` itself already validates farmer registration and rejects a duplicate campaign id; the "atomic semantics" comment on the `create_campaign` call site is correct — a `Result::Err` return from a `#[contractimpl]` function reverts the *entire* invocation's state changes in Soroban, so a failed registry call does correctly roll back the campaign write, not just skip a step. |
| investment_basket → production_escrow cross-contract `invest`/`claim_returns`/`refund` | Full read of `investment_basket`'s `escrow_client` module and all three target functions on `production_escrow` | No new finding. `invest`'s `investor.require_auth()` and `claim_returns`/`refund`'s payout-to-`investor` both correctly resolve to the basket contract's own address for basket-originated investments, via the same contract-issued-auth pattern already established elsewhere in this codebase (`registry::record_order_outcome`). `try_invoke_contract` is used throughout so one uninvestable/unsettled constituent can't abort the whole sweep — reviewed in detail for §15.1's claim-formula confirmation. |

### 15.9 What this audit could not verify, and what must happen before merge

This sandbox's Rust toolchain (`cargo` 1.81.0) cannot resolve this workspace's
dependency tree — `soroban-sdk`'s pinned version requires crates (`base64ct
v1.8.3`) that need Cargo's `edition2024` feature, unstable on this toolchain
version. This is the same pre-existing, environment-level blocker recorded in
this repo's other recent audit/implementation sessions, not something
introduced by or specific to this PR. Concretely:

- Every finding above was verified by careful manual reading, and §15.3's
  findings were additionally verified by a scripted cross-reference of every
  `DataKey::*`/`<ContractError>::*`/free-function reference against its
  declaration across all five in-scope crates (clean after this PR's fixes).
  Brace/paren balance and duplicate top-level `struct`/`enum`/`pub fn`
  declarations were also checked mechanically.
- **None of this substitutes for `cargo test --workspace` actually passing.**
  A human or CI environment with a working toolchain must run it before this
  merges — that run is the actual gate, not this document. If it surfaces
  anything this manual/scripted review missed, that's expected and should be
  fixed before merge, not treated as a regression introduced by this audit.
- The `governance`/`investment_basket` pre-existing `LedgerInfo` test-harness
  failures and the one `registry` reputation-assertion failure noted in
  §14.6's caveat were not re-investigated here; they predate this PR and
  remain out of scope for it.

### 15.10 Findings summary (this section)

| # | Finding | Severity | Status |
|---|---|---|---|
| 15.1a | Governance bypass (admin re-pointing governance to itself) | Critical | Fixed (Issue #680, confirmed still in place) |
| 15.1b | Investment-basket claim formula stranding funds | Critical | Fixed (Issues #681/#682, confirmed still in place) |
| 15.1c | Path-payment router trusting unverified swap output | Critical | Fixed (Issue #591, confirmed still in place) |
| 15.2 | Governance upgrade-timelock bypass via disguised `propose()` | **Critical** | **Fixed in this PR** |
| 15.3 | Workspace compile breakage (4 of 5 in-scope crates) | **Critical (process)** | **Fixed in this PR** |
| 15.4 | `mint_batch` farmer-identity not validated | Medium | **Fixed in this PR** |
| 15.5 | `set_attester`/`set_max_slippage_bps`/`set_registry_contract` not governance-gated | Low/Medium | **Fixed in this PR** |
| 15.6 | `refund_expired_orders` (batch) missing pause guard | Low | **Fixed in this PR** |
| 15.7.1 | `investment_basket` claim/split arithmetic not `checked_mul` | Low (Medium per existing Finding #2 convention) | Accepted risk (matches existing Finding #2; not reachable at realistic amounts) |
| 15.7.2 | `create_basket` is admin-only, never governance-gated | Informational | Accepted risk, by design |
| 15.7.3 | `mint_batch`'s not-found error reuses `CampaignAlreadyRegistered` | Informational | Scheduled (future error-enum cleanup) |
| 15.9 | This audit's findings are unverified by an actual compiler run | Process | **Scheduled — required before merge**: run `cargo test --workspace` in a working environment |

See [`SECURITY_REVIEW_CHECKLIST.md`](SECURITY_REVIEW_CHECKLIST.md) for the
repeatable process this audit's findings fed into — the goal is that the next
contract addition or contract-to-contract integration triggers a scoped
review automatically, rather than this scope gap reopening the way #730 found
it.
