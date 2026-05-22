import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import { ZodValidationPipe } from 'nestjs-zod';
import { RedisIoAdapter } from './redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const redisIo = new RedisIoAdapter(app);
  await redisIo.connectToRedis(redisUrl);
  app.useWebSocketAdapter(redisIo);
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api', { exclude: ['health', 'webhooks/(.*)'] });
  app.enableCors({
    origin: process.env.APP_URL?.split(',') ?? true,
    credentials: true,
  });
  app.useGlobalPipes(new ZodValidationPipe());

  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port);
  console.log(`API listening on :${port}`);
}
bootstrap();
