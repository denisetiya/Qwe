import type { DbType, WhereNode, WhereCondition, LogicalNode, OrderItem } from '../types.js';
import type { MongoQuery } from '../types.js';
import type { Dialect } from './dialect.js';
import type { CompiledQuery } from '../types.js';
import type { MongoLookupDef } from '../include-builder.js';

export class MongoDialect implements Dialect {
  readonly type: DbType = 'mongo';

  escape(column: string): string {
    return column;
  }

  placeholder(index: number): string {
    return `$${index}`;
  }

  quoteTable(name: string): string {
    return name;
  }

  supportsReturning(): boolean {
    return false;
  }

  compileSelect(
    table: string,
    columns: string[],
    where: WhereNode | null,
    orderBy: OrderItem[],
    limit: number | null,
    offset: number | null,
  ): CompiledQuery {
    const filter = where ? this.convertWhere(where) : {};
    const projection: Record<string, 1> = {};
    if (columns[0] !== '*') {
      for (const col of columns) {
        projection[col] = 1;
      }
    }

    const pipeline: Record<string, unknown>[] = [];
    if (Object.keys(filter).length > 0) {
      pipeline.push({ $match: filter });
    }
    if (Object.keys(projection).length > 0) {
      pipeline.push({ $project: projection });
    }
    if (orderBy.length > 0) {
      const sort: Record<string, 1 | -1> = {};
      for (const o of orderBy) {
        sort[o.field] = o.direction === 'asc' ? 1 : -1;
      }
      pipeline.push({ $sort: sort });
    }
    if (offset !== null) {
      pipeline.push({ $skip: offset });
    }
    if (limit !== null) {
      pipeline.push({ $limit: limit });
    }

    const query: MongoQuery = {
      collection: table,
      operation: 'aggregate',
      pipeline,
    };

    return { sql: JSON.stringify(query), params: [], cacheKey: JSON.stringify(query) };
  }

  compileInsert(
    table: string,
    data: Record<string, unknown>[],
    _returning?: string[],
    _skipDuplicates?: boolean,
  ): CompiledQuery {
    const query: MongoQuery = {
      collection: table,
      operation: data.length === 1 ? 'insertOne' : 'insertMany',
      data: data.length === 1 ? data[0] : data,
    };

    return { sql: JSON.stringify(query), params: [], cacheKey: JSON.stringify(query) };
  }

  compileUpdate(
    table: string,
    data: Record<string, unknown>,
    where: WhereNode | null,
    _returning?: string[],
  ): CompiledQuery {
    const filter = where ? this.convertWhere(where) : {};
    const updateData: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(data)) {
      if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
        const fieldOps = val as Record<string, unknown>;
        if ('increment' in fieldOps) {
          if (!updateData.$inc) updateData.$inc = {};
          (updateData.$inc as Record<string, unknown>)[key] = fieldOps.increment;
          continue;
        }
        if ('decrement' in fieldOps) {
          if (!updateData.$inc) updateData.$inc = {};
          (updateData.$inc as Record<string, unknown>)[key] = { $multiply: [fieldOps.decrement, -1] };
          continue;
        }
      }
      if (!updateData.$set) updateData.$set = {};
      (updateData.$set as Record<string, unknown>)[key] = val;
    }

    const query: MongoQuery = {
      collection: table,
      operation: 'updateMany',
      filter,
      data: updateData as Record<string, unknown>,
    };

    return { sql: JSON.stringify(query), params: [], cacheKey: JSON.stringify(query) };
  }

  compileDelete(
    table: string,
    where: WhereNode | null,
    _returning?: string[],
  ): CompiledQuery {
    const filter = where ? this.convertWhere(where) : {};
    const query: MongoQuery = {
      collection: table,
      operation: 'deleteMany',
      filter,
    };

    return { sql: JSON.stringify(query), params: [], cacheKey: JSON.stringify(query) };
  }

  compileUpsert(
    table: string,
    data: Record<string, unknown>,
    _conflictKeys: string[],
    updateFields: Record<string, unknown>,
    _returning?: string[],
  ): CompiledQuery {
    const query: MongoQuery = {
      collection: table,
      operation: 'updateOne',
      filter: Object.fromEntries(_conflictKeys.map((k) => [k, data[k]])),
      data: { $set: updateFields, $setOnInsert: data } as unknown as Record<string, unknown>,
      options: { upsert: true },
    };

    return { sql: JSON.stringify(query), params: [], cacheKey: JSON.stringify(query) };
  }

  compileCount(
    table: string,
    where: WhereNode | null,
    _field?: string,
  ): CompiledQuery {
    const filter = where ? this.convertWhere(where) : {};
    const query: MongoQuery = {
      collection: table,
      operation: 'aggregate',
      pipeline: [
        ...(Object.keys(filter).length > 0 ? [{ $match: filter }] : []),
        { $count: 'count' },
      ],
    };

    return { sql: JSON.stringify(query), params: [], cacheKey: JSON.stringify(query) };
  }

  compileAggregate(
    table: string,
    where: WhereNode | null,
    aggregations: { fn: string; field: string; alias: string }[],
  ): CompiledQuery {
    const filter = where ? this.convertWhere(where) : {};
    const group: Record<string, unknown> = { _id: null };
    for (const agg of aggregations) {
      const mongoFn = this.mapAggFn(agg.fn);
      group[agg.alias] = { [mongoFn]: `$${agg.field}` };
    }

    const pipeline: Record<string, unknown>[] = [];
    if (Object.keys(filter).length > 0) pipeline.push({ $match: filter });
    pipeline.push({ $group: group });
    pipeline.push({ $project: { _id: 0 } });

    const query: MongoQuery = {
      collection: table,
      operation: 'aggregate',
      pipeline,
    };

    return { sql: JSON.stringify(query), params: [], cacheKey: JSON.stringify(query) };
  }

  compileGroupBy(
    table: string,
    by: string[],
    where: WhereNode | null,
    aggregations: { fn: string; field: string; alias: string }[],
    having: WhereNode | null,
    orderBy: OrderItem[],
    limit: number | null,
    offset: number | null,
  ): CompiledQuery {
    const filter = where ? this.convertWhere(where) : {};
    const groupId: Record<string, unknown> = {};
    for (const field of by) {
      groupId[field] = `$${field}`;
    }
    const group: Record<string, unknown> = { _id: groupId };
    for (const agg of aggregations) {
      const mongoFn = this.mapAggFn(agg.fn);
      group[agg.alias] = { [mongoFn]: `$${agg.field}` };
    }

    const pipeline: Record<string, unknown>[] = [];
    if (Object.keys(filter).length > 0) pipeline.push({ $match: filter });
    pipeline.push({ $group: group });

    if (having) {
      const havingFilter = this.convertWhere(having);
      pipeline.push({ $match: havingFilter });
    }

    if (orderBy.length > 0) {
      const sort: Record<string, 1 | -1> = {};
      for (const o of orderBy) {
        sort[o.field] = o.direction === 'asc' ? 1 : -1;
      }
      pipeline.push({ $sort: sort });
    }

    if (offset !== null) pipeline.push({ $skip: offset });
    if (limit !== null) pipeline.push({ $limit: limit });

    const query: MongoQuery = {
      collection: table,
      operation: 'aggregate',
      pipeline,
    };

    return { sql: JSON.stringify(query), params: [], cacheKey: JSON.stringify(query) };
  }

  compileLookup(lookup: MongoLookupDef): Record<string, unknown> {
    const pipeline: Record<string, unknown>[] = [];
    if (lookup.pipeline) {
      pipeline.push(...lookup.pipeline);
    }

    return {
      $lookup: {
        from: lookup.from,
        localField: lookup.localField,
        foreignField: lookup.foreignField,
        as: lookup.as,
        ...(pipeline.length > 0 ? { pipeline } : {}),
      },
    };
  }

  private convertWhere(node: WhereNode): Record<string, unknown> {
    if ('field' in node && 'op' in node) {
      return this.convertCondition(node as WhereCondition);
    }
    if ('type' in node && 'children' in node) {
      return this.convertLogical(node as LogicalNode);
    }
    return {};
  }

  private convertCondition(node: WhereCondition): Record<string, unknown> {
    switch (node.op) {
      case 'eq': return { [node.field]: node.value };
      case 'not': return { [node.field]: { $ne: node.value } };
      case 'in': return { [node.field]: { $in: node.value } };
      case 'notIn': return { [node.field]: { $nin: node.value } };
      case 'gt': return { [node.field]: { $gt: node.value } };
      case 'gte': return { [node.field]: { $gte: node.value } };
      case 'lt': return { [node.field]: { $lt: node.value } };
      case 'lte': return { [node.field]: { $lte: node.value } };
      case 'contains': return { [node.field]: { $regex: node.value, $options: 'i' } };
      case 'startsWith': return { [node.field]: { $regex: `^${node.value}`, $options: 'i' } };
      case 'endsWith': return { [node.field]: { $regex: `${node.value}$`, $options: 'i' } };
      case 'isNull': return { [node.field]: { $exists: false } };
      case 'isNotNull': return { [node.field]: { $exists: true } };
      case 'has': return { [node.field]: node.value };
      case 'hasEvery': return { [node.field]: { $all: node.value } };
      case 'hasSome': return { [node.field]: { $elemMatch: { $in: node.value as unknown[] } } };
      case 'isEmpty': return { $or: [{ [node.field]: { $exists: false } }, { [node.field]: { $size: 0 } }] };
      default: return { [node.field]: node.value };
    }
  }

  private convertLogical(node: LogicalNode): Record<string, unknown> {
    const children = node.children.map((c) => this.convertWhere(c));
    if (node.type === 'AND') return children.length === 1 ? children[0]! : { $and: children };
    if (node.type === 'OR') return { $or: children };
    if (node.type === 'NOT') return { $nor: children };
    return {};
  }

  private mapAggFn(fn: string): string {
    switch (fn.toUpperCase()) {
      case 'COUNT': return '$sum';
      case 'SUM': return '$sum';
      case 'AVG': return '$avg';
      case 'MIN': return '$min';
      case 'MAX': return '$max';
      default: return '$sum';
    }
  }
}
