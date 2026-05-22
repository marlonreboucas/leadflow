# RLS Postgres (opcional — produção)

O LeadFlow já isola tenants na aplicação (`companyId` em queries + `TenantInterceptor`). Para **defesa em profundidade** no Postgres:

```sql
-- Executar como superuser no banco leadflow
ALTER TABLE "Deal" ENABLE ROW LEVEL SECURITY;
CREATE POLICY deal_tenant ON "Deal"
  USING ("companyId" = current_setting('app.company_id', true));

-- Repetir para tabelas sensíveis: Message, Conversation, Contact, AiAgent, etc.
-- Antes de cada request HTTP, a API deve executar:
-- SET LOCAL app.company_id = '<companyId>';
```

Recomendação: habilitar RLS apenas após validar que todos os workers definem `app.company_id` nas conexões de escrita.
