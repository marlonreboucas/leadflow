import { QUEUES } from '@leadflow/shared';
import type { Job } from 'bullmq';
import { processIncomingMessage } from './incoming-message.processor';
import { processSendWhatsapp } from './send-whatsapp.processor';
import { processRunAiAgent } from './run-ai-agent.processor';
import { processSummarizeConversation } from './summarize-conversation.processor';
import { processIndexKnowledge } from './index-knowledge.processor';
import { processClassifyLead } from './classify-lead.processor';
import { processExecuteAutomation } from './execute-automation.processor';
import { processSendToN8n } from './send-to-n8n.processor';
import { processIdleLeadScanner } from './idle-lead-scanner.processor';
import { processTaskOverdueScanner } from './task-overdue-scanner.processor';
import { processCalculateUsage } from './calculate-usage.processor';
import { processSyncWhatsappStatus } from './sync-whatsapp-status.processor';
import { processProcessMedia } from './process-media.processor';
import { processAppointmentReminderScanner } from './appointment-reminder-scanner.processor';
import { processSyncGoogleCalendar } from './sync-google-calendar.processor';
import { processGenerateReports } from './generate-reports.processor';

export const processors = {
  [QUEUES.INCOMING_MESSAGE]: processIncomingMessage,
  [QUEUES.SEND_WHATSAPP]: processSendWhatsapp,
  [QUEUES.RUN_AI_AGENT]: processRunAiAgent,
  [QUEUES.CLASSIFY_LEAD]: processClassifyLead,
  [QUEUES.SUMMARIZE_CONVERSATION]: processSummarizeConversation,
  [QUEUES.INDEX_KNOWLEDGE]: processIndexKnowledge,
  [QUEUES.EXECUTE_AUTOMATION]: processExecuteAutomation,
  [QUEUES.SEND_TO_N8N]: processSendToN8n,
  [QUEUES.SYNC_WHATSAPP_STATUS]: processSyncWhatsappStatus,
  [QUEUES.PROCESS_MEDIA]: processProcessMedia,
  [QUEUES.CALCULATE_USAGE]: processCalculateUsage,
  [QUEUES.GENERATE_REPORTS]: processGenerateReports,
  [QUEUES.IDLE_LEAD_SCANNER]: processIdleLeadScanner,
  [QUEUES.TASK_OVERDUE_SCANNER]: processTaskOverdueScanner,
  [QUEUES.APPOINTMENT_REMINDER_SCANNER]: processAppointmentReminderScanner,
  [QUEUES.SYNC_GOOGLE_CALENDAR]: processSyncGoogleCalendar,
};
