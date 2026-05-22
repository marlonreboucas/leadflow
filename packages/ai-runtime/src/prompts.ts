export type AgentPersona = {
  name: string;
  type: string;
  systemPrompt: string;
  voiceTone?: string | null;
  objective?: string | null;
};

export type PromptContext = {
  companyName: string;
  contactName?: string | null;
  contactPhone: string;
  dealId?: string | null;
  dealTitle?: string | null;
  dealStage?: string | null;
  pipelineStages?: string[];
  summary?: string | null;
  knowledgeSnippets: string[];
};

export function buildSystemPrompt(agent: AgentPersona, ctx: PromptContext): string {
  const kb =
    ctx.knowledgeSnippets.length > 0
      ? `\n\n## Base de conhecimento\n${ctx.knowledgeSnippets.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
      : '';

  const deal = ctx.dealTitle
    ? `\nLead atual: ${ctx.dealTitle}${ctx.dealId ? ` [id=${ctx.dealId}]` : ''}${ctx.dealStage ? ` — estágio: ${ctx.dealStage}` : ''}`
    : '';
  const stages =
    ctx.pipelineStages?.length
      ? `\nEstágios do funil (use stageName em move_deal_stage): ${ctx.pipelineStages.join(', ')}`
      : '';

  return `${agent.systemPrompt}

## Contexto
Empresa: ${ctx.companyName}
Contato: ${ctx.contactName ?? 'Desconhecido'} (${ctx.contactPhone})${deal}${stages}
${ctx.summary ? `\nResumo da conversa: ${ctx.summary}` : ''}
${agent.voiceTone ? `\nTom de voz: ${agent.voiceTone}` : ''}
${agent.objective ? `\nObjetivo: ${agent.objective}` : ''}
${kb}

## Regras
- Responda em português do Brasil, de forma clara e profissional.
- Se o cliente pedir humano, atendente ou pessoa real, use a tool transfer_to_human.
- Não invente preços ou políticas que não estejam na base de conhecimento.
- Use tools quando precisar alterar CRM (mover estágio, criar tarefa, etc.).
- Para agendar horário (demo, reunião, visita), use schedule_event com dueAt ou dueAtText. Confirme data e hora com o cliente e repita o horário na resposta.`;
}

export const HUMAN_ESCALATION_PATTERNS = [
  /falar com (um )?humano/i,
  /atendente (humano|real)/i,
  /pessoa real/i,
  /quero (um )?atendente/i,
  /transfer(ir|e) (para|pra) (humano|pessoa)/i,
];

export function customerWantsHuman(text: string): boolean {
  return HUMAN_ESCALATION_PATTERNS.some((re) => re.test(text));
}
