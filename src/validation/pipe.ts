import type { Schema } from './types.js';
import { v } from './index.js';
import type { ExecutionContext } from '../http/context.js';
import { HttpStatus } from '../http/status.js';

export interface ValidationPipeOptions {
  validateBody?: Schema<any>;
  validateQuery?: Schema<any>;
  validateParams?: Schema<any>;
  body?: Schema<any>;
  query?: Schema<any>;
  params?: Schema<any>;
  whitelist?: boolean;
  forbidNonWhitelisted?: boolean;
  transform?: boolean;
}

export async function validationPipe(options: ValidationPipeOptions) {
  return async (ctx: ExecutionContext, next: () => Promise<void>): Promise<void> => {
    const errors: Array<{ field: string; message: string }> = [];

    const bodySchema = options.validateBody || options.body;
    const querySchema = options.validateQuery || options.query;
    const paramsSchema = options.validateParams || options.params;

    if (bodySchema && ctx.request.body != null) {
      try {
        const validated = v.parse(bodySchema, ctx.request.body);
        if (options.transform) {
          ctx.request.body = validated;
        }
      } catch (error: any) {
        errors.push({ field: 'body', message: error.message });
      }
    }

    if (querySchema && ctx.request.query != null) {
      try {
        const validated = v.parse(querySchema, ctx.request.query);
        if (options.transform) {
          ctx.request.query = validated;
        }
      } catch (error: any) {
        errors.push({ field: 'query', message: error.message });
      }
    }

    if (paramsSchema && ctx.request.params != null) {
      try {
        const validated = v.parse(paramsSchema, ctx.request.params);
        if (options.transform) {
          ctx.request.params = validated;
        }
      } catch (error: any) {
        errors.push({ field: 'params', message: error.message });
      }
    }

    if (errors.length > 0) {
      ctx.response.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        error: 'Validation failed',
        details: errors,
      });
      return;
    }

    await next();
  };
}

export function body(schema: Schema<any>, options: Omit<ValidationPipeOptions, 'validateBody' | 'body'> = {}) {
  return validationPipe({ ...options, validateBody: schema });
}

export function query(schema: Schema<any>, options: Omit<ValidationPipeOptions, 'validateQuery' | 'query'> = {}) {
  return validationPipe({ ...options, validateQuery: schema });
}

export function params(schema: Schema<any>, options: Omit<ValidationPipeOptions, 'validateParams' | 'params'> = {}) {
  return validationPipe({ ...options, validateParams: schema });
}
