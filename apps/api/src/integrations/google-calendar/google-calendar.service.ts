import { BadRequestException, Injectable } from '@nestjs/common';
import { syncTaskToGoogleCalendar } from '@leadflow/google-calendar';
import { PrismaService } from '../../prisma/prisma.service';

type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
};

@Injectable()
export class GoogleCalendarService {
  constructor(private readonly prisma: PrismaService) {}

  isConfigured() {
    return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  }

  getAuthUrl(companyId: string) {
    if (!this.isConfigured()) {
      throw new BadRequestException('Defina GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no .env');
    }
    const redirect = this.redirectUri();
    const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar.events');
    const state = encodeURIComponent(companyId);
    return (
      `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(redirect)}` +
      `&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${state}`
    );
  }

  async handleCallback(companyId: string, code: string) {
    const tokens = await this.exchangeCode(code);
    await this.prisma.calendarIntegration.upsert({
      where: { companyId },
      create: {
        companyId,
        provider: 'GOOGLE',
        refreshToken: tokens.refresh_token,
        accessToken: tokens.access_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        isActive: true,
      },
      update: {
        refreshToken: tokens.refresh_token ?? undefined,
        accessToken: tokens.access_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        isActive: true,
      },
    });
    return { connected: true };
  }

  async status(companyId: string) {
    const row = await this.prisma.calendarIntegration.findUnique({ where: { companyId } });
    return {
      configured: this.isConfigured(),
      connected: Boolean(row?.isActive && row.refreshToken),
      calendarId: row?.calendarId ?? 'primary',
    };
  }

  async disconnect(companyId: string) {
    await this.prisma.calendarIntegration.deleteMany({ where: { companyId } });
    return { connected: false };
  }

  async syncAppointmentToGoogle(companyId: string, taskId: string) {
    return syncTaskToGoogleCalendar(this.prisma, companyId, taskId);
  }

  private redirectUri() {
    const api = (process.env.API_URL ?? 'http://localhost:3001').replace(/\/$/, '');
    return `${api}/api/integrations/google-calendar/callback`;
  }

  private async exchangeCode(code: string): Promise<GoogleTokenResponse> {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: this.redirectUri(),
        grant_type: 'authorization_code',
      }),
    });
    if (!res.ok) {
      throw new BadRequestException('Falha ao trocar código Google OAuth');
    }
    return res.json() as Promise<GoogleTokenResponse>;
  }

}
