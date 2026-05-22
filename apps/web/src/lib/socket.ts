'use client';

import { io, type Socket } from 'socket.io-client';
import { loadTokens } from './api';

let socket: Socket | null = null;

export function getSocket() {
  if (typeof window === 'undefined') return null;
  if (socket?.connected) return socket;

  loadTokens();
  const raw = localStorage.getItem('leadflow.tokens');
  if (!raw) return null;

  let token: string | undefined;
  try {
    token = JSON.parse(raw).accessToken;
  } catch {
    return null;
  }

  const url = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001';
  socket = io(url, {
    auth: { token },
    transports: ['websocket', 'polling'],
  });

  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
