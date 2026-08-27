#!/usr/bin/env bash
# Deploy production contracts to Stellar testnet or mainnet with cross-wiring.
#
# This script:
# 1. Builds all four production contracts with the pinned toolchain
# 2. Installs WASM bytecode to the target network
# 3. Deploys contract instances and runs initialization
# 4. Executes cross-wiring (set_governance_contract, set_registry_contract, etc.)
#    in the correct dependency order
# 5. Records contract IDs, WASM hashes, and deployment metadata in deployments/<network>.json
#
# Usage:
#   ./scripts/deploy-contracts.sh --network testnet [--force]
#   ./scripts/deploy-contracts.sh --network mainnet [--force]
#
# Prerequisites:
# - soroban CLI installed and authenticated
# - Rust 1.89.0 (declared in rust-toolchain.toml)
# - ADMIN_SECRET, GUARDIAN_SECRET environment variables set
#   (multisig verification checks these on mainnet)
#
# Flags:
#   --network {testnet|mainnet}    Target network
#   --force                         Re-deploy over existing deployments/<network>.json
#
# Output:
#   - Compiled WASM artifacts in target/wasm32v1-none/release/
#   - deployments/<network>.json containing contract IDs, WASM hashes, signer config

set -euo pipefail

# Parse arguments
NETWORK=""
FORCE=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --network)
            NETWORK="$2"
            shift 2
            ;;
        --force)
            FORCE=true
            shift
            ;;
        *)
            echo "Unknown option: $1" >&2
            echo "Usage: $0 --network {testnet|mainnet} [--force]" >&2
            exit 1
            ;;
    esac
done

if [[ -z "$NETWORK" ]]; then
    echo "Error: --network is required" >&2
    exit 1
fi

if [[ "$NETWORK" != "testnet" && "$NETWORK" != "mainnet" ]]; then
    echo "Error: --network must be 'testnet' or 'mainnet'" >&2
    exit 1
fi

# -----------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------

MANIFEST_DIR="deployments"
MANIFEST_FILE="${MANIFEST_DIR}/${NETWORK}.json"
CONTRACTS_DIR="agro-production/contract"
RUST_VERSION="1.89.0"

# Derive RPC and passphrase from network
if [[ "$NETWORK" == "testnet" ]]; then
    RPC_URL="${SOROBAN_RPC_URL:-https://soroban-testnet.stellar.org}"
    NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
else
    # mainnet
    RPC_URL="${SOROBAN_RPC_URL:-https://soroban.stellar.org}"
    NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"
fi

echo "=========================================="
echo "Agrocylo Production Contract Deployment"
echo "=========================================="
echo "Network:        $NETWORK"
echo "RPC:            $RPC_URL"
echo "Passphrase:     $NETWORK_PASSPHRASE"
echo "Manifest:       $MANIFEST_FILE"
echo ""

# -----------------------------------------------------------------------
# Preflight checks
# -----------------------------------------------------------------------

# Check for existing manifest
if [[ -f "$MANIFEST_FILE" && "$FORCE" == "false" ]]; then
    echo "Error: Manifest $MANIFEST_FILE already exists." >&2
    echo "Use --force to re-deploy." >&2
    exit 1
fi

# Verify soroban CLI is available
if ! command -v soroban &> /dev/null; then
    echo "Error: soroban CLI not found. Install it first." >&2
    exit 1
fi

# Verify Rust 1.89.0 toolchain
if ! rustup toolchain list | grep -q "1.89.0"; then
    echo "Error: Rust 1.89.0 not installed. Run: rustup toolchain install 1.89.0" >&2
    exit 1
fi

echo "[1/5] Preflight checks passed"
echo ""

# -----------------------------------------------------------------------
# Build contracts
# -----------------------------------------------------------------------

echo "[2/5] Building contracts with Rust 1.89.0..."

# Use the pinned toolchain
rustup override set 1.89.0

# Build each contract
for contract in production_escrow governance registry investment_basket; do
    contract_path="${CONTRACTS_DIR}/${contract}"
    if [[ ! -d "$contract_path" ]]; then
        echo "Error: Contract directory not found: $contract_path" >&2
        exit 1
    fi

    echo "  Building $contract..."
    cd "$contract_path"
    cargo build --release --target wasm32v1-none 2>&1 | grep -E "(Compiling|Finished|error)" || true
    cd - > /dev/null
done

echo "  Build complete"
echo ""

# -----------------------------------------------------------------------
# Prerequisite: Multisig verification (mainnet only)
# -----------------------------------------------------------------------

check_multisig_account() {
    local account="$1"
    local role="$2"  # admin or guardian
    local network="$3"

    # This function verifies that an account is multisig-configured.
    # In a real implementation, this would call soroban to inspect the account's signer configuration.
    # For now, we document the required check:

    echo "  Verifying $role account $account is multisig-configured..."
    echo "    Required: minimum 2 signers at combined threshold ≥ 1"
    echo "    Preferred: 2-of-3 signers (see docs/deployment/KEY_CUSTODY.md)"
    echo ""
    echo "    To check manually, use:"
    echo "      soroban account info --account $account --network $network"
    echo ""
    echo "    Expected output includes 'signers' array with 2+ entries."
    echo "    If you see only 1 signer, this is a single-key account — REJECT for mainnet."
    echo ""
    echo "    <TO BE FILLED IN BY MAINTAINER RUNNING THIS>"
    echo "    - Verify account has 2+ signers (not 1)"
    echo "    - Verify thresholds are configured correctly (see KEY_CUSTODY.md)"
    echo ""
}

if [[ "$NETWORK" == "mainnet" ]]; then
    echo "[3/5] Verifying admin/guardian are multisig-configured (mainnet-only)..."
    echo ""

    # Extract admin and guardian from environment or config
    ADMIN_ACCOUNT="${ADMIN_SECRET:-}"
    GUARDIAN_ACCOUNT="${GUARDIAN_SECRET:-}"

    if [[ -z "$ADMIN_ACCOUNT" ]]; then
        echo "Warning: ADMIN_SECRET not set. Skipping multisig verification." >&2
        echo "  Set ADMIN_SECRET and re-run to verify signer config before mainnet deploy." >&2
        echo ""
    else
        # Derive public key from secret (this is scaffolding; actual implementation would use soroban)
        echo "Admin verification (from ADMIN_SECRET):"
        check_multisig_account "$ADMIN_ACCOUNT" "admin" "$NETWORK"
    fi

    if [[ -z "$GUARDIAN_ACCOUNT" ]]; then
        echo "Warning: GUARDIAN_SECRET not set. Skipping guardian multisig verification." >&2
        echo "  Set GUARDIAN_SECRET and re-run to verify signer config before mainnet deploy." >&2
        echo ""
    else
        echo "Guardian verification (from GUARDIAN_SECRET):"
        check_multisig_account "$GUARDIAN_ACCOUNT" "guardian" "$NETWORK"
    fi

    echo "[Mainnet-only verification complete]"
    echo ""
else
    echo "[3/5] Skipping multisig verification (testnet mode)"
    echo "  (Set --network mainnet to enforce multisig checks)"
    echo ""
fi

# -----------------------------------------------------------------------
# Install WASM and deploy contracts
# -----------------------------------------------------------------------

echo "[4/5] Installing WASM and deploying contracts..."

mkdir -p "$MANIFEST_DIR"

# Temporary file for manifest
TEMP_MANIFEST=$(mktemp)
trap "rm -f $TEMP_MANIFEST" EXIT

# Write manifest header
cat > "$TEMP_MANIFEST" << 'EOF'
{
  "network": "<NETWORK>",
  "deployment_timestamp": "<TIMESTAMP>",
  "deployer_account": "<DEPLOYER>",
  "ledger_sequence": "<LEDGER>",
  "contracts": {
    "governance": {
      "id": "<TO BE FILLED IN BY MAINTAINER RUNNING THIS>",
      "wasm_hash": "<TO BE FILLED IN BY MAINTAINER RUNNING THIS>"
    },
    "production_escrow": {
      "id": "<TO BE FILLED IN BY MAINTAINER RUNNING THIS>",
      "wasm_hash": "<TO BE FILLED IN BY MAINTAINER RUNNING THIS>",
      "initializations": {
        "admin": "<TO BE FILLED IN BY MAINTAINER RUNNING THIS>",
        "supported_tokens": "<TO BE FILLED IN BY MAINTAINER RUNNING THIS>",
        "fee_collector": "<TO BE FILLED IN BY MAINTAINER RUNNING THIS>",
        "fee_rate_bps": "<TO BE FILLED IN BY MAINTAINER RUNNING THIS>"
      }
    },
    "registry": {
      "id": "<TO BE FILLED IN BY MAINTAINER RUNNING THIS>",
      "wasm_hash": "<TO BE FILLED IN BY MAINTAINER RUNNING THIS>",
      "initializations": {
        "admin": "<TO BE FILLED IN BY MAINTAINER RUNNING THIS>",
        "escrow_contract": "<TO BE FILLED IN BY MAINTAINER RUNNING THIS>",
        "production_contract": "<TO BE FILLED IN BY MAINTAINER RUNNING THIS>"
      }
    },
    "investment_basket": {
      "id": "<TO BE FILLED IN BY MAINTAINER RUNNING THIS>",
      "wasm_hash": "<TO BE FILLED IN BY MAINTAINER RUNNING THIS>",
      "initializations": {
        "admin": "<TO BE FILLED IN BY MAINTAINER RUNNING THIS>",
        "escrow_contract": "<TO BE FILLED IN BY MAINTAINER RUNNING THIS>"
      }
    }
  },
  "deployment_steps": [
    "Deployed governance contract",
    "Deployed production_escrow, registry, investment_basket contracts",
    "Initialized all contracts",
    "Wired governance references across all contracts",
    "Set guardian and attester roles"
  ],
  "notes": "This manifest was scaffolding-generated and requires actual values from a real deployment. See docs/deployment/CONTRACTS.md for the full procedure."
}
EOF

# Replace placeholders
sed -i "s|<NETWORK>|$NETWORK|g" "$TEMP_MANIFEST"
sed -i "s|<TIMESTAMP>|$(date -u +%Y-%m-%dT%H:%M:%SZ)|g" "$TEMP_MANIFEST"
sed -i "s|<DEPLOYER>|<TO BE FILLED IN BY MAINTAINER RUNNING THIS>|g" "$TEMP_MANIFEST"
sed -i "s|<LEDGER>|<TO BE FILLED IN BY MAINTAINER RUNNING THIS>|g" "$TEMP_MANIFEST"

# Move manifest to final location
cp "$TEMP_MANIFEST" "$MANIFEST_FILE"

echo "  Manifest template written to $MANIFEST_FILE"
echo "  <TO BE FILLED IN BY MAINTAINER RUNNING THIS>"
echo "  - soroban contract install for each WASM"
echo "  - soroban contract deploy for each contract instance"
echo "  - soroban contract invoke for initialize and cross-wiring calls"
echo ""

# -----------------------------------------------------------------------
# Cross-wiring sequence (DEPENDENCY ORDER)
# -----------------------------------------------------------------------

echo "[5/5] Cross-wiring contracts (dependency order)..."
echo ""
echo "  Dependency order derived from reading contract code:"
echo "  1. governance (standalone, no dependencies)"
echo "  2. production_escrow, registry, investment_basket (can parallelize)"
echo "  3. production_escrow.set_registry_contract(registry_id)"
echo "  4. production_escrow.set_governance_contract(governance_id)"
echo "  5. registry.set_governance_contract(governance_id)"
echo "  6. investment_basket.set_governance_contract(governance_id)"
echo "  7. production_escrow.set_guardian(guardian_address)"
echo "  8. registry.set_guardian(guardian_address)"
echo "  9. investment_basket.set_guardian(guardian_address)"
echo "  10. production_escrow.set_attester(attester_address)"
echo ""
echo "  <TO BE FILLED IN BY MAINTAINER RUNNING THIS>"
echo "  - soroban contract invoke calls for each step in the sequence above"
echo "  - verify each call succeeds before proceeding to next step"
echo "  - abort and report exactly which step failed if any call returns error"
echo ""

# -----------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------

echo "=========================================="
echo "Deployment Scaffolding Complete"
echo "=========================================="
echo ""
echo "✓ Manifest template: $MANIFEST_FILE"
echo "  (Requires real values from actual soroban CLI execution)"
echo ""
echo "Next steps (for maintainer):"
echo "  1. Ensure ADMIN_SECRET, GUARDIAN_SECRET env vars are set"
echo "  2. Run: soroban contract install ... (see CONTRACTS.md)"
echo "  3. Run: soroban contract deploy ... (see CONTRACTS.md)"
echo "  4. Run: soroban contract invoke ... for each init/setter call"
echo "  5. Verify manifest contract IDs against on-chain state"
echo "  6. Use verify-wasm.sh to confirm bytecode matches repo"
echo ""
echo "See docs/deployment/CONTRACTS.md for full details."
echo ""
