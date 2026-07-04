import * as fs from 'node:fs';
import * as path from 'node:path';
import { green, red, yellow, cyan, gray, bold } from './colors.js';

const MIGRATIONS_DIR = 'migrations';

export function migrateCreate(name: string, cwd: string): void {
  const dir = path.join(cwd, MIGRATIONS_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const sanitized = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const filename = `${timestamp}_${sanitized}.ts`;
  const filePath = path.join(dir, filename);

  const content = `import type { MigrationModule } from 'qwe';

export const migration: MigrationModule = {
  async up(ctx) {
    // Migration UP logic
  },

  async down(ctx) {
    // Migration DOWN logic
  },
};
`;

  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(green('✓') + ` Created migration: ${cyan(path.relative(cwd, filePath))}`);
}

export async function migrateRun(cwd: string): Promise<void> {
  const dir = path.join(cwd, MIGRATIONS_DIR);
  const files = getMigrationFiles(dir);

  if (files.length === 0) {
    console.log(yellow('No migrations found.'));
    return;
  }

  let applied: string[];
  try {
    const { Migration, ConnectionManager } = await import('../orm/index.js');
    const connManager = new ConnectionManager();
    const migration = new Migration(connManager, dir);
    const result = await migration.runMigrations();
    applied = result.applied;
  } catch {
    console.log(yellow('Database not available. Listing pending migrations:'));
    applied = [];
  }

  if (applied.length === 0) {
    console.log(green('✓') + ' All migrations are up to date.');
  } else {
    console.log(bold(`Applied ${applied.length} migration(s):`));
    for (const name of applied) {
      console.log(green('  ✓ ') + name);
    }
  }
}

export async function migrateRevert(cwd: string): Promise<void> {
  const dir = path.join(cwd, MIGRATIONS_DIR);

  try {
    const { Migration, ConnectionManager } = await import('../orm/index.js');
    const connManager = new ConnectionManager();
    const migration = new Migration(connManager, dir);
    const result = await migration.revertMigration();

    if (result.reverted) {
      console.log(green('✓') + ` Reverted: ${cyan(result.reverted)}`);
    } else {
      console.log(yellow('No migrations to revert.'));
    }
  } catch {
    console.log(red('Could not connect to database for revert.'));
  }
}

export async function migrateStatus(cwd: string): Promise<void> {
  const dir = path.join(cwd, MIGRATIONS_DIR);
  const files = getMigrationFiles(dir);

  if (files.length === 0) {
    console.log(yellow('No migration files found.'));
    return;
  }

  let appliedNames = new Set<string>();
  let dbAvailable = true;
  try {
    const { Migration, ConnectionManager } = await import('../orm/index.js');
    const connManager = new ConnectionManager();
    const migration = new Migration(connManager, dir);
    const applied = await migration.getAppliedMigrations();
    appliedNames = new Set(applied.map((m) => m.name));
  } catch {
    dbAvailable = false;
  }

  console.log(bold('Migrations:'));
  for (const file of files) {
    const name = path.basename(file);
    const applied = appliedNames.has(name);
    const status = !dbAvailable ? yellow('? unknown') : applied ? green('✓ applied') : gray('○ pending');
    console.log(`  ${status}  ${name}`);
  }

  if (!dbAvailable) {
    console.log(gray('\n  Database connection not available. Status unknown.'));
  }
}

function getMigrationFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.ts') || f.endsWith('.js'))
    .sort()
    .map((f) => path.join(dir, f));
}
