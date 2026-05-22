import type { AutomationConditionInput, AutomationContext } from './types';

function getField(ctx: AutomationContext, path: string): unknown {
  const parts = path.split('.');
  let cur: unknown = ctx;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function normalizeValue(v: unknown): string | number | boolean | null {
  if (v == null) return null;
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  return String(v);
}

const REGEX_TIMEOUT_MS = 50;

function safeRegexMatch(pattern: string, text: string): boolean {
  try {
    const re = new RegExp(pattern, 'i');
    const start = Date.now();
    const ok = re.test(text);
    if (Date.now() - start > REGEX_TIMEOUT_MS) return false;
    return ok;
  } catch {
    return false;
  }
}

export function evaluateCondition(cond: AutomationConditionInput, ctx: AutomationContext): boolean {
  const left = getField(ctx, cond.field);
  const right = cond.value;

  switch (cond.operator) {
    case 'eq':
      return normalizeValue(left) === normalizeValue(right);
    case 'neq':
      return normalizeValue(left) !== normalizeValue(right);
    case 'gt':
      return Number(left) > Number(right);
    case 'lt':
      return Number(left) < Number(right);
    case 'gte':
      return Number(left) >= Number(right);
    case 'lte':
      return Number(left) <= Number(right);
    case 'in': {
      const arr = Array.isArray(right) ? right : [right];
      return arr.map(normalizeValue).includes(normalizeValue(left));
    }
    case 'notIn': {
      const arr = Array.isArray(right) ? right : [right];
      return !arr.map(normalizeValue).includes(normalizeValue(left));
    }
    case 'contains': {
      const hay = String(left ?? '').toLowerCase();
      const needle = String(
        Array.isArray(right) ? (right[0] ?? '') : (right ?? ''),
      ).toLowerCase();
      return hay.includes(needle);
    }
    case 'regex': {
      const hay = String(left ?? '');
      const pattern = String(Array.isArray(right) ? (right[0] ?? '') : (right ?? ''));
      return safeRegexMatch(pattern, hay);
    }
    default:
      return false;
  }
}

/** Todas as condições devem passar (AND). Lista vazia = sempre verdadeiro. */
export function evaluateConditions(
  conditions: AutomationConditionInput[],
  ctx: AutomationContext,
): boolean {
  if (!conditions.length) return true;
  return conditions.every((c) => evaluateCondition(c, ctx));
}
