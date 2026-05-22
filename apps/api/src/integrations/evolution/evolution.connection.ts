export type WhatsappConnectionStatus =
  | 'PENDING'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'DISCONNECTED';

export function mapEvolutionConnectionStatus(raw?: string | null): WhatsappConnectionStatus {
  const s = (raw ?? '').toLowerCase();
  if (s === 'open' || s === 'connected') return 'CONNECTED';
  if (s === 'close' || s === 'disconnected') return 'DISCONNECTED';
  if (s === 'connecting') return 'CONNECTING';
  return 'PENDING';
}

export function phoneFromOwnerJid(ownerJid?: string | null): string | undefined {
  if (!ownerJid) return undefined;
  const digits = ownerJid.replace(/@.*/, '').replace(/\D/g, '');
  return digits || undefined;
}
