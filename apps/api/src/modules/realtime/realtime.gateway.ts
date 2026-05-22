import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Server, Socket } from 'socket.io';
import { SOCKET_EVENTS, roomKey } from '@leadflow/shared';
import { env } from '../../config/env';
import type { JwtPayload } from '../auth/jwt.strategy';

@WebSocketGateway({
  cors: { origin: env.APP_URL.split(',').map((s) => s.trim()), credentials: true },
})
export class RealtimeGateway implements OnGatewayConnection {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(private readonly jwt: JwtService) {}

  async handleConnection(socket: Socket) {
    try {
      const token =
        (socket.handshake.auth?.token as string) ||
        (socket.handshake.headers.authorization as string)?.replace(/^Bearer\s+/i, '');
      if (!token) return socket.disconnect();
      const payload = await this.jwt.verifyAsync<JwtPayload>(token, { secret: env.JWT_SECRET });
      socket.data.user = payload;
      await socket.join(roomKey.company(payload.companyId));
    } catch {
      socket.disconnect();
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.CONVERSATION_JOIN)
  handleJoin(socket: Socket, payload: { conversationId: string }) {
    if (!payload?.conversationId) return;
    socket.join(roomKey.conversation(payload.conversationId));
  }

  @SubscribeMessage(SOCKET_EVENTS.CONVERSATION_LEAVE)
  handleLeave(socket: Socket, payload: { conversationId: string }) {
    if (!payload?.conversationId) return;
    socket.leave(roomKey.conversation(payload.conversationId));
  }

  emitToCompany(companyId: string, event: string, data: unknown) {
    this.server?.to(roomKey.company(companyId)).emit(event, data);
  }

  emitToConversation(conversationId: string, event: string, data: unknown) {
    this.server?.to(roomKey.conversation(conversationId)).emit(event, data);
  }
}
