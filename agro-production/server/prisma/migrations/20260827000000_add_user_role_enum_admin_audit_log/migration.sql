-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('INVESTOR', 'FARMER', 'BUYER', 'ADMIN');

-- AlterTable: users — convert role from TEXT to UserRole enum
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_role_check";
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole" USING "role"::"UserRole";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'INVESTOR'::"UserRole";

-- CreateTable: admin_audit_logs
CREATE TABLE "admin_audit_logs" (
    "id" TEXT NOT NULL,
    "actorAddress" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "details" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "admin_audit_logs_actorAddress_idx" ON "admin_audit_logs"("actorAddress");
CREATE INDEX "admin_audit_logs_action_idx" ON "admin_audit_logs"("action");
CREATE INDEX "admin_audit_logs_createdAt_idx" ON "admin_audit_logs"("createdAt" DESC);
