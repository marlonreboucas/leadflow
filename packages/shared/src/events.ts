export const SOCKET_EVENTS = {
  CONVERSATION_CREATED: 'conversation.created',
  CONVERSATION_UPDATED: 'conversation.updated',
  MESSAGE_RECEIVED: 'message.received',
  MESSAGE_SENT: 'message.sent',
  MESSAGE_STATUS_UPDATED: 'message.status.updated',
  LEAD_UPDATED: 'lead.updated',
  DEAL_MOVED: 'deal.moved',
  AI_TYPING: 'ai.typing',
  AI_RESPONSE_GENERATED: 'ai.response.generated',
  AGENT_ASSIGNED: 'agent.assigned',
  AUTOMATION_EXECUTED: 'automation.executed',
  WHATSAPP_STATUS_UPDATED: 'whatsapp.status.updated',

  // client → server
  CONVERSATION_JOIN: 'conversation.join',
  CONVERSATION_LEAVE: 'conversation.leave',
  CONVERSATION_TYPING: 'conversation.typing',
} as const;

export type SocketEvent = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];

export const roomKey = {
  company: (companyId: string) => `company:${companyId}`,
  conversation: (conversationId: string) => `conversation:${conversationId}`,
};
