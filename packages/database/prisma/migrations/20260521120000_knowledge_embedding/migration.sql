-- pgvector embedding for RAG (Fase 3)
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "KnowledgeItem" ADD COLUMN IF NOT EXISTS embedding vector(1536);

CREATE INDEX IF NOT EXISTS "KnowledgeItem_embedding_idx"
  ON "KnowledgeItem" USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
