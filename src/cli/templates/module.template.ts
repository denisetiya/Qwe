export function moduleTemplate(name: string): string {
  const pascal = toPascalCase(name);
  return `import { createModule } from 'qwe';
import { ${pascal}Controller } from './${name}.controller.js';
import { ${pascal}Service } from './${name}.service.js';
import { build${pascal}Router } from './${name}.router.js';

export const ${name}Module = createModule('${name}', (mod) => {
  mod.controller(${pascal}Controller);
  mod.provider('${pascal}Service', ${pascal}Service);
  mod.router('/${name}', (rb) => build${pascal}Router(rb));
});
`;
}

function toPascalCase(str: string): string {
  return str
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\s+/g, '');
}
