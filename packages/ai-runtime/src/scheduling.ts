/** Interpreta datas em PT-BR para agendamentos via WhatsApp. */
export function parseAppointmentDueAt(
  input: string,
  refDate: Date = new Date(),
  timezone = 'America/Sao_Paulo',
): Date | null {
  const raw = input.trim();
  if (!raw) return null;

  const iso = Date.parse(raw);
  if (!Number.isNaN(iso) && /^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return new Date(iso);
  }

  const t = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const base = startOfDayInTz(refDate, timezone);

  let dayOffset = 0;
  if (/\bamanha\b/.test(t)) dayOffset = 1;
  else if (/\bhoje\b/.test(t)) dayOffset = 0;
  else {
    const weekdays: Record<string, number> = {
      domingo: 0,
      segunda: 1,
      terca: 2,
      quarta: 3,
      quinta: 4,
      sexta: 5,
      sabado: 6,
    };
    for (const [name, target] of Object.entries(weekdays)) {
      if (t.includes(name)) {
        const current = base.getUTCDay();
        dayOffset = (target - current + 7) % 7;
        if (dayOffset === 0) dayOffset = 7;
        break;
      }
    }
  }

  const timeMatch =
    t.match(/(\d{1,2})[:h](\d{2})/) ?? t.match(/(\d{1,2})\s*h(?:oras?)?/);
  let hours = 10;
  let minutes = 0;
  if (timeMatch) {
    hours = Number(timeMatch[1]);
    minutes = timeMatch[2] != null ? Number(timeMatch[2]) : 0;
  }

  const result = new Date(base);
  result.setUTCDate(result.getUTCDate() + dayOffset);
  result.setUTCHours(hours + tzOffsetHours(timezone), minutes, 0, 0);
  return result;
}

function startOfDayInTz(date: Date, tz: string): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const y = parts.find((p) => p.type === 'year')?.value ?? '2026';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  return new Date(`${y}-${m}-${d}T12:00:00.000Z`);
}

function tzOffsetHours(tz: string): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    timeZoneName: 'shortOffset',
  }).formatToParts(new Date());
  const off = fmt.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT-3';
  const m = off.match(/GMT([+-])(\d+)/);
  if (!m) return -3;
  const sign = m[1] === '+' ? 1 : -1;
  return sign * Number(m[2]);
}

export function formatAppointmentPt(d: Date, tz = 'America/Sao_Paulo'): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: tz,
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}
