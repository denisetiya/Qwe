import type { ExecutionContext } from 'qwe';

export const authGuard = (ctx: ExecutionContext): boolean => {
  const auth = ctx.request.headers['authorization'];
  if (!auth) return false;
  return auth.startsWith('Bearer ');
};
