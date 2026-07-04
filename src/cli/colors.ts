export const RESET = '\x1b[0m';
export const BOLD = '\x1b[1m';
export const DIM = '\x1b[2m';
export const UNDERLINE = '\x1b[4m';

const COLORS = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
} as const;

export function red(s: string): string { return COLORS.red + s + RESET; }
export function green(s: string): string { return COLORS.green + s + RESET; }
export function yellow(s: string): string { return COLORS.yellow + s + RESET; }
export function blue(s: string): string { return COLORS.blue + s + RESET; }
export function magenta(s: string): string { return COLORS.magenta + s + RESET; }
export function cyan(s: string): string { return COLORS.cyan + s + RESET; }
export function white(s: string): string { return COLORS.white + s + RESET; }
export function gray(s: string): string { return COLORS.gray + s + RESET; }
export function bold(s: string): string { return BOLD + s + RESET; }
export function dim(s: string): string { return DIM + s + RESET; }
export function underline(s: string): string { return UNDERLINE + s + RESET; }
