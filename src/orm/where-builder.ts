import type { FilterOp, LogicalNode, RelationFilter, RelationNode, WhereCondition, WhereInput, WhereNode } from './types.js';

const FILTER_OPS = new Set<string>([
  'not', 'in', 'notIn', 'lt', 'lte', 'gt', 'gte',
  'contains', 'startsWith', 'endsWith',
  'has', 'hasEvery', 'hasSome', 'isEmpty',
]);

export class WhereBuilder {
  parse(where: WhereInput | undefined): WhereNode | null {
    if (!where || Object.keys(where).length === 0) return null;
    return this.parseObject(where);
  }

  private parseObject(obj: WhereInput): WhereNode {
    const children: WhereNode[] = [];

    for (const [key, value] of Object.entries(obj)) {
      if (key === 'AND') {
        children.push(this.parseLogical('AND', value));
      } else if (key === 'OR') {
        children.push(this.parseLogical('OR', value));
      } else if (key === 'NOT') {
        children.push(this.parseLogical('NOT', value));
      } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        const filterObj = value as Record<string, unknown>;
        if (this.isRelationFilter(filterObj)) {
          children.push(this.parseRelationFilter(key, filterObj));
        } else if (this.isFilterObject(filterObj)) {
          for (const [op, opValue] of Object.entries(filterObj)) {
            children.push(this.makeCondition(key, op as FilterOp, opValue));
          }
        } else {
          children.push(this.makeCondition(key, 'eq', value));
        }
      } else if (value === null) {
        children.push(this.makeCondition(key, 'isNull', null));
      } else {
        children.push(this.makeCondition(key, 'eq', value));
      }
    }

    if (children.length === 0) {
      return { type: 'AND', children: [] };
    }
    if (children.length === 1) {
      return children[0]!;
    }
    return { type: 'AND', children };
  }

  private parseLogical(type: 'AND' | 'OR' | 'NOT', value: unknown): LogicalNode {
    if (type === 'NOT') {
      if (Array.isArray(value)) {
        return { type: 'AND', children: value.map((v) => this.parseLogical('NOT', v)) };
      }
      const inner = this.parseObject(value as WhereInput);
      return { type: 'NOT', children: [inner] };
    }
    if (Array.isArray(value)) {
      const children = value.map((v) => this.parseObject(v as WhereInput));
      return { type, children };
    }
    return { type, children: [this.parseObject(value as WhereInput)] };
  }

  private parseRelationFilter(field: string, obj: Record<string, unknown>): RelationNode {
    for (const filter of (['some', 'every', 'none'] as const)) {
      if (filter in obj) {
        return {
          field,
          filter: filter as RelationFilter,
          child: this.parseObject(obj[filter] as WhereInput),
        };
      }
    }
    return {
      field,
      filter: 'some',
      child: this.parseObject(obj as WhereInput),
    };
  }

  private makeCondition(field: string, op: FilterOp, value: unknown): WhereCondition {
    return { field, op, value };
  }

  private isFilterObject(obj: Record<string, unknown>): boolean {
    for (const key of Object.keys(obj)) {
      if (FILTER_OPS.has(key) || key === 'isNull' || key === 'isNotNull') return true;
    }
    return false;
  }

  private isRelationFilter(obj: Record<string, unknown>): boolean {
    return 'some' in obj || 'every' in obj || 'none' in obj;
  }
}
