# Production Contract Deployment Guide

This document describes how to deploy the four production Soroban contracts to Stellar testnet or mainnet, verify WASM integrity, and manage the multisig admin/guardian roles.

**Issue References:** #778, #779

## Overview

The four contracts form an interdependent system:
- **governance** — Manages proposals, voting, and timelocked execution of parameter changes and upgrades
- **production_escrow** — Holds investor funds in escrow, manages campaign lifecycle
- **registry** — Tracks orders and cross-links escrow/production contracts
- **investment_basket** — Manages batched fund investments

They must be deployed and cross-wired in a specific dependency order to ensure all references are valid.

## Deployment Architecture

### Contract Dependency Order

Derived from reading `initialize` and setter functions in each contract:

1. **governance** (standalone, no external dependencies)
   - `initialize(admin, voting_period_secs, timelock_delay_secs, upgrade_timelock_delay_secs, quorum_weight)`

2. **production_escrow, registry, investment_basket** (can deploy in parallel)
   - `production_escrow.initialize(admin, supported_tokens, fee_collector, fee_rate_bps)`
   - `registry.initialize(admin, escrow_contract, production_contract)`
   - `investment_basket.initialize(admin, escrow_contract)`

3. **Wire registry reference** (production_escrow depends on registry address)
   - `production_escrow.set_registry_contract(registry_id)`

4. **Wire governance** (all contracts reference governance once configured)
   - `production_escrow.set_governance_contract(governance_id)`
   - `registry.set_governance_contract(governance_id)`
   - `investment_basket.set_governance_contract(governance_id)`

5. **Set guardian** (governance-gated, requires multisig after #779)
   - `production_escrow.set_guardian(guardian_address)`
   - `registry.set_guardian(guardian_address)`
   - `investment_basket.set_guardian(guardian_address)`

6. **Set attester** (admin-only, production_escrow only)
   - `production_escrow.set_attester(attester_address)`

### Why This Order Matters

- **governance first** — Other contracts check governance exists before accepting governance-gated operations. Deploying it first ensures `set_governance_contract` calls won't fail on a missing address.
- **registry before set_registry_contract** — production_escrow's `set_registry_contract` must point to an already-deployed registry instance.
- **governance before set_governance_contract** — Same reasoning: all contracts must have a live governance address to wire.
- **set_guardian after governance** — The `set_guardian` functions themselves are governance-gated (once governance is configured), so governance must already be deployed and wired.

## Prerequisites

### Required Tools
- **soroban CLI** — `>= 21.0.0`. Install: https://github.com/stellar/rs-soroban-cli/releases
- **Rust 1.89.0** — Declared in `rust-toolchain.toml`. Install: `rustup toolchain install 1.89.0`
- **Docker** (for `verify-wasm.sh`) — For reproducible WASM builds independent of host toolchain

### Required Environment Variables
- `SOROBAN_RPC_URL` — RPC endpoint (default: testnet)
- `SOROBAN_NETWORK_PASSPHRASE` — Network identifier (default: testnet)
- `ADMIN_SECRET` — Stellar secret key for the admin signer (or deploy identity)
- `GUARDIAN_SECRET` — Stellar secret key for the guardian signer (mainnet only, checked by deploy script)

### Required Configuration
- A `deployments/` directory (created by `deploy-contracts.sh`)
- Network-specific configuration file or environment (e.g., `.env.testnet`, `.env.mainnet`)

## Deployment Steps

### Step 1: Build with `deploy-contracts.sh`

The script builds all contracts and prepares a deployment manifest:

```bash
# Testnet (first try)
./scripts/deploy-contracts.sh --network testnet

# Mainnet (verify on testnet first!)
./scripts/deploy-contracts.sh --network mainnet

# Re-deploy over existing manifest (use with caution)
./scripts/deploy-contracts.sh --network testnet --force
```

What the script does:
1. Verifies soroban CLI and Rust 1.89.0 are available
2. Builds all four contracts with the pinned toolchain
3. (On mainnet) Verifies the admin and guardian accounts are multisig-configured
4. Creates `deployments/<network>.json` template (NOT executed yet, see below)

**Output:** `deployments/<network>.json` with placeholder values

### Step 2: Install WASM and Deploy Instances (Manual)

The actual `soroban` CLI calls must be run by the maintainer. Commands follow this pattern:

```bash
# Set network and auth
export SOROBAN_RPC_URL="https://soroban-testnet.stellar.org"
export SOROBAN_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"

# Use your secret key (or identity)
soroban config identity create deploy-key --secret-key "S..."

# 1. Install WASM for each contract
soroban contract install \
  --wasm target/wasm32v1-none/release/production_escrow.wasm \
  --source deploy-key
# Returns WASM hash (e.g., c5b7d9...); record it

soroban contract install \
  --wasm target/wasm32v1-none/release/governance.wasm \
  --source deploy-key
# ... repeat for registry.wasm, investment_basket.wasm

# 2. Deploy each contract instance
soroban contract deploy \
  --wasm-ref <WASM_HASH_FROM_STEP_1> \
  --address-book ~/.soroban/testnet-address-book.json \
  --source deploy-key \
  --network testnet
# Returns contract ID (e.g., C...)

# Repeat for each contract, recording all IDs
```

**Important:** Save each contract ID and WASM hash in `deployments/<network>.json` as you deploy.

### Step 3: Initialize and Wire Contracts (Manual)

For each contract in dependency order, call `initialize` then cross-wiring setters:

```bash
# 1. Governance
soroban contract invoke \
  --id C_GOVERNANCE_ID \
  --source deploy-key \
  -- initialize \
  --admin GADMIN \
  --voting_period_secs 604800 \
  --timelock_delay_secs 172800 \
  --upgrade_timelock_delay_secs 1209600 \
  --quorum_weight 1000

# 2. Production Escrow (with required tokens)
soroban contract invoke \
  --id C_PRODUCTION_ESCROW_ID \
  --source deploy-key \
  -- initialize \
  --admin GADMIN \
  --supported_tokens '[CUSDC]' \
  --fee_collector GFEE_COLLECTOR \
  --fee_rate_bps 300

# 3. Registry
soroban contract invoke \
  --id C_REGISTRY_ID \
  --source deploy-key \
  -- initialize \
  --admin GADMIN \
  --escrow_contract C_PRODUCTION_ESCROW_ID \
  --production_contract C_PRODUCTION_ESCROW_ID

# 4. Investment Basket
soroban contract invoke \
  --id C_BASKET_ID \
  --source deploy-key \
  -- initialize \
  --admin GADMIN \
  --escrow_contract C_PRODUCTION_ESCROW_ID

# 5. Wire registry into escrow
soroban contract invoke \
  --id C_PRODUCTION_ESCROW_ID \
  --source deploy-key \
  -- set_registry_contract \
  --admin_caller GADMIN \
  --registry C_REGISTRY_ID

# 6. Wire governance into all contracts
soroban contract invoke \
  --id C_PRODUCTION_ESCROW_ID \
  --source deploy-key \
  -- set_governance_contract \
  --admin_caller GADMIN \
  --governance C_GOVERNANCE_ID

soroban contract invoke \
  --id C_REGISTRY_ID \
  --source deploy-key \
  -- set_governance_contract \
  --admin_caller GADMIN \
  --governance C_GOVERNANCE_ID

soroban contract invoke \
  --id C_BASKET_ID \
  --source deploy-key \
  -- set_governance_contract \
  --admin_caller GADMIN \
  --governance C_GOVERNANCE_ID

# 7. Set guardian (see Key Custody section below for multisig setup)
soroban contract invoke \
  --id C_PRODUCTION_ESCROW_ID \
  --source deploy-key \
  -- set_guardian \
  --caller GADMIN \
  --guardian G_GUARDIAN_MULTISIG

soroban contract invoke \
  --id C_REGISTRY_ID \
  --source deploy-key \
  -- set_guardian \
  --caller GADMIN \
  --guardian G_GUARDIAN_MULTISIG

soroban contract invoke \
  --id C_BASKET_ID \
  --source deploy-key \
  -- set_guardian \
  --caller GADMIN \
  --guardian G_GUARDIAN_MULTISIG

# 8. Set attester (production_escrow only, admin-only, not governance-gated)
soroban contract invoke \
  --id C_PRODUCTION_ESCROW_ID \
  --source deploy-key \
  -- set_attester \
  --admin_caller GADMIN \
  --attester G_ATTESTER
```

### Step 4: Verify Deployment

After each step (or at the end), verify contract state:

```bash
# Read back initialized values
soroban contract invoke --id C_PRODUCTION_ESCROW_ID -- get_admin
soroban contract invoke --id C_GOVERNANCE_ID -- get_admin
soroban contract invoke --id C_REGISTRY_ID -- get_admin
soroban contract invoke --id C_BASKET_ID -- get_admin

# Verify governance was wired
soroban contract invoke --id C_PRODUCTION_ESCROW_ID -- get_governance_contract
# Should return C_GOVERNANCE_ID
```

### Step 5: Update Deployment Manifest

Update `deployments/<network>.json` with actual contract IDs, WASM hashes, and ledger sequence:

```json
{
  "network": "testnet",
  "deployment_timestamp": "2025-09-15T14:30:00Z",
  "deployer_account": "GDEVACCOUNT...",
  "ledger_sequence": 12345678,
  "contracts": {
    "governance": {
      "id": "CGOVGOV...",
      "wasm_hash": "abc123..."
    },
    "production_escrow": {
      "id": "CESCROW...",
      "wasm_hash": "def456...",
      "initializations": {
        "admin": "GADMIN...",
        "supported_tokens": ["CUSDC..."],
        "fee_collector": "GFEE...",
        "fee_rate_bps": 300
      }
    },
    "registry": {
      "id": "CREG...",
      "wasm_hash": "ghi789...",
      "initializations": {
        "admin": "GADMIN...",
        "escrow_contract": "CESCROW...",
        "production_contract": "CESCROW..."
      }
    },
    "investment_basket": {
      "id": "CBASKET...",
      "wasm_hash": "jkl012...",
      "initializations": {
        "admin": "GADMIN...",
        "escrow_contract": "CESCROW..."
      }
    }
  },
  "deployment_steps": [
    "Deployed governance",
    "Deployed production_escrow, registry, investment_basket",
    "Initialized all contracts",
    "Wired governance references",
    "Set guardian and attester roles"
  ]
}
```

## Reproducible Build Verification

Use `scripts/verify-wasm.sh` to independently confirm on-chain WASM matches this repository:

```bash
# Get the WASM hash for a deployed contract
WASM_HASH=$(soroban contract code-get-hash --id CESCROW... --network testnet)

# Verify it matches the repo
./scripts/verify-wasm.sh production_escrow "$WASM_HASH"
# Output: VERIFIED: production_escrow matches on-chain WASM
```

The script:
1. Builds the contract in a pinned Docker image (Rust 1.89.0)
2. Computes SHA-256 of the resulting WASM
3. Compares against the on-chain hash
4. Returns exit code 0 (match) or 1 (mismatch)

**How third parties use this:**
- Auditors can verify that on-chain bytecode was built from this exact repository
- Maintainers can prove no secrets were embedded in WASM
- Users can trust the deployed code is exactly what's in version control

## Key Custody & Multisig Setup

See `docs/deployment/KEY_CUSTODY.md` (created in issue #779).

**Summary:**
- **admin** must be a multisig Stellar account with 2-of-3 signers (or configured threshold)
- **guardian** must also be multisig-configured (for `pause` authorization)
- Pre-deploy verification ensures mainnet deployments reject single-key admin/guardian
- Key rotation procedures prevent dropping below minimum signer threshold mid-rotation

## Rollback & Emergency Procedures

See `docs/deployment/INCIDENT_RUNBOOK.md` (created in issue #780).

**Quick reference:**
- If deployment fails mid-sequence, consult the error message and logs
- Abort without continuing past the failed step (the script enforces this)
- Once all deployments succeed, use `pause` (guardian-only, instant) if a live bug is found
- Use governance proposal/voting flow for formal fixes and upgrades (timelocked)
- Governance is the only path to `unpause` (no guardian solo power)

## Troubleshooting

### "Contract not initialized"
The `initialize` call didn't succeed or was run against a different contract instance. Check:
- Contract ID is correct
- Admin signer is authorized
- All arguments (tokens, fee rate, etc.) are valid

### "NotGovernance" or "NotAdmin" error
A setter (like `set_governance_contract`) was called by an unauthorized signer. Check:
- If governance is already wired, only governance contract can call (except bootstrap)
- If governance is not wired, only admin can call
- Caller identity matches expected account

### "WASM hash mismatch"
The on-chain WASM doesn't match the repository. Possible causes:
- Repository was modified after deployment (check git status)
- Deployment used a different Rust version (verify 1.89.0)
- Network glitch during install (re-run `soroban contract install` and re-deploy)

### Deployment fails mid-sequence
The script exits non-zero and reports exactly which step failed:
1. Do not attempt to continue or retry without understanding the error
2. Consult the error message and contract logs
3. Fix the underlying issue (bad arguments, authorization, etc.)
4. Consider re-running with `--force` if re-deploying the same network

## Maintenance & Updates

### To upgrade contract WASM
See `docs/CONTRACT_UPGRADES.md` for the full governance-gated flow.

**Quick:**
1. Governance proposes an upgrade (with the new WASM hash)
2. Voting period passes, proposal is queued
3. Upgrade timelock passes (14 days by default)
4. Guardian or governance calls `pause` (instant)
5. Governance executes the upgrade (which calls `contract.upgrade(new_wasm_hash)`)
6. If the upgrade changes stored data, call `contract.migrate(...)`
7. Governance calls `unpause` (only path to un-pause)

### To rotate signers
See `docs/deployment/KEY_CUSTODY.md` (issue #779).

## References
- **Issue #778:** Deployment scripting (this guide)
- **Issue #779:** Multisig verification and key custody
- **Issue #780:** Incident runbook and pause/unpause procedures
- **Contract Upgrades:** `docs/CONTRACT_UPGRADES.md`
- **Soroban CLI Docs:** https://developers.stellar.org/learn/building-apps/cli
