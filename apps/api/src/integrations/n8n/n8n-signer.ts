import crypto from 'crypto';

export function signN8nPayload(body: string, secret: string) {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

export function verifyN8nSignature(body: string, secret: string, signature: string) {
  const expected = signN8nPayload(body, secret);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
