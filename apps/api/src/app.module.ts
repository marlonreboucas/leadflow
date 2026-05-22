import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { env } from './config/env';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { PipelinesModule } from './modules/pipelines/pipelines.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { DealsModule } from './modules/deals/deals.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { EvolutionModule } from './integrations/evolution/evolution.module';
import { QueuesModule } from './queues/queues.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { MessagesModule } from './modules/messages/messages.module';
import { OpenaiModule } from './integrations/openai/openai.module';
import { AiAgentsModule } from './modules/ai-agents/ai-agents.module';
import { AiRuntimeModule } from './modules/ai-runtime/ai-runtime.module';
import { KnowledgeBaseModule } from './modules/knowledge-base/knowledge-base.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { LogsModule } from './modules/logs/logs.module';
import { BillingModule } from './modules/billing/billing.module';
import { AutomationsModule } from './modules/automations/automations.module';
import { ReportsModule } from './modules/reports/reports.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { GoogleCalendarModule } from './integrations/google-calendar/google-calendar.module';
import { N8nModule } from './integrations/n8n/n8n.module';
import { HealthController } from './health.controller';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionGuard } from './common/guards/permission.guard';
import { TenantInterceptor } from './common/interceptors/tenant.interceptor';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { CompanyThrottlerGuard } from './common/guards/company-throttler.guard';
import { RedisThrottlerStorage } from './common/storage/redis-throttler.storage';
import { ThrottlerStorageModule } from './common/storage/throttler-storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: () => env }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV === 'development'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        redact: ['req.headers.authorization', 'req.headers.cookie'],
      },
    }),
    ThrottlerModule.forRootAsync({
      imports: [ThrottlerStorageModule],
      useFactory: (storage: RedisThrottlerStorage) => ({
        throttlers: [
          {
            ttl: Number(process.env.THROTTLE_TTL_MS ?? 60_000),
            limit: Number(process.env.THROTTLE_LIMIT ?? 200),
          },
        ],
        storage,
      }),
      inject: [RedisThrottlerStorage],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    CompaniesModule,
    RbacModule,
    PipelinesModule,
    ContactsModule,
    DealsModule,
    TasksModule,
    EvolutionModule,
    QueuesModule,
    RealtimeModule,
    WhatsappModule,
    ConversationsModule,
    MessagesModule,
    OpenaiModule,
    AiRuntimeModule,
    AiAgentsModule,
    KnowledgeBaseModule,
    DashboardModule,
    TemplatesModule,
    LogsModule,
    BillingModule,
    AutomationsModule,
    ReportsModule,
    CalendarModule,
    GoogleCalendarModule,
    N8nModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: CompanyThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    { provide: APP_INTERCEPTOR, useClass: TenantInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
