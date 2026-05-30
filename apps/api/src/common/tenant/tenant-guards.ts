import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';

/**
 * Helpers centrais de isolamento multi-tenant.
 *
 * Usados para validar que toda FK recebida como entrada (dealId, contactId,
 * conversationId, ownerUserId, ...) pertence à mesma empresa do usuário
 * autenticado — evitando IDOR de associação (ex.: vincular um deal da empresa
 * A a um contato da empresa B).
 *
 * Regras de leitura/escrita por `id` de rota continuam usando
 * `findFirst({ where: { id, companyId } })` em cada service; estes helpers
 * cobrem as FKs que chegam pelo corpo da requisição.
 */

export async function assertDealInCompany(
  prisma: PrismaService,
  companyId: string,
  dealId: string,
): Promise<void> {
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, companyId },
    select: { id: true },
  });
  if (!deal) throw new BadRequestException('Lead não encontrado nesta empresa');
}

export async function assertContactInCompany(
  prisma: PrismaService,
  companyId: string,
  contactId: string,
): Promise<void> {
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, companyId },
    select: { id: true },
  });
  if (!contact) throw new BadRequestException('Contato não encontrado nesta empresa');
}

export async function assertConversationInCompany(
  prisma: PrismaService,
  companyId: string,
  conversationId: string,
): Promise<void> {
  const conv = await prisma.conversation.findFirst({
    where: { id: conversationId, companyId },
    select: { id: true },
  });
  if (!conv) throw new BadRequestException('Conversa não encontrada nesta empresa');
}

export async function assertUserInCompany(
  prisma: PrismaService,
  companyId: string,
  userId: string,
): Promise<void> {
  const member = await prisma.companyUser.findUnique({
    where: { companyId_userId: { companyId, userId } },
    select: { userId: true },
  });
  if (!member) throw new BadRequestException('Usuário não pertence à empresa');
}
