import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GoogleCalendarService } from '../../integrations/google-calendar/google-calendar.service';

@Injectable()
export class CalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly google: GoogleCalendarService,
  ) {}

  async list(companyId: string, from?: string, to?: string) {
    const start = from ? new Date(from) : new Date();
    const end = to
      ? new Date(to)
      : new Date(start.getTime() + 30 * 24 * 3600000);

    return this.prisma.task.findMany({
      where: {
        companyId,
        kind: 'APPOINTMENT',
        dueAt: { gte: start, lte: end },
        status: { not: 'CANCELED' },
      },
      orderBy: { dueAt: 'asc' },
      include: {
        deal: { select: { id: true, title: true, contact: { select: { name: true, phone: true } } } },
        conversation: {
          select: { id: true, contact: { select: { name: true, phone: true } } },
        },
        createdByAgent: { select: { id: true, name: true } },
      },
    });
  }

  async create(
    companyId: string,
    input: {
      title: string;
      dueAt: string;
      durationMinutes?: number;
      description?: string;
      dealId?: string;
      conversationId?: string;
    },
  ) {
    const dueAt = new Date(input.dueAt);
    if (Number.isNaN(dueAt.getTime())) throw new BadRequestException('Data inválida');

    const task = await this.prisma.task.create({
      data: {
        companyId,
        title: input.title,
        description: input.description,
        dueAt,
        durationMinutes: input.durationMinutes ?? 60,
        dealId: input.dealId,
        conversationId: input.conversationId,
        kind: 'APPOINTMENT',
        status: 'PENDING',
      },
    });
    void this.google.syncAppointmentToGoogle(companyId, task.id);
    return task;
  }

  async cancel(companyId: string, id: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, companyId, kind: 'APPOINTMENT' },
    });
    if (!task) throw new NotFoundException('Compromisso não encontrado');
    return this.prisma.task.update({
      where: { id },
      data: { status: 'CANCELED' },
    });
  }
}
