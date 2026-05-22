import OpenAI from 'openai';
import type { PrismaClient } from '@leadflow/database';
import { AI_TOOL_DEFINITIONS, type ToolName } from './tools';
import { buildSystemPrompt, customerWantsHuman, type AgentPersona } from './prompts';
import { executeTool } from './executor';
import { searchKnowledgeSnippets } from './knowledge';

export type RunAgentOptions = {
  conversationId: string;
  agentId?: string;
  /** Playground: mensagem simulada sem persistir */
  testMessage?: string;
  dryRun?: boolean;
};

export type RunAgentResult = {
  reply: string;
  decision: string;
  reasoning?: string;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  latencyMs: number;
  toolCalls: string[];
  suggestOnly: boolean;
};

const INPUT_COST_PER_1M = 15; // cents per 1M tokens (gpt-4o-mini approx)
const OUTPUT_COST_PER_1M = 60;

function estimateCostCents(input: number, output: number) {
  return Math.ceil((input * INPUT_COST_PER_1M + output * OUTPUT_COST_PER_1M) / 1_000_000);
}

export async function runAgent(
  prisma: PrismaClient,
  openaiKey: string,
  options: RunAgentOptions,
): Promise<RunAgentResult> {
  const started = Date.now();
  const client = new OpenAI({ apiKey: openaiKey });

  const conversation = await prisma.conversation.findUnique({
    where: { id: options.conversationId },
    include: {
      contact: true,
      company: true,
      currentAgent: true,
      deals: { include: { stage: true }, take: 1, orderBy: { updatedAt: 'desc' } },
      messages: { orderBy: { createdAt: 'desc' }, take: 24 },
    },
  });
  if (!conversation) throw new Error('Conversa não encontrada');

  const agentId = options.agentId ?? conversation.currentAgentId;
  if (!agentId) throw new Error('Nenhum agente atribuído');

  const agent = await prisma.aiAgent.findFirst({
    where: { id: agentId, companyId: conversation.companyId, isActive: true },
    include: { knowledgeBases: { include: { kb: { select: { id: true } } } } },
  });
  if (!agent) throw new Error('Agente não encontrado ou inativo');

  if (conversation.isAiPaused && !options.testMessage) {
    return {
      reply: '',
      decision: 'skipped_paused',
      inputTokens: 0,
      outputTokens: 0,
      costCents: 0,
      latencyMs: Date.now() - started,
      toolCalls: [],
      suggestOnly: true,
    };
  }

  const lastInbound = conversation.messages.find((m) => m.direction === 'INBOUND');
  const triggerText = options.testMessage ?? lastInbound?.body ?? '';
  if (triggerText && customerWantsHuman(triggerText)) {
    if (!options.dryRun && !options.testMessage) {
    await executeTool(prisma, conversation.companyId, agent.id, 'transfer_to_human', {
      conversationId: conversation.id,
      reason: 'Cliente pediu atendimento humano',
    });
      return {
        reply: 'Claro! Vou transferir você para um atendente humano agora. Um momento, por favor.',
        decision: 'transfer_human',
        reasoning: 'Cliente solicitou humano',
        inputTokens: 0,
        outputTokens: 0,
        costCents: 0,
        latencyMs: Date.now() - started,
        toolCalls: ['transfer_to_human'],
        suggestOnly: false,
      };
    }
    return {
      reply: 'Entendi — em produção eu transferiria para um atendente humano.',
      decision: 'transfer_human_dry',
      reasoning: 'Cliente solicitou humano (simulação)',
      inputTokens: 0,
      outputTokens: 0,
      costCents: 0,
      latencyMs: Date.now() - started,
      toolCalls: [],
      suggestOnly: true,
    };
  }

  const summary = await prisma.aiConversationSummary.findFirst({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: 'desc' },
  });

  const deal = conversation.deals[0];
  const kbIds = agent.knowledgeBases.map((l) => l.kb.id);
  const kbQuery = [triggerText, deal?.title].filter(Boolean).join(' ') || 'produtos preços';
  let kbSnippets = await searchKnowledgeSnippets(prisma, openaiKey, kbIds, kbQuery, 6);
  if (!kbSnippets.length && kbIds.length) {
    const fallbackItems = await prisma.knowledgeItem.findMany({
      where: { kbId: { in: kbIds } },
      take: 5,
    });
    kbSnippets = fallbackItems.map(
      (i) => `[${i.kind}] ${i.title}: ${i.content.slice(0, 400)}`,
    );
  }
  const pipelineStages = deal
    ? (
        await prisma.pipelineStage.findMany({
          where: { pipelineId: deal.pipelineId },
          orderBy: { position: 'asc' },
          select: { name: true },
        })
      ).map((s) => s.name)
    : [];
  const persona: AgentPersona = {
    name: agent.name,
    type: agent.type,
    systemPrompt: agent.systemPrompt,
    voiceTone: agent.voiceTone,
    objective: agent.objective,
  };

  const system = buildSystemPrompt(persona, {
    companyName: conversation.company.name,
    contactName: conversation.contact.name,
    contactPhone: conversation.contact.phone,
    dealId: deal?.id,
    dealTitle: deal?.title,
    dealStage: deal?.stage?.name,
    pipelineStages,
    summary: summary?.summary,
    knowledgeSnippets: kbSnippets.slice(0, 8),
  });

  const history = [...conversation.messages]
    .reverse()
    .filter((m) => m.body)
    .map((m) => ({
      role: m.direction === 'INBOUND' ? ('user' as const) : ('assistant' as const),
      content: m.body!,
    }));

  if (options.testMessage) {
    history.push({ role: 'user', content: options.testMessage });
  }

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: system },
    ...history.slice(-20),
  ];

  let inputTokens = 0;
  let outputTokens = 0;
  const toolCalls: string[] = [];
  let reply = '';

  for (let round = 0; round < 4; round++) {
    const completion = await client.chat.completions.create({
      model: agent.model,
      messages,
      tools: AI_TOOL_DEFINITIONS,
      tool_choice: 'auto',
      temperature: agent.temperature,
      max_tokens: agent.maxTokens,
    });

    inputTokens += completion.usage?.prompt_tokens ?? 0;
    outputTokens += completion.usage?.completion_tokens ?? 0;

    const choice = completion.choices[0]?.message;
    if (!choice) break;

    if (choice.tool_calls?.length) {
      messages.push(choice);
      for (const tc of choice.tool_calls) {
        const fn = tc.function;
        const name = fn.name as ToolName;
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(fn.arguments || '{}');
        } catch {
          args = {};
        }
        args.conversationId = conversation.id;
        if (deal?.id && !args.dealId) args.dealId = deal.id;
        toolCalls.push(name);
        const result = options.dryRun
          ? { ok: true, message: 'dry-run' }
          : await executeTool(prisma, conversation.companyId, agent.id, name, args);
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }
      continue;
    }

    reply = choice.content?.trim() ?? '';
    break;
  }

  const suggestOnly = agent.mode === 'SUGGEST' || agent.mode === 'HUMAN_APPROVAL' || !!options.testMessage;
  const latencyMs = Date.now() - started;
  const costCents = estimateCostCents(inputTokens, outputTokens);

  return {
    reply,
    decision: suggestOnly ? 'suggest' : 'auto_reply',
    inputTokens,
    outputTokens,
    costCents,
    latencyMs,
    toolCalls,
    suggestOnly,
  };
}
