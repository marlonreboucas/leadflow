import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { RequestMethod } from '@nestjs/common';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import { ZodValidationPipe } from 'nestjs-zod';
import { RedisIoAdapter } from './redis-io.adapter';

async function bootstrap() {
  // rawBody: true mantém o corpo bruto em req.rawBody (Buffer) além do JSON
  // parseado — necessário para validar a assinatura do webhook do Stripe.
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });
  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const redisIo = new RedisIoAdapter(app);
  await redisIo.connectToRedis(redisUrl);
  app.useWebSocketAdapter(redisIo);
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'health', method: RequestMethod.ALL },
      { path: 'health/(.*)', method: RequestMethod.ALL },
      { path: 'webhooks/(.*)', method: RequestMethod.ALL },
    ],
  });
  const corsOrigins = [
    process.env.APP_URL,
    process.env.API_URL,
    'http://localhost:3000',
    ...(process.env.CORS_ORIGINS?.split(',').map((o) => o.trim()) ?? []),
  ].filter((o): o is string => Boolean(o));

  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  app.useGlobalPipes(new ZodValidationPipe());

  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port);
  console.log(`API listening on :${port}`);
}
bootstrap();
