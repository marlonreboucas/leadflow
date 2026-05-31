-- Idempotência de webhooks (Stripe e futuros provedores).
-- id = id do evento do provedor; PK garante dedup de entregas duplicadas.
CREATE TABLE IF NOT EXISTS "ProcessedWebhookEvent" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProcessedWebhookEvent_pkey" PRIMARY KEY ("id")
);
