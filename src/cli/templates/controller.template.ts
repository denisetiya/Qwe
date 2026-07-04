export function controllerTemplate(name: string): string {
  const pascal = toPascalCase(name);
  return `import type { ExecutionContext } from 'qwe';
import { ${pascal}Service } from './${name}.service.js';

export class ${pascal}Controller {
  constructor(private readonly service: ${pascal}Service) {}

  async findAll(ctx: ExecutionContext) {
    const items = await this.service.findAll();
    ctx.res.json({ data: items });
  }

  async findOne(ctx: ExecutionContext) {
    const id = ctx.req.params.id;
    const item = await this.service.findOne(id);
    if (!item) {
      ctx.res.status(404).json({ error: '${pascal} not found' });
      return;
    }
    ctx.res.json({ data: item });
  }

  async create(ctx: ExecutionContext) {
    const body = ctx.req.body;
    const item = await this.service.create(body);
    ctx.res.status(201).json({ data: item });
  }

  async update(ctx: ExecutionContext) {
    const id = ctx.req.params.id;
    const body = ctx.req.body;
    const item = await this.service.update(id, body);
    ctx.res.json({ data: item });
  }

  async remove(ctx: ExecutionContext) {
    const id = ctx.req.params.id;
    await this.service.remove(id);
    ctx.res.status(204).end();
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
