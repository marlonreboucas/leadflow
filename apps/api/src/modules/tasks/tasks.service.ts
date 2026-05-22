import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import type { Prisma } from '@leadflow/database';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CreateTaskInput,
  UpdateTaskInput,
  ListTasksQuery,
} from '@leadflow/shared';

const taskInclude = {
  assignee: { select: { id: true, name: true, avatarUrl: true } },
  deal: { select: { id: true, title: true } },
  createdByAgent: { select: { id: true, name: true, avatarUrl: true } },
} satisfies Prisma.TaskInclude;

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string, query: ListTasksQuery) {
    const where: Prisma.TaskWhereInput = { companyId };
    if (query.status) where.status = query.status;
    if (query.assigneeUserId) where.assigneeUserId = query.assigneeUserId;
    if (query.dealId) where.dealId = query.dealId;
    if (query.overdue) {
      where.status = { in: ['PENDING', 'DOING'] };
      where.dueAt = { lt: new Date() };
    }
    const [items, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        include: taskInclude,
        orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
        take: query.take,
        skip: query.skip,
      }),
      this.prisma.task.count({ where }),
    ]);
    return { items, total };
  }

  async get(companyId: string, id: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, companyId },
      include: taskInclude,
    });
    if (!task) throw new NotFoundException('Tarefa não encontrada');
    return task;
  }

  async create(companyId: string, data: CreateTaskInput) {
    if (data.dealId) {
      const deal = await this.prisma.deal.findFirst({
        where: { id: data.dealId, companyId },
      });
      if (!deal) throw new BadRequestException('Lead não encontrado');
    }
    if (data.assigneeUserId) {
      const member = await this.prisma.companyUser.findUnique({
        where: {
          companyId_userId: { companyId, userId: data.assigneeUserId },
        },
      });
      if (!member) throw new BadRequestException('Usuário não pertence à empresa');
    }
    return this.prisma.task.create({
      data: { companyId, ...data },
      include: taskInclude,
    });
  }

  async update(companyId: string, id: string, data: UpdateTaskInput) {
    await this.get(companyId, id);
    if (data.assigneeUserId) {
      const member = await this.prisma.companyUser.findUnique({
        where: {
          companyId_userId: { companyId, userId: data.assigneeUserId },
        },
      });
      if (!member) throw new BadRequestException('Usuário não pertence à empresa');
    }
    return this.prisma.task.update({
      where: { id },
      data,
      include: taskInclude,
    });
  }

  async remove(companyId: string, id: string) {
    await this.get(companyId, id);
    await this.prisma.task.delete({ where: { id } });
    return { ok: true };
  }
}
