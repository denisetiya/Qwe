import * as process from 'node:process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { bold, cyan, green, gray } from './colors.js';
import { VERSION } from '../constants.js';

export async function info(cwd: string): Promise<void> {
  const lines: string[] = [];

  lines.push(bold(cyan('qwe Framework')));
  lines.push(`  Version:   ${green(VERSION)}`);
  lines.push(`  Node.js:   ${green(process.version)}`);
  lines.push(`  Platform:  ${gray(process.platform + ' ' + process.arch)}`);
  lines.push(`  CWD:       ${gray(cwd)}`);

  try {
    const pkgPath = path.join(cwd, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.dependencies?.['qwe']) {
        lines.push(`  Project:   ${pkg.name ?? 'unnamed'} (qwe ${pkg.dependencies['qwe']})`);
      }
    }
  } catch {
    // skip
  }

  console.log(lines.join('\n'));
}
