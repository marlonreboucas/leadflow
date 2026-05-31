import { Global, Module } from '@nestjs/common';
import { PrismaService, createTenantAwarePrisma } from './prisma.service';

@Global()
@Module({
  providers: [{ provide: PrismaService, useFactory: createTenantAwarePrisma }],
  exports: [PrismaService],
})
export class PrismaModule {}
