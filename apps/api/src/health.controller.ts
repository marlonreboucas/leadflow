import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';
import { PrismaService } from './prisma/prisma.service';
import { env } from './config/env';
import Redis from 'ioredis';
import axios from 'axios';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  check() {
    return { status: 'ok', uptime: process.uptime() };
  }

  @Public()
  @Get('ready')
  async ready() {
    const checks: Record<string, string> = {};

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.postgres = 'ok';
    } catch {
      checks.postgres = 'fail';
    }

    const redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
    });
    try {
      await redis.ping();
      checks.redis = 'ok';
    } catch {
      checks.redis = 'fail';
    } finally {
      redis.disconnect();
    }

    try {
      await axios.get(`${env.EVOLUTION_API_URL.replace(/\/$/, '')}/`, {
        timeout: 3000,
        validateStatus: () => true,
      });
      checks.evolution = 'ok';
    } catch {
      checks.evolution = 'degraded';
    }

    const ok = checks.postgres === 'ok' && checks.redis === 'ok';
    return { status: ok ? 'ready' : 'degraded', checks };
  }
}
