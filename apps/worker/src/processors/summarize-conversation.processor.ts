import type { Job } from 'bullmq';
import OpenAI from 'openai';
import { PrismaClient } from '@leadflow/database';

const prisma = new PrismaClient();

type SummarizeJob = { conversationId: string; companyId: string };

export async function processSummarizeConversation(job: Job<SummarizeJob>) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return;

  const messages = await prisma.message.findMany({
    where: { conversationId: job.data.conversationId },
    orderBy: { createdAt: 'asc' },
    take: 40,
  });
  if (!messages.length) return;

  const transcript = messages
    .map((m) => `${m.direction === 'INBOUND' ? 'Cliente' : 'Atendente'}: ${m.body ?? ''}`)
    .join('\n');

  const client = new OpenAI({ apiKey: key });
  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_DEFAULT_MODEL ?? 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'Resuma a conversa em até 5 frases, em português, focando intenção e próximos passos.',
      },
      { role: 'user', content: transcript.slice(0, 12000) },
    ],
    max_tokens: 300,
  });

  const summary = completion.choices[0]?.message?.content?.trim();
  if (!summary) return;

  await prisma.aiConversationSummary.create({
    data: {
      companyId: job.data.companyId,
      conversationId: job.data.conversationId,
      summary,
      lastMessageId: messages[messages.length - 1]?.id,
    },
  });
}
