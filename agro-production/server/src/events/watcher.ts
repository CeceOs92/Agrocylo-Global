import { rpc } from "@stellar/stellar-sdk";
import { config } from "../config/index.js";
import logger from "../config/logger.js";
import { prisma } from "../db/client.js";
import { ProductionEventParser } from "./parser.js";
import { EventPersister } from "./persister.js";
import type { RawSorobanEvent } from "./types.js";

const POLL_INTERVAL_MS = 5_000;
const MAX_LEDGER_GAP = 1_000;
// base64 encoding of "campaign" and "order" short symbols
const CAMPAIGN_TOPIC = "AAAADwAAAAhjYW1wYWlnbg==";
const ORDER_TOPIC = "AAAADwAAAAVvcmRlcg==";

/**
 * Loads the last persisted ledger checkpoint from the database.
 * Falls back to the current on-chain tip when no checkpoint exists.
 */
async function loadCheckpoint(server: rpc.Server): Promise<number> {
  const lastTx = await prisma.transaction.findFirst({ orderBy: { ledger: "desc" } });
  if (lastTx) {
    logger.info("Production watcher: resuming from persisted checkpoint", {
      ledger: lastTx.ledger,
    });
    return lastTx.ledger;
  }
  const latest = await server.getLatestLedger();
  logger.info("Production watcher: no checkpoint found, starting from current ledger", {
    ledger: latest.sequence,
  });
  return latest.sequence;
}

/**
 * Detects gaps between the local checkpoint and the current on-chain tip and
 * fast-forwards the checkpoint when the gap exceeds MAX_LEDGER_GAP to prevent
 * unbounded re-processing on long outages.
 */
async function reconcileGap(server: rpc.Server, lastLedger: number): Promise<number> {
  try {
    const latest = await server.getLatestLedger();
    const gap = latest.sequence - lastLedger;
    if (gap > MAX_LEDGER_GAP) {
      logger.warn("Production watcher: large ledger gap detected, fast-forwarding checkpoint", {
        lastLedger,
        currentLedger: latest.sequence,
        gap,
        maxGap: MAX_LEDGER_GAP,
      });
      return latest.sequence - MAX_LEDGER_GAP;
    }
  } catch (err) {
    logger.warn("Production watcher: could not fetch latest ledger for gap check", { error: err });
  }
  return lastLedger;
}

export async function startProductionWatcher(): Promise<void> {
  const server = new rpc.Server(config.rpcUrl);
  logger.info("Production contract watcher started", { contractId: config.contractId });

  let lastLedger = await loadCheckpoint(server);
  lastLedger = await reconcileGap(server, lastLedger);

  setInterval(async () => {
    try {
      const response = await server.getEvents({
        startLedger: lastLedger,
        filters: [
          {
            type: "contract",
            contractIds: [config.contractId],
            topics: [[CAMPAIGN_TOPIC, "*"]],
          },
          {
            type: "contract",
            contractIds: [config.contractId],
            topics: [[ORDER_TOPIC, "*"]],
          },
        ],
      });

      let highWaterMark = lastLedger;

      for (const rawEvent of response.events) {
        const event = ProductionEventParser.tryParse(rawEvent as unknown as RawSorobanEvent);
        if (event) {
          await EventPersister.persist(event).catch((err) =>
            logger.error("EventPersister error", { error: err }),
          );
        }
        if (rawEvent.ledger > highWaterMark) {
          highWaterMark = rawEvent.ledger;
        }
      }

      // Advance checkpoint only after all events in the batch are processed.
      if (highWaterMark > lastLedger) {
        lastLedger = highWaterMark + 1;
        logger.debug("Production watcher: checkpoint advanced", { ledger: lastLedger });
      }
    } catch (err) {
      logger.error("Production watcher poll error", { error: err });
    }
  }, POLL_INTERVAL_MS);
}
