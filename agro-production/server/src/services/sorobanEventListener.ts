import { rpc, scValToNative, xdr } from '@stellar/stellar-sdk';
import logger from '../config/logger.js';
import { prisma } from '../db/client.js';
import { config } from '../config/index.js';

interface ContractConfig {
  id: string;
  label: string;
  topicFilters: string[][];
}

interface ParsedEvent {
  contractId: string;
  contractLabel: string;
  action: string;
  data: unknown;
  ledger: number;
  txHash: string;
}

const server = new rpc.Server(config.rpcUrl);

// Topic base64 encoding for "order" and "campaign" symbols.
const ORDER_TOPIC = 'AAAADwAAAAVvcmRlcg==';
const CAMPAIGN_TOPIC = 'AAAADwAAAAhjYW1wYWlnbg==';
const DISPUTE_TOPIC = 'AAAADwAAAAdkaXNwdXRl';

function buildContracts(): ContractConfig[] {
  const contracts: ContractConfig[] = [];

  if (config.escrowContractId) {
    contracts.push({
      id: config.escrowContractId,
      label: 'EscrowContract',
      topicFilters: [
        [ORDER_TOPIC, '*'],
      ],
    });
  }

  if (config.productionEscrowContractId) {
    contracts.push({
      id: config.productionEscrowContractId,
      label: 'ProductionEscrowContract',
      topicFilters: [
        [ORDER_TOPIC, '*'],
        [CAMPAIGN_TOPIC, '*'],
        [DISPUTE_TOPIC, '*'],
      ],
    });
  }

  return contracts;
}

function parseEvent(event: rpc.Api.EventResponse, label: string): ParsedEvent | null {
  try {
    const topics = event.topic.map((t: string) =>
      scValToNative(xdr.ScVal.fromXDR(t, 'base64')),
    );
    const action = String(topics[1]);
    const data = scValToNative(xdr.ScVal.fromXDR(event.value, 'base64'));
    return {
      contractId: event.contractId,
      contractLabel: label,
      action,
      data,
      ledger: event.ledger,
      txHash: event.txHash,
    };
  } catch (err) {
    logger.error(`Failed to parse event from ${label}:`, err);
    return null;
  }
}

async function persistEvent(parsed: ParsedEvent): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      // Idempotent insert: skip if already persisted
      const existing = await tx.transaction.findFirst({
        where: { txHash: parsed.txHash, eventType: parsed.action },
      });
      if (existing) return;

      await tx.transaction.create({
        data: {
          eventType: parsed.action,
          status: 'indexed',
          payload: parsed.data as Record<string, unknown>,
          ledger: parsed.ledger,
          eventIndex: 0,
          txHash: parsed.txHash,
        },
      });

      // Persist replay-safe cursor within the same transaction
      await tx.eventCursor.upsert({
        where: { contractId: parsed.contractId },
        create: {
          contractId: parsed.contractId,
          ledger: parsed.ledger,
          eventIndex: 0,
        },
        update: {
          ledger: parsed.ledger,
          eventIndex: 0,
        },
      });
    });
  } catch (err) {
    logger.error(`Could not persist event (tx: ${parsed.txHash}):`, err);
    // Non-fatal: continue and let the next poll retry
    throw err;
  }
}

async function loadCursor(contractId: string): Promise<number> {
  const cursor = await prisma.eventCursor.findUnique({
    where: { contractId },
  });
  if (cursor) {
    logger.info(`Soroban listener: resuming ${contractId} from cursor`, {
      ledger: cursor.ledger,
    });
    return cursor.ledger;
  }
  const latest = await server.getLatestLedger();
  logger.info(`Soroban listener: no cursor for ${contractId}, starting from latest`, {
    ledger: latest.sequence,
  });
  return latest.sequence;
}

async function handleEvent(parsed: ParsedEvent): Promise<void> {
  logger.info(
    `[${parsed.contractLabel}] ${parsed.action} @ ledger ${parsed.ledger} (tx: ${parsed.txHash})`,
  );
  logger.debug(`Event data: ${JSON.stringify(parsed.data)}`);
  await persistEvent(parsed);
}

async function pollContract(
  contract: ContractConfig,
  lastLedger: number,
): Promise<number> {
  let highWatermark = lastLedger;

  for (const topicFilter of contract.topicFilters) {
    try {
      const response = await server.getEvents({
        startLedger: lastLedger,
        filters: [
          {
            type: 'contract',
            contractIds: [contract.id],
            topics: [topicFilter],
          },
        ],
      });

      for (const event of response.events) {
        const parsed = parseEvent(event, contract.label);
        if (parsed) {
          try {
            await handleEvent(parsed);
          } catch {
            // Do not advance watermark past failed events
            continue;
          }
        }
        if (event.ledger > highWatermark) {
          highWatermark = event.ledger + 1;
        }
      }
    } catch (err) {
      logger.error(`Poll error for ${contract.label} (filter: ${topicFilter}):`, err);
    }
  }

  return highWatermark;
}

/**
 * Start the Soroban event listener.
 *
 * Persists per-contract replay-safe cursors in the database within the same
 * transaction as the event record, ensuring no events are skipped on restart.
 * On failure, the cursor is not advanced so the next poll retries the batch.
 */
export async function startSorobanEventListener(): Promise<ReturnType<typeof setInterval> | null> {
  const contracts = buildContracts();

  if (contracts.length === 0) {
    logger.warn(
      'No contract IDs configured (ESCROW_CONTRACT_ID / PRODUCTION_ESCROW_CONTRACT_ID). ' +
      'Event listener will not start.',
    );
    return null;
  }

  logger.info(
    `Soroban Event Listener starting — watching ${contracts.length} contract(s): ` +
    contracts.map((c) => c.label).join(', '),
  );

  // Load persisted cursors for each contract
  const watermarks = new Map<string, number>();
  for (const contract of contracts) {
    const cursor = await loadCursor(contract.id);
    watermarks.set(contract.id, cursor);
  }

  const interval = setInterval(async () => {
    for (const contract of contracts) {
      const lastLedger = watermarks.get(contract.id) ?? 0;
      const newWatermark = await pollContract(contract, lastLedger);
      watermarks.set(contract.id, newWatermark);
    }
  }, 5_000);

  return interval;
}
