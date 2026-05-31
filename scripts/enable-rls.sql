-- ============================================================================
-- RLS LeadFlow — defesa em profundidade no Postgres (OPT-IN / MANUAL)
-- ============================================================================
-- Pré-requisitos (ver docs/RLS-OPTIONAL.md):
--   1. A API deve conectar com role SEM BYPASSRLS, OU usar FORCE (abaixo já força).
--   2. A app deve setar app.company_id por transação (PrismaService.runWithTenant
--      com DB_RLS=true). Sem isso, TODAS as queries retornam vazio.
--   3. Aplicar em janela de manutenção e validar em staging primeiro.
--
-- Rodar como superuser/owner:  psql "$DATABASE_URL" -f scripts/enable-rls.sql
-- ============================================================================

DO $$
DECLARE
  t text;
  -- Tabelas com companyId NOT NULL (isolamento direto por tenant).
  tables text[] := ARRAY[
    'CompanyUser','Invite','Subscription','UsageLimit','WhatsappInstance',
    'Contact','Conversation','Message','Pipeline','Deal','Task','Tag',
    'AiAgent','KnowledgeBase','AiAgentLog','AiConversationSummary',
    'AutomationRule','AutomationExecution','N8nWebhook','MessageTemplate',
    'CalendarIntegration'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING ("companyId" = current_setting(''app.company_id'', true))',
      t
    );
  END LOOP;
END $$;

-- Tabelas com companyId NULLABLE (logs/roles de sistema): permite linhas
-- globais (companyId IS NULL) além das do tenant atual.
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['WebhookLog','AuditLog','Role'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING ("companyId" = current_setting(''app.company_id'', true) OR "companyId" IS NULL)',
      t
    );
  END LOOP;
END $$;

-- NOTA: tabelas-filhas sem companyId direto (PipelineStage, KnowledgeItem,
-- DealTag, ContactTag, AiAgentRule, AutomationCondition/Action, etc.) continuam
-- protegidas pela camada de aplicação. Para estendê-las, crie policies com
-- subquery no pai (ex.: stageId -> Pipeline.companyId).
