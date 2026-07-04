export interface ValidationError {
  path: string[];
  message: string;
  code: string;
}

export type ValidationIssue = Readonly<ValidationError>;

export type Infer<T> = T extends Schema<infer U> ? U : never;

export interface Schema<T = unknown> {
  readonly _type: T;
  readonly _kind: string;
  _validate(value: unknown, path: string[]): { ok: true; value: T } | { ok: false; errors: ValidationError[] };
}

export type AnySchema = Schema<any>;

export type Shape = Record<string, AnySchema>;

export type InferShape<S extends Shape> = {
  [K in keyof S]: Infer<S[K]>;
};

export type Merge<A, B> = Omit<A, keyof B> & B;

export type Prettify<T> = { [K in keyof T]: T[K] } & {};

export type LiteralValue = string | number | boolean | null;
