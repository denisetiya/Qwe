import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  moduleTemplate,
  controllerTemplate,
  serviceTemplate,
  routerTemplate,
  schemaTemplate,
} from './templates/index.js';
import { cyan, green, yellow, red } from './colors.js';

type GeneratorType = 'module' | 'controller' | 'service' | 'router' | 'schema';

const GENERATORS: Record<GeneratorType, (name: string) => { content: string; subdir: string; suffix: string }> = {
  module: (name) => ({
    content: moduleTemplate(name),
    subdir: name,
    suffix: `${name}.module.ts`,
  }),
  controller: (name) => ({
    content: controllerTemplate(name),
    subdir: name,
    suffix: `${name}.controller.ts`,
  }),
  service: (name) => ({
    content: serviceTemplate(name),
    subdir: name,
    suffix: `${name}.service.ts`,
  }),
  router: (name) => ({
    content: routerTemplate(name),
    subdir: name,
    suffix: `${name}.router.ts`,
  }),
  schema: (name) => {
    const parts = name.split('-');
    const dir = parts.length > 1 ? parts.slice(1).join('-') : name;
    return {
      content: schemaTemplate(name),
      subdir: path.join(dir, 'dto'),
      suffix: `${name}.schema.ts`,
    };
  },
};

const VALID_TYPES = Object.keys(GENERATORS) as GeneratorType[];

export function generate(type: string, name: string, cwd: string): void {
  if (!VALID_TYPES.includes(type as GeneratorType)) {
    console.error(red(`Unknown generator type: "${type}"`));
    console.error(yellow(`Valid types: ${VALID_TYPES.join(', ')}`));
    process.exit(1);
  }

  const generator = GENERATORS[type as GeneratorType]!;
  const result = generator(name);
  const srcDir = path.join(cwd, 'src', result.subdir);
  const filePath = path.join(srcDir, result.suffix);

  if (!fs.existsSync(srcDir)) {
    fs.mkdirSync(srcDir, { recursive: true });
  }

  if (fs.existsSync(filePath)) {
    console.error(red(`File already exists: ${filePath}`));
    process.exit(1);
  }

  fs.writeFileSync(filePath, result.content, 'utf-8');
  console.log(green('✓') + ` Created ${cyan(path.relative(cwd, filePath))}`);
}

export function generateModule(name: string, cwd: string): void {
  const types: GeneratorType[] = ['module', 'controller', 'service', 'router'];
  for (const type of types) {
    const generator = GENERATORS[type];
    const result = generator(name);
    const srcDir = path.join(cwd, 'src', result.subdir);
    const filePath = path.join(srcDir, result.suffix);

    if (!fs.existsSync(srcDir)) {
      fs.mkdirSync(srcDir, { recursive: true });
    }

    if (fs.existsSync(filePath)) {
      console.log(yellow('⊘') + ` Skipped ${path.relative(cwd, filePath)} (exists)`);
      continue;
    }

    fs.writeFileSync(filePath, result.content, 'utf-8');
    console.log(green('✓') + ` Created ${cyan(path.relative(cwd, filePath))}`);
  }
}
