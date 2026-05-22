-- Agendamentos / calendário (idempotente — pode rodar mais de uma vez)
DO $$ BEGIN
  CREATE TYPE "TaskKind" AS ENUM ('TASK', 'APPOINTMENT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "kind" "TaskKind" NOT NULL DEFAULT 'TASK';
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "conversationId" TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "durationMinutes" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "reminderSentAt" TIMESTAMP(3);
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "googleEventId" TEXT;

CREATE INDEX IF NOT EXISTS "Task_companyId_kind_dueAt_idx" ON "Task"("companyId", "kind", "dueAt");

DO $$ BEGIN
  ALTER TABLE "Task" ADD CONSTRAINT "Task_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "CalendarIntegration" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'GOOGLE',
  "calendarId" TEXT NOT NULL DEFAULT 'primary',
  "refreshToken" TEXT,
  "accessToken" TEXT,
  "tokenExpiresAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CalendarIntegration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CalendarIntegration_companyId_key" ON "CalendarIntegration"("companyId");

DO $$ BEGIN
  ALTER TABLE "CalendarIntegration" ADD CONSTRAINT "CalendarIntegration_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
