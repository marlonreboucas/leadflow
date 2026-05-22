import { api } from './api';

export type AiAgent = {
  id: string;
  name: string;
  type: string;
  model: string;
  mode: string;
  isActive: boolean;
  systemPrompt: string;
  voiceTone?: string | null;
  objective?: string | null;
  temperature: number;
  maxTokens: number;
  knowledgeBases?: { kb: { id: string; name: string } }[];
  _count?: { logs: number };
};

export async function fetchAgents() {
  const { data } = await api.get<AiAgent[]>('/ai-agents');
  return data;
}

export async function fetchAgent(id: string) {
  const { data } = await api.get<AiAgent & { logs: unknown[]; rules: unknown[] }>(`/ai-agents/${id}`);
  return data;
}

export async function testAgent(id: string, message: string) {
  const { data } = await api.post<{
    reply: string;
    decision: string;
    inputTokens: number;
    outputTokens: number;
    costCents: number;
    toolCalls: string[];
  }>(`/ai-agents/${id}/test`, { message });
  return data;
}

export async function createAgent(body: Record<string, unknown>) {
  const { data } = await api.post<AiAgent>('/ai-agents', body);
  return data;
}

export async function updateAgent(id: string, body: Record<string, unknown>) {
  const { data } = await api.patch<AiAgent>(`/ai-agents/${id}`, body);
  return data;
}
