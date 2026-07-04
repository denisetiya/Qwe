import type { DbType, WhereCondition } from '../types.js';
import { SqlDialect } from './sql-dialect.js';

export class PostgresDialect extends SqlDialect {
  readonly type: DbType = 'postgres';

  escape(column: string): string {
    if (column === '*') return '*';
    const parts = column.split('.');
    return parts.map((p) => `"${p}"`).join('.');
  }

  placeholder(index: number): string {
    return `$${index + 1}`;
  }

  supportsReturning(): boolean {
    return true;
  }

  override compileCondition(node: WhereCondition, params: unknown[]): string {
    const col = this.escape(node.field);

    if (node.op === 'contains') {
      params.push(`%${node.value as string}%`);
      return `${col} ILIKE ${this.placeholder(params.length - 1)}`;
    }
    if (node.op === 'startsWith') {
      params.push(`${node.value as string}%`);
      return `${col} ILIKE ${this.placeholder(params.length - 1)}`;
    }
    if (node.op === 'endsWith') {
      params.push(`%${node.value as string}`);
      return `${col} ILIKE ${this.placeholder(params.length - 1)}`;
    }
    if (node.op === 'hasEvery') {
      const vals = node.value as unknown[];
      vals.forEach((v) => params.push(v));
      return `${col} @> ARRAY[${vals.map((_, i) => this.placeholder(params.length - vals.length + i)).join(', ')}]`;
    }
    if (node.op === 'hasSome') {
      const vals = node.value as unknown[];
      vals.forEach((v) => params.push(v));
      return `${col} && ARRAY[${vals.map((_, i) => this.placeholder(params.length - vals.length + i)).join(', ')}]`;
    }

    return super.compileCondition(node, params);
  }
}
