import { Emitter } from '@socket.io/redis-emitter';
import Redis from 'ioredis';
import { SOCKET_EVENTS, roomKey } from '@leadflow/shared';

let emitter: Emitter | null = null;

function getEmitter() {
  if (!emitter) {
    const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
    });
    emitter = new Emitter(redis);
  }
  return emitter;
}

export function emitToCompany(companyId: string, event: string, payload: unknown) {
  getEmitter().to(roomKey.company(companyId)).emit(event, payload);
}

export function emitToConversation(conversationId: string, event: string, payload: unknown) {
  getEmitter().to(roomKey.conversation(conversationId)).emit(event, payload);
}
