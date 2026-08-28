-- AlterTable: event_cursors — add ledgerHash field for reorg detection
ALTER TABLE "event_cursors" ADD COLUMN "ledgerHash" TEXT;
