# Event Schema Documentation

This document describes the canonical event schema across all four production contracts: `production_escrow`, `governance`, `investment_basket`, and `registry`.

## Schema Versioning

All events include a schema version field (`schema_version: u32`) as the first element in the event payload. This allows the backend indexer to detect and adapt to future payload shape changes rather than silently mis-parsing them.

**Current Schema Version: 1**

## Contract: governance

### Governance Topics Prefix
- Topic 0: `"governnc"` (symbol_short, 8 chars)
- Topic 1: event action (e.g., "proposed", "voted", "queued", etc.)

### Events

#### proposal.proposed
- **Topic**: `(governnc, proposed)`
- **Payload**: `[schema_version, proposal_id, proposer, target_contract, function_name]`
- **Field Types**: `[u32, u64, Address, Address, Symbol]`
- **Description**: Emitted when a voter creates a new governance proposal.

#### proposal.voted
- **Topic**: `(governnc, voted)`
- **Payload**: `[schema_version, proposal_id, voter, support, weight]`
- **Field Types**: `[u32, u64, Address, bool, u64]`
- **Description**: Emitted when a voter casts a weighted vote on a proposal.

#### proposal.queued
- **Topic**: `(governnc, queued)`
- **Payload**: `[schema_version, proposal_id]`
- **Field Types**: `[u32, u64]`
- **Description**: Emitted when a proposal meets quorum and is queued (begins timelock).

#### proposal.rejected
- **Topic**: `(governnc, rejected)`
- **Payload**: `[schema_version, proposal_id]`
- **Field Types**: `[u32, u64]`
- **Description**: Emitted when voting period ends without reaching quorum.

#### proposal.executed
- **Topic**: `(governnc, executed)`
- **Payload**: `[schema_version, proposal_id, target_contract, function_name]`
- **Field Types**: `[u32, u64, Address, Symbol]`
- **Description**: Emitted after timelock elapses and proposal is executed.

#### proposal.cancelled
- **Topic**: `(governnc, cancelled)`
- **Payload**: `[schema_version, proposal_id]`
- **Field Types**: `[u32, u64]`
- **Description**: Emitted when a guardian cancels a queued proposal during the timelock (Issue #783).

#### contract.upgraded
- **Topic**: `(governnc, upgraded)`
- **Payload**: `[schema_version, new_wasm_hash]`
- **Field Types**: `[u32, BytesN<32>]`
- **Description**: Emitted when governance executes a contract upgrade on itself.

#### governance.paused
- **Topic**: `(governnc, paused)`
- **Payload**: `[schema_version, caller]`
- **Field Types**: `[u32, Address]`
- **Description**: Emitted when the guardian pauses governance operations.

#### governance.unpaused
- **Topic**: `(governnc, unpausd)` (truncated to 8 chars)
- **Payload**: `[schema_version]`
- **Field Types**: `[u32]`
- **Description**: Emitted when governance is unpaused via a governance proposal.

---

## Contract: investment_basket

### Basket Topics Prefix
- Topic 0: `"basket"` (symbol_short, 8 chars → "basket" fits in 6)
- Topic 1: event action (e.g., "created", "deposit", "funded", etc.)

### Events

#### basket.created
- **Topic**: `(basket, created)`
- **Payload**: `[schema_version, basket_id, constituent_count, funding_deadline, min_deposit]`
- **Field Types**: `[u32, u64, usize, u64, i128]`
- **Description**: Emitted when admin creates a new investment basket with specified constituents and funding conditions.

#### basket.fw_close
- **Topic**: `(basket, fw_close)`
- **Payload**: `[schema_version, basket_id, funding_deadline, min_deposit]`
- **Field Types**: `[u32, u64, u64, i128]`
- **Description**: Emitted for baskets with a future funding deadline so off-chain UIs can prompt remaining depositors before permissionless funding opens.

#### basket.deposit
- **Topic**: `(basket, deposit)`
- **Payload**: `[schema_version, basket_id, depositor, amount]`
- **Field Types**: `[u32, u64, Address, i128]`
- **Description**: Emitted when a depositor adds funds to an open basket.

#### basket.funded
- **Topic**: `(basket, funded)`
- **Payload**: `[schema_version, basket_id, total_deposit, total_invested, total_skipped]`
- **Field Types**: `[u32, u64, i128, i128, i128]`
- **Description**: Emitted when the basket is funded (deposit split across constituents). The `total_invested` and `total_skipped` summary fields allow backends to distinguish fully-invested from partially-swept baskets without diffing every constituent (Issue #785).

#### basket.skipped
- **Topic**: `(basket, skipped)`
- **Payload**: `[schema_version, basket_id, campaign_id, share]`
- **Field Types**: `[u32, u64, u64, i128]`
- **Description**: Emitted per constituent that failed to invest (e.g., deadline passed). The depositor's share for that constituent is immediately claimable (Issue #785).

#### basket.claimed
- **Topic**: `(basket, claimed)`
- **Payload**: `[schema_version, basket_id, depositor, payout]`
- **Field Types**: `[u32, u64, Address, i128]`
- **Description**: Emitted when a depositor claims their proportional returns from settled/failed constituents.

#### basket.withdrawn
- **Topic**: `(basket, withdrawn)`
- **Payload**: `[schema_version, basket_id, depositor, amount]`
- **Field Types**: `[u32, u64, Address, i128]`
- **Description**: Emitted when a depositor withdraws principal from a basket stuck open for longer than 7 days (Issue #682).

#### basket.upgraded
- **Topic**: `(basket, upgraded)`
- **Payload**: `[schema_version, new_wasm_hash]`
- **Field Types**: `[u32, BytesN<32>]`
- **Description**: Emitted when the basket contract upgrades its own WASM.

#### basket.paused
- **Topic**: `(basket, paused)`
- **Payload**: `[schema_version, caller]`
- **Field Types**: `[u32, Address]`
- **Description**: Emitted when the guardian or governance pauses basket operations.

#### basket.unpaused
- **Topic**: `(basket, unpausd)` (truncated to 8 chars)
- **Payload**: `[schema_version, caller]`
- **Field Types**: `[u32, Address]`
- **Description**: Emitted when governance unpauses basket operations.

---

## Contract: production_escrow

### Escrow Topics Prefix
- Topic 0: `"escrow"` (symbol_short, 8 chars → "escrow" fits in 6; padded as necessary in actual emission)
- Topic 1: entity type (e.g., "campaign", "order")
- Topic 2: event action (e.g., "created", "invested", etc.)

### Campaign Events

#### campaign.created
- **Topic**: `(escrow, campaign, created)`
- **Payload**: `[schema_version, campaign_id, farmer, token, total_target, deadline]`
- **Field Types**: `[u32, u64, Address, Address, i128, u64]`
- **Description**: Emitted when a farmer creates a new campaign.

#### campaign.invested
- **Topic**: `(escrow, campaign, invested)`
- **Payload**: `[schema_version, campaign_id, investor, amount, token]`
- **Field Types**: `[u32, u64, Address, i128, Address]`
- **Description**: Emitted when an investor commits funds to a campaign.

#### campaign.funded
- **Topic**: `(escrow, campaign, funded)`
- **Payload**: `[schema_version, campaign_id]`
- **Field Types**: `[u32, u64]`
- **Description**: Emitted when a campaign reaches its funding target (auto-transition from Funding to Funded).

#### campaign.start_production
- **Topic**: `(escrow, campaign, startprod)` (truncated)
- **Payload**: `[schema_version, campaign_id, farmer]`
- **Field Types**: `[u32, u64, Address]`
- **Description**: Emitted when a farmer starts production on a fully-funded campaign.

#### campaign.harvest_confirmed
- **Topic**: `(escrow, campaign, harvest)` (truncated)
- **Payload**: `[schema_version, campaign_id, farmer, attester]`
- **Field Types**: `[u32, u64, Address, Address]`
- **Description**: Emitted when an attester confirms harvest completion.

#### campaign.settled
- **Topic**: `(escrow, campaign, settled)`
- **Payload**: `[schema_version, campaign_id, farmer, returns]`
- **Field Types**: `[u32, u64, Address, i128]`
- **Description**: Emitted when a farmer claims settlement on a successfully completed campaign.

#### campaign.refunded
- **Topic**: `(escrow, campaign, refunded)`
- **Payload**: `[schema_version, campaign_id, investor, amount]`
- **Field Types**: `[u32, u64, Address, i128]`
- **Description**: Emitted when an investor is refunded after campaign failure.

#### campaign.finalized_failed
- **Topic**: `(escrow, campaign, finzfail)` (truncated)
- **Payload**: `[schema_version, campaign_id]`
- **Field Types**: `[u32, u64]`
- **Description**: Emitted when a campaign deadline passes and is marked as failed.

#### campaign.paused
- **Topic**: `(escrow, campaign, paused)`
- **Payload**: `[schema_version, campaign_id, caller]`
- **Field Types**: `[u32, u64, Address]`
- **Description**: Emitted when an admin pauses a campaign.

#### campaign.unpaused
- **Topic**: `(escrow, campaign, unpausd)` (truncated)
- **Payload**: `[schema_version, campaign_id, caller]`
- **Field Types**: `[u32, u64, Address]`
- **Description**: Emitted when an admin unpauses a campaign.

### Order Events

#### order.created
- **Topic**: `(escrow, order, created)`
- **Payload**: `[schema_version, order_id, buyer, amount, token, delivery_deadline]`
- **Field Types**: `[u32, u64, Address, i128, Address, u64]`
- **Description**: Emitted when a buyer creates an order with a seller (farmer).

#### order.delivered
- **Topic**: `(escrow, order, deliverd)` (truncated)
- **Payload**: `[schema_version, order_id, farmer, delivery_timestamp]`
- **Field Types**: `[u32, u64, Address, u64]`
- **Description**: Emitted when goods are marked delivered by the farmer.

#### order.confirmed
- **Topic**: `(escrow, order, confirmd)` (truncated)
- **Payload**: `[schema_version, order_id, buyer]`
- **Field Types**: `[u32, u64, Address]`
- **Description**: Emitted when the buyer confirms receipt of goods.

#### order.refunded
- **Topic**: `(escrow, order, refunded)`
- **Payload**: `[schema_version, order_id, buyer, amount]`
- **Field Types**: `[u32, u64, Address, i128]`
- **Description**: Emitted when an order is refunded (delivery deadline passed or buyer-initiated).

### System Events

#### escrow.upgraded
- **Topic**: `(escrow, upgraded)`
- **Payload**: `[schema_version, new_wasm_hash]`
- **Field Types**: `[u32, BytesN<32>]`
- **Description**: Emitted when the escrow contract upgrades its own WASM.

#### escrow.paused
- **Topic**: `(escrow, paused)`
- **Payload**: `[schema_version, caller]`
- **Field Types**: `[u32, Address]`
- **Description**: Emitted when guardian pauses all escrow operations.

#### escrow.unpaused
- **Topic**: `(escrow, unpausd)` (truncated)
- **Payload**: `[schema_version]`
- **Field Types**: `[u32]`
- **Description**: Emitted when governance unpauses escrow operations.

---

## Contract: registry

### Registry Topics Prefix
- Topic 0: `"registry"` (symbol_short, 8 chars → "registr" truncated)
- Topic 1: event action (e.g., "added", "updated", etc.)

### Events

#### registry.whitelist_token_added
- **Topic**: `(registr, addtoken)` (truncated)
- **Payload**: `[schema_version, token]`
- **Field Types**: `[u32, Address]`
- **Description**: Emitted when a token is whitelisted for use in campaigns/orders.

#### registry.whitelist_token_removed
- **Topic**: `(registr, deltoken)` (truncated)
- **Payload**: `[schema_version, token]`
- **Field Types**: `[u32, Address]`
- **Description**: Emitted when a token is removed from whitelist.

#### registry.farmer_registered
- **Topic**: `(registr, farmreg)` (truncated)
- **Payload**: `[schema_version, farmer, farmer_name]`
- **Field Types**: `[u32, Address, Symbol]`
- **Description**: Emitted when a farmer registers in the system.

#### registry.farmer_updated
- **Topic**: `(registr, farmupt)` (truncated)
- **Payload**: `[schema_version, farmer, farmer_name]`
- **Field Types**: `[u32, Address, Symbol]`
- **Description**: Emitted when a farmer's registered information is updated.

#### registry.farmer_deactivated
- **Topic**: `(registr, farmdect)` (truncated)
- **Payload**: `[schema_version, farmer]`
- **Field Types**: `[u32, Address]`
- **Description**: Emitted when a farmer is deactivated from the registry.

#### registry.buyer_registered
- **Topic**: `(registr, buyerreg)` (truncated)
- **Payload**: `[schema_version, buyer]`
- **Field Types**: `[u32, Address]`
- **Description**: Emitted when a buyer registers in the system.

#### registry.buyer_updated
- **Topic**: `(registr, buyerupt)` (truncated)
- **Payload**: `[schema_version, buyer, verification_status]`
- **Field Types**: `[u32, Address, Symbol]`
- **Description**: Emitted when a buyer's information or verification status is updated.

#### registry.buyer_deactivated
- **Topic**: `(registr, buyerdct)` (truncated)
- **Payload**: `[schema_version, buyer]`
- **Field Types**: `[u32, Address]`
- **Description**: Emitted when a buyer is deactivated from the registry.

---

## Backend Integration

Backend indexers must:

1. **Check schema_version**: Each event payload's first field is a u32 schema version. Reject events with unrecognized versions rather than attempting to parse them with the current decoder, which may silently mis-parse newer payloads.

2. **Parse by topic**: Use the (entity, action) topic pair to determine the event type and expected payload shape.

3. **Handle all events**: The contract suite emits 40+ events across governance, baskets, escrow, and registry. A complete indexer should support all of them, not just a subset.

4. **Test against golden fixtures**: Contract test suites emit events with fixed data; capturing the actual XDR output as golden fixtures allows regression testing of the event shape against the contract's current behavior. This is the enforcer for "event schema doesn't drift".

---

## Future Versioning

If a future change alters an event's payload shape:

1. Increment the schema version constant in the contract to 2 (or higher).
2. All new events will emit `schema_version: 2` in their first payload field.
3. Update this document to reflect the change, including new version 2 event shapes for any changed events.
4. Backend indexers can conditionally parse based on schema_version and gracefully handle both old and new shapes, or reject events from an unrecognized future version.
