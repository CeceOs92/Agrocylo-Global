/**
 * Production-Escrow contract interaction.
 *
 * Builds unsigned transactions for the agro-production escrow contract
 * (NEXT_PUBLIC_PRODUCTION_CONTRACT_ID) and returns the XDR string ready
 * for wallet signing.
 */
export interface ContractResult<T> {
    success: boolean;
    data?: T;
    error?: string;
}
/**
 * Build a `create_campaign` transaction for the production-escrow contract.
 *
 * @param farmer       - Stellar public key of the farmer
 * @param tokenAddress - Token contract address
 * @param targetAmount - Target funding amount in base units (i128)
 * @param deadline     - Deadline timestamp in seconds (u64)
 */
export declare function buildCreateCampaign(farmer: string, tokenAddress: string, targetAmount: bigint, deadline: number): Promise<ContractResult<string>>;
/**
 * Build a `create_order` transaction for the production-escrow contract.
 *
 * @param buyer      - Stellar public key of the buyer
 * @param campaignId - On-chain campaign ID (u64 as string)
 * @param amount     - Token amount in base units (i128)
 */
export declare function buildCreateOrder(buyer: string, campaignId: string, amount: bigint): Promise<ContractResult<string>>;
/**
 * Build an `invest` transaction for the production-escrow contract.
 *
 * The contract requires the investor address as the authenticated source and
 * the campaign's on-chain u64 ID. `amount` is always expressed in base units
 * (stroops for XLM), never a JavaScript floating-point value.
 */
export declare function buildInvest(investor: string, campaignId: string, amount: bigint): Promise<ContractResult<string>>;
/**
 * Build a `claim_returns` transaction for the production-escrow contract.
 *
 * The investor claims their proportional share of remaining escrow after settlement.
 */
export declare function buildClaimReturns(investor: string, campaignId: string): Promise<ContractResult<string>>;
//# sourceMappingURL=contractService.d.ts.map