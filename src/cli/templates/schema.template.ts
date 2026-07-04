export function schemaTemplate(name: string): string {
  const pascal = toPascalCase(name);
  return `import { v } from 'qwe';

export const ${camelCase(name)}Schema = v.object({
  // Define schema fields here
});

export type ${pascal}Input = v.Infer<typeof ${camelCase(name)}Schema>;
`;
}

function toPascalCase(str: string): string {
  return str
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\s+/g, '');
}

function camelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}
