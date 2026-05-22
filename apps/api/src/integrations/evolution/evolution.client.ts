import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance, isAxiosError } from 'axios';
import { env } from '../../config/env';
import { extractQrBase64, pollConnectQr } from './evolution.qr';

@Injectable()
export class EvolutionClient {
  private readonly http: AxiosInstance;
  private readonly logger = new Logger(EvolutionClient.name);

  constructor() {
    this.http = axios.create({
      baseURL: env.EVOLUTION_API_URL.replace(/\/$/, ''),
      headers: { apikey: env.EVOLUTION_API_KEY },
      timeout: 30_000,
    });
  }

  async createInstance(instanceName: string, webhookUrl: string) {
    const { data } = await this.http.post('/instance/create', {
      instanceName,
      token: instanceName,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
      webhook: {
        url: webhookUrl,
        byEvents: false,
        base64: true,
        events: [
          'QRCODE_UPDATED',
          'CONNECTION_UPDATE',
          'MESSAGES_UPSERT',
          'MESSAGES_UPDATE',
        ],
      },
    });
    const immediate = extractQrBase64(data);
    if (immediate) return { ...data, base64: immediate };
    const polled = await pollConnectQr(() => this.fetchQr(instanceName));
    return { ...data, base64: polled.qrCode, pairingCode: polled.pairingCode };
  }

  async fetchInstance(instanceName: string) {
    const { data } = await this.http.get(`/instance/fetchInstances`, {
      params: { instanceName },
    });
    return data;
  }

  /** Linha da instância na Evolution (connectionStatus: open | close | connecting). */
  async fetchInstanceRow(instanceName: string) {
    const data = await this.fetchInstance(instanceName);
    const list = Array.isArray(data)
      ? data
      : ((data as { value?: unknown[] })?.value ?? [data]);
    return (
      list.find((row) => {
        const r = row as Record<string, unknown>;
        return r.name === instanceName || r.instanceName === instanceName;
      }) ?? null
    );
  }

  async deleteInstance(instanceName: string) {
    const { data } = await this.http.delete(`/instance/delete/${instanceName}`);
    return data;
  }

  async connectInstance(instanceName: string) {
    return this.fetchQr(instanceName);
  }

  async fetchQr(instanceName: string) {
    const { data } = await this.http.get(`/instance/connect/${instanceName}`);
    const qr = extractQrBase64(data);
    if (qr) return { ...data, base64: qr };
    return pollConnectQr(() =>
      this.http.get(`/instance/connect/${instanceName}`).then((r) => r.data),
    );
  }

  async connectionState(instanceName: string) {
    const { data } = await this.http.get(`/instance/connectionState/${instanceName}`);
    return data as { instance?: { state?: string } };
  }

  async setWebhook(instanceName: string, webhookUrl: string) {
    const { data } = await this.http.post(`/webhook/set/${instanceName}`, {
      webhook: {
        enabled: true,
        url: webhookUrl,
        webhookByEvents: false,
        webhookBase64: true,
        events: [
          'MESSAGES_UPSERT',
          'MESSAGES_UPDATE',
          'CONNECTION_UPDATE',
          'QRCODE_UPDATED',
        ],
      },
    });
    return data;
  }

  async findWebhook(instanceName: string) {
    const { data } = await this.http.get(`/webhook/find/${instanceName}`);
    return data as { url?: string; enabled?: boolean; webhookByEvents?: boolean };
  }

  managerUrl() {
    return `${env.EVOLUTION_API_URL.replace(/\/$/, '')}/manager`;
  }

  async sendText(instanceName: string, to: string, text: string) {
    const number = to.replace(/\D/g, '');
    const { data } = await this.http.post(`/message/sendText/${instanceName}`, {
      number,
      text,
    });
    return data;
  }

  async sendMedia(
    instanceName: string,
    to: string,
    mediaUrl: string,
    mediatype: 'image' | 'video' | 'document' = 'image',
    caption?: string,
  ) {
    const number = to.replace(/\D/g, '');
    const { data } = await this.http.post(`/message/sendMedia/${instanceName}`, {
      number,
      mediatype,
      media: mediaUrl,
      caption,
    });
    return data;
  }

  logError(context: string, err: unknown) {
    if (isAxiosError(err)) {
      this.logger.warn(
        `${context}: ${err.response?.status} ${JSON.stringify(err.response?.data ?? err.message)}`,
      );
      return;
    }
    const msg = err instanceof Error ? err.message : String(err);
    this.logger.warn(`${context}: ${msg}`);
  }
}
