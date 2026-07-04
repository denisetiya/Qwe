export function routerTemplate(name: string): string {
  const pascal = toPascalCase(name);
  return `import { RouterBuilder } from 'qwe';
import { ${pascal}Controller } from './${name}.controller.js';

export function build${pascal}Router(rb: RouterBuilder): void {
  rb.get('/', ${pascal}Controller, 'findAll');
  rb.get('/:id', ${pascal}Controller, 'findOne');
  rb.post('/', ${pascal}Controller, 'create');
  rb.put('/:id', ${pascal}Controller, 'update');
  rb.delete('/:id', ${pascal}Controller, 'remove');
}
`;
}

function toPascalCase(str: string): string {
  return str
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\s+/g, '');
}
