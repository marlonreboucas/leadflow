export const QUEUES = {
  INCOMING_MESSAGE: 'process-incoming-message',
  SEND_WHATSAPP: 'send-whatsapp-message',
  RUN_AI_AGENT: 'run-ai-agent',
  CLASSIFY_LEAD: 'classify-lead',
  SUMMARIZE_CONVERSATION: 'summarize-conversation',
  EXECUTE_AUTOMATION: 'execute-automation',
  SEND_TO_N8N: 'send-to-n8n',
  SYNC_WHATSAPP_STATUS: 'sync-whatsapp-status',
  PROCESS_MEDIA: 'process-media',
  CALCULATE_USAGE: 'calculate-usage',
  GENERATE_REPORTS: 'generate-reports',
  IDLE_LEAD_SCANNER: 'idle-lead-scanner',
  TASK_OVERDUE_SCANNER: 'task-overdue-scanner',
  INDEX_KNOWLEDGE: 'index-knowledge-item',
  APPOINTMENT_REMINDER_SCANNER: 'appointment-reminder-scanner',
  SYNC_GOOGLE_CALENDAR: 'sync-google-calendar',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
