import { api } from './api';

export type Pipeline = {
  id: string;
  name: string;
  isDefault: boolean;
  stages: PipelineStage[];
};

export type PipelineStage = {
  id: string;
  name: string;
  position: number;
  color: string | null;
  isWon: boolean;
  isLost: boolean;
  winProbability?: number | null;
};

export type Contact = {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
};

export type Deal = {
  id: string;
  title: string;
  valueCents: number;
  status: 'OPEN' | 'WON' | 'LOST';
  temperature: 'COLD' | 'WARM' | 'HOT';
  stageId: string;
  pipelineId: string;
  nextActionAt: string | null;
  contact: Contact;
  stage: Pick<PipelineStage, 'id' | 'name' | 'position' | 'color' | 'isWon' | 'isLost'>;
  pipeline: { id: string; name: string };
  ownerUser: { id: string; name: string; avatarUrl: string | null } | null;
  ownerAgent: { id: string; name: string; avatarUrl: string | null } | null;
};

export type Task = {
  id: string;
  title: string;
  description: string | null;
  status: 'PENDING' | 'DOING' | 'DONE' | 'CANCELED';
  dueAt: string | null;
  dealId: string | null;
  assignee: { id: string; name: string } | null;
  deal: { id: string; title: string } | null;
  createdByAgent: { id: string; name: string } | null;
};

export function formatBRL(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export const temperatureLabel: Record<Deal['temperature'], string> = {
  COLD: 'Frio',
  WARM: 'Morno',
  HOT: 'Quente',
};

export const temperatureClass: Record<Deal['temperature'], string> = {
  COLD: 'bg-slate-100 text-slate-700',
  WARM: 'bg-amber-100 text-amber-800',
  HOT: 'bg-red-100 text-red-800',
};

export async function fetchPipelines() {
  const { data } = await api.get<Pipeline[]>('/pipelines');
  return data;
}

export async function fetchDeals(params: Record<string, string | number | undefined>) {
  const { data } = await api.get<{ items: Deal[]; total: number }>('/deals', { params });
  return data;
}

export async function fetchDeal(id: string) {
  const { data } = await api.get<Deal & { tasks?: Task[]; createdAt?: string }>(`/deals/${id}`);
  return data;
}

export type TimelineItem = {
  id: string;
  type: 'message' | 'ai' | 'task' | 'deal';
  at: string;
  title: string;
  body?: string | null;
  meta?: Record<string, string>;
};

export async function fetchDealTimeline(dealId: string) {
  const { data } = await api.get<{ items: TimelineItem[] }>(`/deals/${dealId}/timeline`);
  return data.items;
}

export async function moveDeal(id: string, stageId: string, lossReason?: string) {
  const { data } = await api.post<Deal>(`/deals/${id}/move`, { stageId, lossReason });
  return data;
}

export async function updateDeal(
  id: string,
  body: Partial<Pick<Deal, 'title' | 'valueCents' | 'temperature'>>,
) {
  const { data } = await api.patch<Deal>(`/deals/${id}`, body);
  return data;
}

export async function closeDeal(
  id: string,
  status: 'WON' | 'LOST',
  reason?: string,
) {
  const { data } = await api.post<Deal>(`/deals/${id}/close`, {
    status,
    ...(status === 'LOST' ? { lossReason: reason } : { winReason: reason }),
  });
  return data;
}

export type PipelineForecast = {
  pipelineId: string;
  pipelineName: string;
  totalOpenValue: number;
  weightedForecast: number;
  openDealCount: number;
  wonThisMonthCount: number;
  wonThisMonthValueCents: number;
  byStage: Array<{
    stageId: string;
    stageName: string;
    winProbability: number;
    dealCount: number;
    totalValueCents: number;
    weightedValueCents: number;
  }>;
};

export async function fetchPipelineForecast(pipelineId: string) {
  const { data } = await api.get<PipelineForecast>(`/pipelines/${pipelineId}/forecast`);
  return data;
}

export async function fetchTasks(params?: Record<string, string | number | boolean | undefined>) {
  const { data } = await api.get<{ items: Task[]; total: number }>('/tasks', { params });
  return data;
}

export async function updateTask(id: string, body: { status?: Task['status'] }) {
  const { data } = await api.patch<Task>(`/tasks/${id}`, body);
  return data;
}
