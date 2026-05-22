export type AutomationConditionInput = {
  field: string;
  operator: string;
  value: unknown;
};

export type AutomationContext = {
  message?: { body?: string | null; direction?: string };
  conversation?: { id: string; status?: string };
  contact?: { id?: string; phone?: string; name?: string | null };
  deal?: {
    id: string;
    title?: string;
    stageId?: string;
    stageName?: string;
    temperature?: string;
    pipelineId?: string;
  } | null;
  fromStageId?: string;
  toStageId?: string;
  task?: { id: string; title: string };
};

export type AutomationJobPayload = {
  companyId: string;
  trigger: string;
  context: AutomationContext;
  ruleId?: string;
  dryRun?: boolean;
};

export type ActionLogEntry = {
  type: string;
  ok: boolean;
  message: string;
};

export type QueueAddFn = (name: string, data: unknown) => Promise<unknown>;
