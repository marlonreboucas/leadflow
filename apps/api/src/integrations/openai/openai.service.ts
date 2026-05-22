import { Injectable, BadRequestException } from '@nestjs/common';
import OpenAI from 'openai';
import { env } from '../../config/env';

@Injectable()
export class OpenaiService {
  private client: OpenAI | null = null;

  getClient(): OpenAI {
    if (!env.OPENAI_API_KEY) {
      throw new BadRequestException(
        'OPENAI_API_KEY não configurada. Adicione no .env (nunca commite a chave).',
      );
    }
    if (!this.client) {
      this.client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    }
    return this.client;
  }

  async embed(text: string): Promise<number[]> {
    const client = this.getClient();
    const res = await client.embeddings.create({
      model: env.OPENAI_EMBEDDING_MODEL,
      input: text.slice(0, 8000),
    });
    return res.data[0]?.embedding ?? [];
  }
}
