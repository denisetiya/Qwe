export function serviceTemplate(name: string): string {
  const pascal = toPascalCase(name);
  return `export class ${pascal}Service {
  async findAll(): Promise<unknown[]> {
    return [];
  }

  async findOne(id: string): Promise<unknown | null> {
    return null;
  }

  async create(data: Record<string, unknown>): Promise<unknown> {
    return data;
  }

  async update(id: string, data: Record<string, unknown>): Promise<unknown> {
    return { id, ...data };
  }

  async remove(id: string): Promise<void> {
    // remove logic
  }
}
`;
}

function toPascalCase(str: string): string {
  return str
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\s+/g, '');
}
