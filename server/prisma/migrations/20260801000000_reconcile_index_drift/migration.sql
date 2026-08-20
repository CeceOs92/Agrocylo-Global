-- Reconciles indexes that had drifted between prisma/schema.prisma and the
-- actual migration-created tables (surfaced by `prisma migrate diff` once
-- the migration history could replay end-to-end again). Every index below
-- was declared in schema.prisma but never materialized by a migration, or
-- (for disputes) materialized but never declared and redundant with the
-- existing unique index on the same column.

-- CreateIndex
CREATE INDEX IF NOT EXISTS "buyer_demands_buyer_wallet_created_at_idx" ON "buyer_demands"("buyer_wallet", "created_at" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "buyer_demands_crop_name_idx" ON "buyer_demands"("crop_name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "farmer_supplies_farmer_wallet_available_from_idx" ON "farmer_supplies"("farmer_wallet", "available_from");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "farmer_supplies_crop_name_price_per_unit_idx" ON "farmer_supplies"("crop_name", "price_per_unit");

-- DropIndex
-- Redundant with the unique index Postgres already maintains for the
-- @unique constraint on disputes.orderIdOnChain (disputes_orderIdOnChain_key).
DROP INDEX IF EXISTS "disputes_orderIdOnChain_idx";
