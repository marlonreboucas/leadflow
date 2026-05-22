/** Extrai imagem QR (data URL) das respostas da Evolution API v2. */
export function extractQrBase64(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;

  const candidates: unknown[] = [
    o.base64,
    o.qrcode,
    (o.qrcode as Record<string, unknown>)?.base64,
    (o.instance as Record<string, unknown>)?.qrcode,
    ((o.instance as Record<string, unknown>)?.qrcode as Record<string, unknown>)?.base64,
  ];

  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 50) {
      return c.startsWith('data:') ? c : `data:image/png;base64,${c}`;
    }
    if (c && typeof c === 'object') {
      const nested = extractQrBase64(c);
      if (nested) return nested;
    }
  }

  return null;
}

export function extractPairingCode(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const code = (raw as { pairingCode?: string }).pairingCode;
  return code && String(code).length > 0 ? String(code) : null;
}

export async function pollConnectQr(
  fetchConnect: () => Promise<unknown>,
  opts: { attempts?: number; delayMs?: number } = {},
): Promise<{ qrCode: string | null; pairingCode: string | null; raw: unknown }> {
  const attempts = opts.attempts ?? 12;
  const delayMs = opts.delayMs ?? 2000;
  let last: unknown = null;

  for (let i = 0; i < attempts; i++) {
    last = await fetchConnect();
    const qrCode = extractQrBase64(last);
    const pairingCode = extractPairingCode(last);
    if (qrCode || pairingCode) return { qrCode, pairingCode, raw: last };
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return { qrCode: extractQrBase64(last), pairingCode: extractPairingCode(last), raw: last };
}
