# Contract Events Standardization

This document outlines the standard observability infrastructure for all smart contract events.
VERY important for: indexers, notifications, analytics, and dashboards.

## Off-Chain Schema

We utilize PostgreSQL indexing, event consumers, websocket notifications, and reconciliation strategies. Ensure all payloads map to off-chain PostgreSQL types (e.g., `i128` to `NUMERIC`, `u64` to `BIGINT`).

## Events Catalog

Every event must include these fields: `escrow_id`, `buyer`, `farmer`, `amount`, `token`.

### `escrow_created`
* **Emitted When:** Buyer creates escrow.
* **Payload:**
```json
{
  "escrow_id": "u64",
  "buyer": "Address",
  "farmer": "Address",
  "amount": "i128",
  "token": "Address"
}
```
* **Indexing strategy:** Insert into `escrow_orders` table.

### `escrow_delivered`
* **Emitted When:** Farmer marks order as delivered.
* **Payload:** `(order_id, farmer, buyer, timestamp)`
* **Indexing strategy:** Update `escrow_orders` status to `Delivered`.

### `escrow_confirmed`
* **Emitted When:** Buyer confirms receipt and releases funds.
* **Payload:** `(order_id, buyer, farmer)`
* **Indexing strategy:** Update status to `Completed`.

### `escrow_refunded`
* **Emitted When:** Expired order is refunded.
* **Payload:** `(order_id, buyer)`
* **Indexing strategy:** Update status to `Refunded`.

### `escrow_disputed`
* **Emitted When:** Buyer or farmer opens a dispute.
* **Payload:** `(order_id, opened_by, buyer, farmer)`
* **Indexing strategy:** Insert into `disputes` table, update `escrow_orders` status to `Disputed`.

### `escrow_resolved`
* **Emitted When:** Admin resolves a dispute.
* **Payload:** `(order_id, resolution_type, buyer, farmer)`
* **Indexing strategy:** Update `disputes` table and `escrow_orders` table appropriately.
