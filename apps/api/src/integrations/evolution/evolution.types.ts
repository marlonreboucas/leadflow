export type EvolutionWebhookEvent =
  | 'messages.upsert'
  | 'messages.update'
  | 'connection.update'
  | 'qrcode.updated'
  | string;

export interface EvolutionWebhookPayload {
  event: EvolutionWebhookEvent;
  instance: string;
  data?: unknown;
  [key: string]: unknown;
}
