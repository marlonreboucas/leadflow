-- Corrigido: idempotente (shadow DB aplicava antes da migration de embedding existir)
DROP INDEX IF EXISTS "KnowledgeItem_embedding_idx";
ALTER TABLE "KnowledgeItem" DROP COLUMN IF EXISTS "embedding";
