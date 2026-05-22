import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateMessageTemplateInput, UpdateMessageTemplateInput } from '@leadflow/shared';

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  list(companyId: string) {
    return this.prisma.messageTemplate.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(companyId: string, id: string) {
    const row = await this.prisma.messageTemplate.findFirst({
      where: { id, companyId },
    });
    if (!row) throw new NotFoundException('Template não encontrado');
    return row;
  }

  create(companyId: string, input: CreateMessageTemplateInput) {
    return this.prisma.messageTemplate.create({
      data: { companyId, ...input },
    });
  }

  async update(companyId: string, id: string, input: UpdateMessageTemplateInput) {
    await this.get(companyId, id);
    return this.prisma.messageTemplate.update({ where: { id }, data: input });
  }

  async remove(companyId: string, id: string) {
    await this.get(companyId, id);
    await this.prisma.messageTemplate.delete({ where: { id } });
    return { ok: true };
  }
}
