import { hashPassword, comparePassword } from '../security/crypto.js';

export interface PasswordStrengthResult {
  valid: boolean;
  errors: string[];
  score: number;
}

export interface PasswordStrengthOptions {
  minLength?: number;
  requireUppercase?: boolean;
  requireLowercase?: boolean;
  requireDigit?: boolean;
  requireSpecial?: boolean;
}

const DEFAULT_OPTIONS: Required<PasswordStrengthOptions> = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireDigit: true,
  requireSpecial: false,
};

const SPECIAL_CHARS = /[!@#$%^&*()_\-+=[\]{}|;:'",.<>/?\\~`]/;

export function validatePasswordStrength(
  password: string,
  options: PasswordStrengthOptions = {},
): PasswordStrengthResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const errors: string[] = [];
  let score = 0;

  if (password.length < opts.minLength) {
    errors.push(`Must be at least ${opts.minLength} characters`);
  } else {
    score += Math.min(Math.floor(password.length / 4), 4);
  }

  if (opts.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Must contain an uppercase letter');
  } else if (/[A-Z]/.test(password)) {
    score++;
  }

  if (opts.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Must contain a lowercase letter');
  } else if (/[a-z]/.test(password)) {
    score++;
  }

  if (opts.requireDigit && !/\d/.test(password)) {
    errors.push('Must contain a digit');
  } else if (/\d/.test(password)) {
    score++;
  }

  if (opts.requireSpecial && !SPECIAL_CHARS.test(password)) {
    errors.push('Must contain a special character');
  } else if (SPECIAL_CHARS.test(password)) {
    score += 2;
  }

  return { valid: errors.length === 0, errors, score: Math.min(score, 10) };
}

export async function hash(password: string): Promise<string> {
  return hashPassword(password);
}

export async function compare(password: string, hash: string): Promise<boolean> {
  return comparePassword(password, hash);
}

export function assertValid(password: string, options?: PasswordStrengthOptions): void {
  const result = validatePasswordStrength(password, options);
  if (!result.valid) {
    throw new Error(`Weak password: ${result.errors.join('; ')}`);
  }
}
