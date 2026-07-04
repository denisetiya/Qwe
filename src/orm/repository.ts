import type { BaseModel } from './model.js';
import type {
  CreateOptions, CreateManyOptions, DeleteManyOptions, DeleteOptions,
  FindFirstOptions, FindManyOptions, FindUniqueOptions, PaginateOptions,
  PaginateResult, UpdateManyOptions, UpdateOptions, UpsertOptions, WhereInput,
  AggregateOptions, GroupByOptions,
} from './types.js';

export class Repository<T = Record<string, unknown>> {
  private model: BaseModel<T>;

  constructor(model: BaseModel<T>) {
    this.model = model;
  }

  findFirst(options?: FindFirstOptions): Promise<T | null> {
    return this.model.findFirst(options);
  }

  findUnique(options: FindUniqueOptions): Promise<T | null> {
    return this.model.findUnique(options);
  }

  findMany(options?: FindManyOptions): Promise<T[]> {
    return this.model.findMany(options);
  }

  count(options?: { where?: WhereInput; field?: string }): Promise<number> {
    return this.model.count(options);
  }

  create(options: CreateOptions): Promise<T> {
    return this.model.create(options);
  }

  createMany(options: CreateManyOptions): Promise<{ count: number }> {
    return this.model.createMany(options);
  }

  update(options: UpdateOptions): Promise<T> {
    return this.model.update(options);
  }

  updateMany(options: UpdateManyOptions): Promise<{ count: number }> {
    return this.model.updateMany(options);
  }

  delete(options: DeleteOptions): Promise<T> {
    return this.model.delete(options);
  }

  deleteMany(options?: DeleteManyOptions): Promise<{ count: number }> {
    return this.model.deleteMany(options);
  }

  upsert(options: UpsertOptions): Promise<T> {
    return this.model.upsert(options);
  }

  aggregate(options: AggregateOptions): Promise<Record<string, unknown>> {
    return this.model.aggregate(options);
  }

  groupBy(options: GroupByOptions): Promise<Record<string, unknown>[]> {
    return this.model.groupBy(options);
  }

  paginate(options: PaginateOptions): Promise<PaginateResult<T>> {
    return this.model.paginate(options);
  }

  getModel(): BaseModel<T> {
    return this.model;
  }
}
