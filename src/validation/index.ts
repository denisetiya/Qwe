import {
  string,
  number,
  boolean,
  date,
  array,
  object,
  enum_,
  literal,
  union,
  discriminatedUnion,
  any,
  unknown,
  nullable,
  optional,
} from './builder.js';
import { parse, parseAsync } from './parser.js';
import { safeParse, safeParseAsync } from './safe-parser.js';

export const v = {
  string,
  number,
  boolean,
  date,
  array,
  object,
  enum: enum_,
  literal,
  union,
  discriminatedUnion,
  any,
  unknown,
  nullable,
  optional,
  parse,
  parseAsync,
  safeParse,
  safeParseAsync,
};

export type { Infer } from './types.js';
export type { ValidationError, Schema, Shape, InferShape, Prettify, LiteralValue, AnySchema } from './types.js';
export type { SafeParseResult, SafeParseSuccess, SafeParseFailure } from './safe-parser.js';
export { QweValidationError } from './parser.js';
export { SchemaBase } from './rules.js';
export type { ObjectSchema } from './builder.js';
export { validationPipe, body, query, params, type ValidationPipeOptions } from './pipe.js';
