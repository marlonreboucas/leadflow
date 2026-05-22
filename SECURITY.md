# Segurança e dados sensíveis

## Chaves de API (OpenAI, Evolution, JWT)

- **Nunca** commite chaves no Git. Use apenas `.env` (já está no `.gitignore`).
- **Nunca** cole chaves em chat, issues, PRs ou screenshots.
- Se uma chave vazar: **revogue imediatamente** no painel do provedor e gere outra.
- O projeto lê `OPENAI_API_KEY` só em runtime via variável de ambiente — não há treinamento nem persistência da chave no código.

## OpenAI — uso no LeadFlow

- Chamadas à API da OpenAI (Fase 3+) usam a chave do **seu** `.env`; dados enviados seguem a [política de dados da OpenAI para API](https://openai.com/policies/api-data-usage-policies) (por padrão, dados da API não são usados para treinar modelos, salvo opt-in explícito na conta).
- **Não** envie para a OpenAI: senhas, tokens JWT, chaves `sk-*`, dados de cartão ou PII desnecessária.
- Logs da API redigem `Authorization` e campos sensíveis (ver `pinoHttp.redact` em `app.module.ts`).

## Dados dos clientes (multi-tenant)

- Toda query Prisma deve ser escopada por `companyId`.
- Não use conteúdo de conversas/mensagens para treinar modelos fora do fluxo explícito do produto (RAG na KB da empresa, Fase 3).

## Checklist antes de commit

```bash
git status   # .env não deve aparecer
git diff     # sem sk-proj-, Bearer tokens, senhas reais
```
