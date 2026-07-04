import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export function loadEnv(file = '.env', dir = process.cwd()): Record<string, string> {
  const filePath = join(dir, file);
  if (!existsSync(filePath)) return {};

  const content = readFileSync(filePath, 'utf-8');
  const env: Record<string, string> = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) process.env[key] = value;
    env[key] = process.env[key] ?? value;
  }

  return env;
}
