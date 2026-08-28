"use strict";
/**
 * Production-Escrow contract interaction.
 *
 * Builds unsigned transactions for the agro-production escrow contract
 * (NEXT_PUBLIC_PRODUCTION_CONTRACT_ID) and returns the XDR string ready
 * for wallet signing.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCreateCampaign = buildCreateCampaign;
exports.buildCreateOrder = buildCreateOrder;
exports.buildInvest = buildInvest;
exports.buildClaimReturns = buildClaimReturns;
const StellarSdk = __importStar(require("@stellar/stellar-sdk"));
const RPC_URL = process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015";
const CONTRACT_ID = process.env.NEXT_PUBLIC_PRODUCTION_CONTRACT_ID ?? "";
function server() {
    return new StellarSdk.rpc.Server(RPC_URL);
}
function contract() {
    if (!CONTRACT_ID) {
        throw new Error("NEXT_PUBLIC_PRODUCTION_CONTRACT_ID is not set. Configure it with your deployed production-escrow contract address.");
    }
    return new StellarSdk.Contract(CONTRACT_ID);
}
/**
 * Build a `create_campaign` transaction for the production-escrow contract.
 *
 * @param farmer       - Stellar public key of the farmer
 * @param tokenAddress - Token contract address
 * @param targetAmount - Target funding amount in base units (i128)
 * @param deadline     - Deadline timestamp in seconds (u64)
 */
async function buildCreateCampaign(farmer, tokenAddress, targetAmount, deadline) {
    try {
        const rpcServer = server();
        const escrow = contract();
        const sourceAccount = await rpcServer.getAccount(farmer);
        const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
            fee: StellarSdk.BASE_FEE,
            networkPassphrase: NETWORK_PASSPHRASE,
        })
            .addOperation(escrow.call("create_campaign", new StellarSdk.Address(farmer).toScVal(), new StellarSdk.Address(tokenAddress).toScVal(), StellarSdk.nativeToScVal(targetAmount, { type: "i128" }), StellarSdk.nativeToScVal(BigInt(deadline), { type: "u64" })))
            .setTimeout(30)
            .build();
        const simulated = await rpcServer.simulateTransaction(tx);
        if (StellarSdk.rpc.Api.isSimulationError(simulated)) {
            throw new Error(`Simulation failed: ${simulated.error}`);
        }
        const prepared = StellarSdk.rpc
            .assembleTransaction(tx, simulated)
            .build();
        return { success: true, data: prepared.toXDR() };
    }
    catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
}
/**
 * Build a `create_order` transaction for the production-escrow contract.
 *
 * @param buyer      - Stellar public key of the buyer
 * @param campaignId - On-chain campaign ID (u64 as string)
 * @param amount     - Token amount in base units (i128)
 */
async function buildCreateOrder(buyer, campaignId, amount) {
    try {
        const rpcServer = server();
        const escrow = contract();
        const sourceAccount = await rpcServer.getAccount(buyer);
        const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
            fee: StellarSdk.BASE_FEE,
            networkPassphrase: NETWORK_PASSPHRASE,
        })
            .addOperation(escrow.call("create_order", new StellarSdk.Address(buyer).toScVal(), StellarSdk.nativeToScVal(BigInt(campaignId), { type: "u64" }), StellarSdk.nativeToScVal(amount, { type: "i128" })))
            .setTimeout(30)
            .build();
        const simulated = await rpcServer.simulateTransaction(tx);
        if (StellarSdk.rpc.Api.isSimulationError(simulated)) {
            throw new Error(`Simulation failed: ${simulated.error}`);
        }
        const prepared = StellarSdk.rpc
            .assembleTransaction(tx, simulated)
            .build();
        return { success: true, data: prepared.toXDR() };
    }
    catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
}
/**
 * Build an `invest` transaction for the production-escrow contract.
 *
 * The contract requires the investor address as the authenticated source and
 * the campaign's on-chain u64 ID. `amount` is always expressed in base units
 * (stroops for XLM), never a JavaScript floating-point value.
 */
async function buildInvest(investor, campaignId, amount) {
    try {
        const rpcServer = server();
        const escrow = contract();
        const sourceAccount = await rpcServer.getAccount(investor);
        const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
            fee: StellarSdk.BASE_FEE,
            networkPassphrase: NETWORK_PASSPHRASE,
        })
            .addOperation(escrow.call("invest", new StellarSdk.Address(investor).toScVal(), StellarSdk.nativeToScVal(BigInt(campaignId), { type: "u64" }), StellarSdk.nativeToScVal(amount, { type: "i128" })))
            .setTimeout(30)
            .build();
        const simulated = await rpcServer.simulateTransaction(tx);
        if (StellarSdk.rpc.Api.isSimulationError(simulated)) {
            throw new Error(`Simulation failed: ${simulated.error}`);
        }
        const prepared = StellarSdk.rpc
            .assembleTransaction(tx, simulated)
            .build();
        return { success: true, data: prepared.toXDR() };
    }
    catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
}
/**
 * Build a `claim_returns` transaction for the production-escrow contract.
 *
 * The investor claims their proportional share of remaining escrow after settlement.
 */
async function buildClaimReturns(investor, campaignId) {
    try {
        const rpcServer = server();
        const escrow = contract();
        const sourceAccount = await rpcServer.getAccount(investor);
        const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
            fee: StellarSdk.BASE_FEE,
            networkPassphrase: NETWORK_PASSPHRASE,
        })
            .addOperation(escrow.call("claim_returns", new StellarSdk.Address(investor).toScVal(), StellarSdk.nativeToScVal(BigInt(campaignId), { type: "u64" })))
            .setTimeout(30)
            .build();
        const simulated = await rpcServer.simulateTransaction(tx);
        if (StellarSdk.rpc.Api.isSimulationError(simulated)) {
            throw new Error(`Simulation failed: ${simulated.error}`);
        }
        const prepared = StellarSdk.rpc
            .assembleTransaction(tx, simulated)
            .build();
        return { success: true, data: prepared.toXDR() };
    }
    catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
}
//# sourceMappingURL=contractService.js.map