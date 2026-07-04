export function buildCacheKey(prefix: string, methodName: string, args: unknown[]): string {
  return `${prefix}:${methodName}:${serializeArgs(args)}`;
}

function serializeArgs(args: unknown[]): string {
  if (args.length === 0) return '';
  const parts = new Array<string>(args.length);
  for (let i = 0; i < args.length; i++) {
    parts[i] = hashValue(args[i]);
  }
  return parts.join(':');
}

function hashValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undef';

  const type = typeof value;
  if (type === 'string') return `s${fnv1a(value as string)}`;
  if (type === 'number') return `n${value as number}`;
  if (type === 'boolean') return `b${(value as boolean) ? '1' : '0'}`;

  if (Array.isArray(value)) {
    const parts = new Array<string>(value.length);
    for (let i = 0; i < value.length; i++) {
      parts[i] = hashValue(value[i]);
    }
    return `[${parts.join(',')}]`;
  }

  if (type === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const parts = new Array<string>(keys.length);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]!;
      parts[i] = `${key}=${hashValue(obj[key])}`;
    }
    return `{${parts.join(',')}}`;
  }

  return `x${fnv1a(String(value))}`;
}

function fnv1a(str: string): string {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash.toString(36);
}
