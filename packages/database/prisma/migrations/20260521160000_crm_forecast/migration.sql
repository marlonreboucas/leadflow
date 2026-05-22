-- Forecast por etapa + motivo de ganho
ALTER TABLE "PipelineStage" ADD COLUMN IF NOT EXISTS "winProbability" INTEGER;

ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "winReason" TEXT;

UPDATE "PipelineStage" SET "winProbability" = 5   WHERE "isWon" = false AND "isLost" = false AND "position" = 0 AND "winProbability" IS NULL;
UPDATE "PipelineStage" SET "winProbability" = 15  WHERE "isWon" = false AND "isLost" = false AND "position" = 1 AND "winProbability" IS NULL;
UPDATE "PipelineStage" SET "winProbability" = 35  WHERE "isWon" = false AND "isLost" = false AND "position" = 2 AND "winProbability" IS NULL;
UPDATE "PipelineStage" SET "winProbability" = 60  WHERE "isWon" = false AND "isLost" = false AND "position" = 3 AND "winProbability" IS NULL;
UPDATE "PipelineStage" SET "winProbability" = 80  WHERE "isWon" = false AND "isLost" = false AND "position" = 4 AND "winProbability" IS NULL;
UPDATE "PipelineStage" SET "winProbability" = 100 WHERE "isWon" = true AND "winProbability" IS NULL;
UPDATE "PipelineStage" SET "winProbability" = 0   WHERE "isLost" = true AND "winProbability" IS NULL;
