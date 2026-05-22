import type { PrismaClient } from '@leadflow/database';

type Integration = {
  id: string;
  calendarId: string;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
};

export async function syncTaskToGoogleCalendar(
  prisma: PrismaClient,
  companyId: string,
  taskId: string,
): Promise<string | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const integration = await prisma.calendarIntegration.findUnique({ where: { companyId } });
  if (!integration?.isActive || !integration.refreshToken) return null;

  const task = await prisma.task.findFirst({
    where: { id: taskId, companyId, kind: 'APPOINTMENT' },
  });
  if (!task?.dueAt || task.googleEventId) return task?.googleEventId ?? null;

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  const tz = company?.timezone ?? 'America/Sao_Paulo';
  const accessToken = await refreshAccessToken(prisma, integration, clientId, clientSecret);
  const end = new Date(task.dueAt.getTime() + (task.durationMinutes ?? 60) * 60000);

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(integration.calendarId)}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: task.title,
        description: task.description ?? undefined,
        start: { dateTime: task.dueAt.toISOString(), timeZone: tz },
        end: { dateTime: end.toISOString(), timeZone: tz },
      }),
    },
  );

  if (!res.ok) return null;
  const data = (await res.json()) as { id?: string };
  if (data.id) {
    await prisma.task.update({ where: { id: taskId }, data: { googleEventId: data.id } });
  }
  return data.id ?? null;
}

async function refreshAccessToken(
  prisma: PrismaClient,
  integration: Integration,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  if (
    integration.accessToken &&
    integration.tokenExpiresAt &&
    integration.tokenExpiresAt.getTime() > Date.now() + 60_000
  ) {
    return integration.accessToken;
  }
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: integration.refreshToken!,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error('Google token refresh failed');
  const data = (await res.json()) as { access_token: string; expires_in: number };
  await prisma.calendarIntegration.update({
    where: { id: integration.id },
    data: {
      accessToken: data.access_token,
      tokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
    },
  });
  return data.access_token;
}
