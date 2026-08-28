-- Rename the existing order-scoped chat tables to Marketplace* — they were
-- never actually reconciled with the route code, which expects a
-- MarketplaceConversation/MarketplaceMessage model shape distinct from the
-- campaign (farmer/investor) conversation feature added below.

ALTER TABLE "conversations" RENAME TO "marketplace_conversations";
ALTER TABLE "messages" RENAME TO "marketplace_messages";
ALTER TABLE "conversation_participants" RENAME TO "marketplace_conversation_participants";

ALTER TABLE "marketplace_conversations" RENAME CONSTRAINT "conversations_pkey" TO "marketplace_conversations_pkey";
ALTER TABLE "marketplace_conversations" RENAME CONSTRAINT "conversations_orderId_fkey" TO "marketplace_conversations_orderId_fkey";
ALTER INDEX "conversations_orderId_key" RENAME TO "marketplace_conversations_orderId_key";
ALTER INDEX "conversations_buyerAddress_idx" RENAME TO "marketplace_conversations_buyerAddress_idx";
ALTER INDEX "conversations_sellerAddress_idx" RENAME TO "marketplace_conversations_sellerAddress_idx";

ALTER TABLE "marketplace_messages" RENAME CONSTRAINT "messages_pkey" TO "marketplace_messages_pkey";
ALTER TABLE "marketplace_messages" RENAME CONSTRAINT "messages_conversationId_fkey" TO "marketplace_messages_conversationId_fkey";
ALTER INDEX "messages_conversationId_createdAt_idx" RENAME TO "marketplace_messages_conversationId_createdAt_idx";
ALTER INDEX "messages_senderAddress_idx" RENAME TO "marketplace_messages_senderAddress_idx";

ALTER TABLE "marketplace_conversation_participants" RENAME CONSTRAINT "conversation_participants_pkey" TO "marketplace_conversation_participants_pkey";
ALTER TABLE "marketplace_conversation_participants" RENAME CONSTRAINT "conversation_participants_conversationId_fkey" TO "marketplace_conversation_participants_conversationId_fkey";
ALTER INDEX "conversation_participants_conversationId_walletAddress_key" RENAME TO "marketplace_conversation_participants_conversationId_wallet_key";
ALTER INDEX "conversation_participants_conversationId_idx" RENAME TO "marketplace_conversation_participants_conversationId_idx";
ALTER INDEX "conversation_participants_walletAddress_idx" RENAME TO "marketplace_conversation_participants_walletAddress_idx";

-- Create the campaign-scoped (farmer/investor) conversation feature.

CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "farmerAddress" TEXT NOT NULL,
    "investorAddress" TEXT NOT NULL,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "conversations_campaignId_investorAddress_key" ON "conversations"("campaignId", "investorAddress");
CREATE INDEX "conversations_farmerAddress_idx" ON "conversations"("farmerAddress");
CREATE INDEX "conversations_investorAddress_idx" ON "conversations"("investorAddress");

ALTER TABLE "conversations" ADD CONSTRAINT "conversations_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderAddress" TEXT NOT NULL,
    "content" VARCHAR(4000) NOT NULL,
    "type" "MessageType" NOT NULL DEFAULT 'TEXT',
    "fileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "messages_conversationId_createdAt_idx" ON "messages"("conversationId", "createdAt" DESC);
CREATE INDEX "messages_senderAddress_idx" ON "messages"("senderAddress");

ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Per-conversation moderation: one participant blocking another, and
-- reporting a specific message.

CREATE TABLE "blocked_users" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "blockerAddress" TEXT NOT NULL,
    "blockedAddress" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocked_users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "blocked_users_conversationId_blockerAddress_blockedAddress_key" ON "blocked_users"("conversationId", "blockerAddress", "blockedAddress");
CREATE INDEX "blocked_users_conversationId_idx" ON "blocked_users"("conversationId");

ALTER TABLE "blocked_users" ADD CONSTRAINT "blocked_users_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "message_reports" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "reporterAddress" TEXT NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_reports_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "message_reports_messageId_idx" ON "message_reports"("messageId");

ALTER TABLE "message_reports" ADD CONSTRAINT "message_reports_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
