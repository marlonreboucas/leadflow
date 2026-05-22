import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import type { Prisma, PrismaClient } from '@leadflow/database';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CreateContactInput,
  UpdateContactInput,
  ListContactsQuery,
} from '@leadflow/shared';

type PrismaLike = PrismaClient | Prisma.TransactionClient;

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreateByPhone(
    companyId: string,
    phone: string,
    name?: string,
    client: PrismaLike = this.prisma,
  ) {
    return client.contact.upsert({
      where: { companyId_phone: { companyId, phone } },
      create: { companyId, phone, name },
      update: name ? { name } : {},
    });
  }

  async list(companyId: string, query: ListContactsQuery) {
    const where: Prisma.ContactWhereInput = { companyId };
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { phone: { contains: query.q } },
        { email: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: query.take,
        skip: query.skip,
      }),
      this.prisma.contact.count({ where }),
    ]);
    return { items, total };
  }

  async get(companyId: string, id: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id, companyId },
    });
    if (!contact) throw new NotFoundException('Contato não encontrado');
    return contact;
  }

  async create(companyId: string, data: CreateContactInput) {
    const existing = await this.prisma.contact.findUnique({
      where: { companyId_phone: { companyId, phone: data.phone } },
    });
    if (existing) {
      throw new ConflictException('Já existe um contato com este telefone');
    }
    return this.prisma.contact.create({
      data: { companyId, ...data },
    });
  }

  async update(companyId: string, id: string, data: UpdateContactInput) {
    await this.get(companyId, id);
    return this.prisma.contact.update({
      where: { id },
      data,
    });
  }
}
