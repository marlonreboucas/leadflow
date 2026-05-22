export const PERMISSIONS = {
  LEADS_VIEW: 'leads.view',
  LEADS_CREATE: 'leads.create',
  LEADS_UPDATE: 'leads.update',
  LEADS_DELETE: 'leads.delete',
  CONVERSATIONS_VIEW: 'conversations.view',
  CONVERSATIONS_ASSUME: 'conversations.assume',
  MESSAGES_SEND: 'messages.send',
  AGENTS_VIEW: 'agents.view',
  AGENTS_MANAGE: 'agents.manage',
  AUTOMATIONS_MANAGE: 'automations.manage',
  WHATSAPP_CONNECT: 'whatsapp.connect',
  REPORTS_VIEW: 'reports.view',
  USERS_MANAGE: 'users.manage',
  BILLING_MANAGE: 'billing.manage',
  SETTINGS_MANAGE: 'settings.manage',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
