import type OpenAI from 'openai';

export const AI_TOOL_DEFINITIONS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'move_deal_stage',
      description:
        'Move o lead/deal para outro estágio do funil. Use stageName (ex: Qualificação) se não souber o ID.',
      parameters: {
        type: 'object',
        properties: {
          dealId: { type: 'string' },
          stageId: { type: 'string', description: 'ID do estágio (opcional se stageName informado)' },
          stageName: {
            type: 'string',
            description: 'Nome do estágio, ex: Qualificação, Proposta',
          },
        },
        required: ['dealId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Cria uma tarefa de follow-up',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          dealId: { type: 'string' },
          dueAt: { type: 'string', description: 'ISO date' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'schedule_event',
      description:
        'Agenda compromisso no calendário (reunião, demo, visita). Use dueAt em ISO (2026-05-22T14:00:00) ou dueAtText em português (ex: amanhã 14h, segunda 10:00). Confirma horário com o cliente antes se estiver ambíguo.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          dealId: { type: 'string' },
          conversationId: { type: 'string' },
          dueAt: { type: 'string', description: 'ISO 8601' },
          dueAtText: { type: 'string', description: 'Data/hora em português' },
          durationMinutes: { type: 'number' },
          description: { type: 'string' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'apply_tag',
      description: 'Aplica etiqueta ao lead',
      parameters: {
        type: 'object',
        properties: {
          dealId: { type: 'string' },
          tagName: { type: 'string' },
        },
        required: ['dealId', 'tagName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_template',
      description: 'Envia mensagem WhatsApp usando template cadastrado (por nome)',
      parameters: {
        type: 'object',
        properties: {
          templateName: { type: 'string' },
          conversationId: { type: 'string' },
        },
        required: ['templateName', 'conversationId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'transfer_to_human',
      description: 'Transfere a conversa para um atendente humano',
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_lead_field',
      description: 'Atualiza título, valor ou temperatura do lead',
      parameters: {
        type: 'object',
        properties: {
          dealId: { type: 'string' },
          title: { type: 'string' },
          valueCents: { type: 'number' },
          temperature: { type: 'string', enum: ['COLD', 'WARM', 'HOT'] },
        },
        required: ['dealId'],
      },
    },
  },
];

export type ToolName =
  | 'move_deal_stage'
  | 'create_task'
  | 'schedule_event'
  | 'apply_tag'
  | 'send_template'
  | 'transfer_to_human'
  | 'update_lead_field';
