import type { OrderBy, OrderItem, SortDirection } from './types.js';

export class OrderBuilder {
  parse(orderBy: OrderBy | OrderBy[] | undefined): OrderItem[] {
    if (!orderBy) return [];
    if (Array.isArray(orderBy)) {
      return orderBy.flatMap((o) => this.parseSingle(o));
    }
    return this.parseSingle(orderBy);
  }

  parseForMongo(orderBy: OrderBy | OrderBy[] | undefined): Record<string, 1 | -1> {
    const items = this.parse(orderBy);
    const sort: Record<string, 1 | -1> = {};
    for (const item of items) {
      sort[item.field] = item.direction === 'asc' ? 1 : -1;
    }
    return sort;
  }

  private parseSingle(orderBy: OrderBy): OrderItem[] {
    const items: OrderItem[] = [];
    for (const [field, value] of Object.entries(orderBy)) {
      if (value === 'asc' || value === 'desc') {
        items.push({ field, direction: value as SortDirection });
      } else if (typeof value === 'object' && value !== null) {
        const nested = this.parseSingle(value as OrderBy);
        for (const n of nested) {
          items.push({ field: `${field}.${n.field}`, direction: n.direction });
        }
      }
    }
    return items;
  }
}
