import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LogsService {
  constructor(private readonly prisma: PrismaService) {}

  listAuditLogs(companyId: string, take = 50) {
    return this.prisma.auditLog.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        userId: true,
        createdAt: true,
      },
    });
  }

  listWebhookLogs(companyId: string, take = 50) {
    return this.prisma.webhookLog.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        direction: true,
        source: true,
        endpoint: true,
        status: true,
        createdAt: true,
        payload: true,
      },
    });
  }
}
