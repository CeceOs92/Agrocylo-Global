# Agro-production contracts

The canonical production escrow contract is
[`production_escrow`](./production_escrow). It is the only production escrow
crate in the workspace and is the contract targeted by
`NEXT_PUBLIC_PRODUCTION_CONTRACT_ID` and `PRODUCTION_ESCROW_CONTRACT_ID`.

It manages campaign funding, investor positions, production lifecycle events,
orders, settlement, refunds, and disputes. The `registry` crate stores farmer
and campaign registration metadata.

## Commands

Run the canonical escrow unit suite from the repository root:

```bash
cargo test -p production_escrow
```

Build its deployable Wasm artifact:

```bash
cargo build -p production_escrow --target wasm32-unknown-unknown --release
```
