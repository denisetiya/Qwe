import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Metadata } from '../core/metadata.js';
import type { RouteDefinition } from '../core/router.js';
import { green, cyan, dim, red } from './colors.js';

interface PostmanCollection {
  info: {
    name: string;
    description: string;
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json';
  };
  variable: Array<{ key: string; value: string; type: string }>;
  item: PostmanItem[];
}

interface PostmanItem {
  name: string;
  description?: string;
  item?: PostmanItem[];
  request?: {
    method: string;
    header: Array<{ key: string; value: string; description?: string }>;
    url: {
      raw: string;
      host: string[];
      path: string[];
      query?: Array<{ key: string; value: string; description?: string; disabled?: boolean }>;
      variable?: Array<{ key: string; value: string; description?: string }>;
    };
    body?: {
      mode: 'raw';
      raw: string;
      options: { raw: { language: 'json' } };
    };
    description?: string;
  };
  response?: PostmanExample[];
}

interface PostmanExample {
  name: string;
  originalRequest: PostmanItem['request'];
  status: string;
  code: number;
  header: Array<{ key: string; value: string }>;
  body: string;
}

export interface GeneratePostmanOptions {
  name?: string;
  description?: string;
  baseUrl?: string;
  output?: string;
}

function routeToPostmanPath(routePath: string): { path: string[]; variables: Array<{ key: string; value: string; description: string }> } {
  const segments = routePath.split('/').filter(Boolean);
  const path: string[] = [];
  const variables: Array<{ key: string; value: string; description: string }> = [];

  for (const seg of segments) {
    if (seg.startsWith(':')) {
      const name = seg.slice(1);
      path.push(`:${name}`);
      variables.push({ key: name, value: '', description: `Path parameter: ${name}` });
    } else {
      path.push(seg);
    }
  }
  return { path, variables };
}

function guessBodyExample(method: string): string | null {
  if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
    return JSON.stringify({ data: 'example' }, null, 2);
  }
  return null;
}

function groupByPrefix(routes: RouteDefinition[]): Map<string, RouteDefinition[]> {
  const groups = new Map<string, RouteDefinition[]>();

  for (const route of routes) {
    const segments = route.path.split('/').filter(Boolean);
    const prefix = segments[0] ?? 'root';
    const existing = groups.get(prefix) ?? [];
    existing.push(route);
    groups.set(prefix, existing);
  }
  return groups;
}

function methodLabel(method: string): string {
  const labels: Record<string, string> = {
    GET: 'Get',
    POST: 'Create',
    PUT: 'Update',
    PATCH: 'Patch',
    DELETE: 'Delete',
    HEAD: 'Head',
    OPTIONS: 'Options',
    ANY: 'Any',
  };
  return labels[method.toUpperCase()] ?? method;
}

export function generatePostman(options: GeneratePostmanOptions = {}, cwd: string = process.cwd()): void {
  const modules = Metadata.getAll();
  const allRoutes: RouteDefinition[] = [];

  for (const mod of modules) {
    allRoutes.push(...mod.routes);
  }

  if (allRoutes.length === 0) {
    console.error(red('No routes found. Register modules before generating docs.'));
    return;
  }

  const name = options.name ?? 'Qwe API Collection';
  const description = options.description ?? `Auto-generated Postman collection for ${name}`;
  const baseUrl = options.baseUrl ?? 'http://localhost:3000';

  const collection: PostmanCollection = {
    info: {
      name,
      description,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    variable: [
      { key: 'baseUrl', value: baseUrl, type: 'string' },
    ],
    item: [],
  };

  const groups = groupByPrefix(allRoutes);

  for (const [prefix, routes] of groups) {
    const folder: PostmanItem = {
      name: prefix.charAt(0).toUpperCase() + prefix.slice(1),
      description: `${routes.length} endpoint(s)`,
      item: [],
    };

    for (const route of routes) {
      const { path: pathSegments, variables } = routeToPostmanPath(route.path);
      const body = guessBodyExample(route.method);
      const rawUrl = `{{baseUrl}}/${pathSegments.join('/')}`;

      const headers: Array<{ key: string; value: string; description?: string }> = [
        { key: 'Content-Type', value: 'application/json' },
        { key: 'Accept', value: 'application/json' },
      ];

      const request: PostmanItem['request'] = {
        method: route.method.toUpperCase(),
        header: headers,
        url: {
          raw: rawUrl,
          host: ['{{baseUrl}}'],
          path: pathSegments,
          variable: variables.length > 0 ? variables : undefined,
        },
        description: `Handler: ${route.handler.controllerToken}.${route.handler.methodName}`,
      };

      if (body) {
        request.body = {
          mode: 'raw',
          raw: body,
          options: { raw: { language: 'json' } },
        };
      }

      const guards = route.guards as Function[];
      if (guards.length > 0) {
        headers.push({ key: 'Authorization', value: 'Bearer {{token}}', description: 'JWT token (guard-protected)' });
      }

      const example: PostmanExample = {
        name: `${methodLabel(route.method)} ${route.path}`,
        originalRequest: request,
        status: 'OK',
        code: route.method.toUpperCase() === 'POST' ? 201 : 200,
        header: [{ key: 'Content-Type', value: 'application/json' }],
        body: JSON.stringify({ success: true, data: null, timestamp: new Date().toISOString() }, null, 2),
      };

      folder.item!.push({
        name: `${route.method.toUpperCase()} ${route.path}`,
        request,
        response: [example],
      });
    }

    collection.item.push(folder);
  }

  const outputDir = path.join(cwd, 'docs');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const fileName = options.output ?? 'postman-collection.json';
  const outputPath = path.join(outputDir, fileName);

  fs.writeFileSync(outputPath, JSON.stringify(collection, null, 2) + '\n', 'utf-8');

  console.log(green('✓') + ` Generated Postman collection: ` + cyan(path.relative(cwd, outputPath)));
  console.log(dim(`  ${allRoutes.length} route(s) across ${groups.size} group(s)`));
  console.log(dim(`  Import into Postman: File → Import → ${path.relative(cwd, outputPath)}`));
}

export async function generatePostmanFromEntry(options: GeneratePostmanOptions = {}, cwd: string = process.cwd()): Promise<void> {
  const candidates = ['src/main.ts', 'src/index.ts', 'src/app.ts', 'src/app/main.ts'];
  let entryPath: string | null = null;

  for (const candidate of candidates) {
    const p = path.join(cwd, candidate);
    if (fs.existsSync(p)) {
      entryPath = p;
      break;
    }
  }

  const distCandidates = ['dist/main.js', 'dist/index.js', 'dist/app.js'];
  if (!entryPath) {
    for (const candidate of distCandidates) {
      const p = path.join(cwd, candidate);
      if (fs.existsSync(p)) {
        entryPath = p;
        break;
      }
    }
  }

  if (!entryPath) {
    console.error(red('No entry file found (src/main.ts, src/index.ts, src/app.ts, or compiled dist/).'));
    return;
  }

  console.log(dim(`  Loading entry: ${path.relative(cwd, entryPath)}`));

  try {
    const fileUrl = pathToFileURL(entryPath).href;
    await import(fileUrl);
  } catch (err) {
    console.error(red('Failed to load entry file:'), err instanceof Error ? err.message : err);
    return;
  }

  generatePostman(options, cwd);
}
