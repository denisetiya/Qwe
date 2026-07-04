import type { IncludeClause, SelectClause, WhereInput, OrderBy } from './types.js';

export interface JoinDef {
  table: string;
  alias: string;
  on: { left: string; right: string };
  type: 'LEFT' | 'INNER';
  columns: string[];
  nested?: JoinDef[];
  where?: WhereInput;
  orderBy?: OrderBy | OrderBy[];
  take?: number;
  skip?: number;
}

export interface MongoLookupDef {
  from: string;
  localField: string;
  foreignField: string;
  as: string;
  pipeline?: Record<string, unknown>[];
}

export class IncludeBuilder {
  parseJoins(
    parentTable: string,
    include: IncludeClause | undefined,
    _relations: Record<string, { table: string; foreignKey: string; primaryKey: string }>,
  ): JoinDef[] {
    if (!include) return [];

    const joins: JoinDef[] = [];
    for (const [key, config] of Object.entries(include)) {
      if (config === false) continue;

      const rel = _relations[key];
      if (!rel) continue;

      const alias = `${parentTable}_${key}`;
      const join: JoinDef = {
        table: rel.table,
        alias,
        on: {
          left: `${parentTable}.${rel.primaryKey}`,
          right: `${alias}.${rel.foreignKey}`,
        },
        type: 'LEFT',
        columns: config === true ? ['*'] : this.extractColumns(config.select),
      };

      if (typeof config === 'object' && config !== null) {
        const cfg = config as {
          where?: WhereInput;
          include?: IncludeClause;
          orderBy?: OrderBy | OrderBy[];
          take?: number;
          skip?: number;
        };
        join.where = cfg.where;
        join.take = cfg.take;
        join.skip = cfg.skip;
        join.orderBy = cfg.orderBy;
        if (cfg.include) {
          join.nested = this.parseJoins(alias, cfg.include, _relations);
        }
      }

      joins.push(join);
    }
    return joins;
  }

  parseMongoLookups(
    include: IncludeClause | undefined,
    relations: Record<string, { table: string; foreignKey: string; primaryKey: string }>,
  ): MongoLookupDef[] {
    if (!include) return [];

    const lookups: MongoLookupDef[] = [];
    for (const [key, config] of Object.entries(include)) {
      if (config === false) continue;

      const rel = relations[key];
      if (!rel) continue;

      const lookup: MongoLookupDef = {
        from: rel.table,
        localField: rel.primaryKey,
        foreignField: rel.foreignKey,
        as: key,
      };

      if (typeof config === 'object' && config !== null) {
        const cfg = config as { where?: WhereInput; take?: number };
        const pipeline: Record<string, unknown>[] = [];
        if (cfg.where) pipeline.push({ $match: cfg.where });
        if (cfg.take) pipeline.push({ $limit: cfg.take });
        if (pipeline.length > 0) lookup.pipeline = pipeline;
      }

      lookups.push(lookup);
    }
    return lookups;
  }

  private extractColumns(select: SelectClause | undefined): string[] {
    if (!select) return ['*'];
    return Object.entries(select)
      .filter(([, v]) => v === true)
      .map(([k]) => k);
  }
}
