-- Revogação de sessões: versão de token por usuário.
-- Incrementar tokenVersion invalida todos os JWTs emitidos antes (logout-all,
-- troca de senha). A validação compara o "tv" do token com este valor.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;
