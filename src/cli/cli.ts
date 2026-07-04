#!/usr/bin/env node

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as process from 'node:process';
import { generate, generateModule } from './generate.js';
import { migrateCreate, migrateRun, migrateRevert, migrateStatus } from './migrate.js';
import { info } from './info.js';
import { generatePostmanFromEntry } from './generate-postman.js';
import { bold, cyan, yellow, red, dim, green } from './colors.js';
import { VERSION } from '../constants.js';

interface ParsedArgs {
  command: string;
  args: string[];
  flags: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const rawArgs = argv.slice(2);
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i]!;
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const eqIdx = key.indexOf('=');
      if (eqIdx !== -1) {
        flags[key.slice(0, eqIdx)] = key.slice(eqIdx + 1);
      } else {
        const next = rawArgs[i + 1];
        if (next && !next.startsWith('-')) {
          flags[key] = next;
          i++;
        } else {
          flags[key] = true;
        }
      }
    } else if (arg.startsWith('-') && arg.length === 2) {
      const key = arg.slice(1);
      const next = rawArgs[i + 1];
      if (next && !next.startsWith('-')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  return {
    command: positional[0] ?? '',
    args: positional.slice(1),
    flags,
  };
}

function printHelp(): void {
  console.log(`
${bold(cyan('qwe'))} ${dim(`v${VERSION}`)} — High-performance TypeScript backend framework

${bold('Usage:')}
  qwe ${cyan('<command>')} [options]

${bold('Commands:')}
  ${cyan('new')}                        Scaffold a new qwe project
  ${cyan('generate')} ${dim('<type> <name>')}      Generate framework components
  ${cyan('migrate:create')} ${dim('<name>')}       Create a new migration file
  ${cyan('migrate:run')}                Run pending migrations
  ${cyan('migrate:revert')}             Revert the last migration
  ${cyan('migrate:status')}             Show migration status
  ${cyan('docs:postman')}               Generate Postman collection from routes
  ${cyan('info')}                       Show framework and environment info

${bold('Generate types:')}
  module, controller, service, router, schema

${bold('Examples:')}
  qwe new
  qwe generate module users
  qwe generate controller users
  qwe generate service users
  qwe generate router users
  qwe generate schema create-user
  qwe migrate:create add_users_table
  qwe migrate:run
  qwe migrate:status
`);
}

function printGenerateHelp(): void {
  console.log(`
${bold(cyan('qwe generate'))} — Generate framework components

${bold('Usage:')}
  qwe generate ${cyan('<type>')} ${dim('<name>')}

${bold('Types:')}
  ${cyan('module')} ${dim('<name>')}       Generate a complete module (module + controller + service + router)
  ${cyan('controller')} ${dim('<name>')}   Generate a controller class
  ${cyan('service')} ${dim('<name>')}      Generate a service class
  ${cyan('router')} ${dim('<name>')}       Generate a router builder
  ${cyan('schema')} ${dim('<name>')}       Generate a validation schema (in dto/ subdirectory)

${bold('Examples:')}
  qwe generate module users
  qwe generate controller users
  qwe generate schema create-user
`);
}

function printMigrateHelp(): void {
  console.log(`
${bold(cyan('qwe migrate'))} — Database migration commands

${bold('Usage:')}
  qwe migrate:create ${dim('<name>')}   Create a new migration file
  qwe migrate:run                  Run all pending migrations
  qwe migrate:revert               Revert the last applied migration
  qwe migrate:status               Show status of all migrations

${bold('Examples:')}
  qwe migrate:create add_users_table
  qwe migrate:run
  qwe migrate:revert
  qwe migrate:status
`);
}

function scaffoldProject(cwd: string): void {
  const dirs = ['src', 'src/app', 'migrations'];
  for (const dir of dirs) {
    const dirPath = path.join(cwd, dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(green('  ✓ ') + dim(`Created ${dir}/`));
    }
  }

  const entryPath = path.join(cwd, 'src', 'main.ts');
  if (!fs.existsSync(entryPath)) {
    const entry = `import { createApplication } from 'qwe';

const app = createApplication({ port: 3000 });

app.module((mod) => {
  mod.router('/', (rb) => {
    rb.get('/health', class HealthController {
      check() { return { status: 'ok' }; }
    }, 'check');
  });
});

app.listen().then(() => {
  console.log('Server running on http://localhost:3000');
});
`;
    fs.writeFileSync(entryPath, entry, 'utf-8');
    console.log(green('  ✓ ') + dim('Created src/main.ts'));
  }

  const tsconfigPath = path.join(cwd, 'tsconfig.json');
  if (!fs.existsSync(tsconfigPath)) {
    const tsconfig = JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        strict: true,
        esModuleInterop: true,
        outDir: './dist',
        rootDir: './src',
      },
      include: ['src/**/*.ts'],
    }, null, 2);
    fs.writeFileSync(tsconfigPath, tsconfig + '\n', 'utf-8');
    console.log(green('  ✓ ') + dim('Created tsconfig.json'));
  }

  console.log(`\n${bold(green('Project scaffolded!'))} ${dim('Edit src/main.ts to get started.')}`);
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv);
  const cwd = process.cwd();

  if (parsed.flags['help'] || parsed.flags['h']) {
    if (parsed.command === 'generate') {
      printGenerateHelp();
    } else if (parsed.command === 'migrate:create' || parsed.command === 'migrate:run' || parsed.command === 'migrate:revert' || parsed.command === 'migrate:status') {
      printMigrateHelp();
    } else {
      printHelp();
    }
    return;
  }

  if (parsed.flags['version'] || parsed.flags['v']) {
    console.log(VERSION);
    return;
  }

  switch (parsed.command) {
    case '':
      printHelp();
      break;

    case 'new':
      scaffoldProject(cwd);
      break;

    case 'generate':
    case 'g': {
      const type = parsed.args[0];
      const name = parsed.args[1];
      if (!type || !name) {
        printGenerateHelp();
        process.exit(1);
      }
      if (type === 'module') {
        generateModule(name, cwd);
      } else {
        generate(type, name, cwd);
      }
      break;
    }

    case 'migrate:create': {
      const name = parsed.args[0];
      if (!name) {
        console.error(red('Error: migration name required'));
        console.error(yellow('Usage: qwe migrate:create <name>'));
        process.exit(1);
      }
      migrateCreate(name, cwd);
      break;
    }

    case 'migrate:run':
      await migrateRun(cwd);
      break;

    case 'migrate:revert':
      await migrateRevert(cwd);
      break;

    case 'migrate:status':
      await migrateStatus(cwd);
      break;

    case 'info':
      await info(cwd);
      break;

    case 'docs:postman': {
      const name = typeof parsed.flags['name'] === 'string' ? parsed.flags['name'] : undefined;
      const baseUrl = typeof parsed.flags['baseUrl'] === 'string' ? parsed.flags['baseUrl'] : typeof parsed.flags['base-url'] === 'string' ? parsed.flags['base-url'] : undefined;
      const output = typeof parsed.flags['output'] === 'string' ? parsed.flags['output'] : typeof parsed.flags['o'] === 'string' ? parsed.flags['o'] : undefined;
      await generatePostmanFromEntry({ name, baseUrl, output }, cwd);
      break;
    }

    default:
      console.error(red(`Unknown command: "${parsed.command}"`));
      printHelp();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(red('Fatal error:'), err instanceof Error ? err.message : err);
  process.exit(1);
});
