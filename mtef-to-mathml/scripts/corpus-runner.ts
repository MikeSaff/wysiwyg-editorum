import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { parseMathTypeSync } from '../src/index.js';
import { readZipEntries } from './zip.js';

interface CorpusItem {
  name: string;
  data: Uint8Array;
}

interface Args {
  docx?: string;
  fixturesDir?: string;
  updateContext?: boolean;
}

const DEFAULT_DOCX =
  'C:\\Projects\\WYSIWYG\\Docx\\Nauka\\Сложные журналы\\Физика плазмы\\1 25\\Trukhachev\\Trukhachev.docx';
const DEFAULT_FIXTURES = resolve(process.cwd(), '..', 'docs', 'mtef-test-fixtures', '_raw');

const args = parseArgs(process.argv.slice(2));
const items = loadItems(args);
let ok = 0;
const warningCounts = new Map<string, number>();
const failures: string[] = [];

for (const item of items) {
  try {
    const result = parseMathTypeSync(item.data);
    if (result.mathml.includes('<math') && result.mathml.length > 70) ok += 1;
    for (const warning of result.warnings) {
      warningCounts.set(warning.type, (warningCounts.get(warning.type) ?? 0) + 1);
    }
  } catch (error) {
    failures.push(`${item.name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const topWarnings = [...warningCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
const summary = [
  `MTEF corpus coverage: ${ok}/${items.length}`,
  `Failures: ${failures.length}`,
  `Top warnings: ${topWarnings.map(([type, count]) => `${type}=${count}`).join(', ') || 'none'}`
].join('\n');

console.log(summary);
if (failures.length > 0) {
  console.log('First failures:');
  for (const failure of failures.slice(0, 10)) console.log(`- ${failure}`);
}

if (args.updateContext) {
  updateActiveContext(ok, items.length, topWarnings);
}

if (items.length >= 96 && ok < 88) {
  process.exitCode = 1;
}

function parseArgs(argv: string[]): Args {
  const parsed: Args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--docx') parsed.docx = argv[++i];
    else if (arg === '--fixtures-dir') parsed.fixturesDir = argv[++i];
    else if (arg === '--update-context') parsed.updateContext = true;
  }
  return parsed;
}

function loadItems(parsed: Args): CorpusItem[] {
  const docx = parsed.docx ?? DEFAULT_DOCX;
  if (existsSync(docx)) {
    const entries = readZipEntries(readFileSync(docx), (name) => /^word\/embeddings\/oleObject\d+\.bin$/.test(name));
    return entries
      .sort((a, b) => naturalOleName(a.name).localeCompare(naturalOleName(b.name), undefined, { numeric: true }))
      .map((entry) => ({ name: entry.name, data: entry.data }));
  }

  const fixturesDir = parsed.fixturesDir ?? DEFAULT_FIXTURES;
  if (!existsSync(fixturesDir)) {
    throw new Error(`No corpus found. Missing DOCX ${docx} and fixtures dir ${fixturesDir}`);
  }

  return readdirSync(fixturesDir)
    .filter((name) => /^oleObject\d+\.bin$/.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((name) => ({ name, data: readFileSync(join(fixturesDir, name)) }));
}

function naturalOleName(name: string): string {
  return basename(name);
}

function updateActiveContext(ok: number, total: number, topWarnings: [string, number][]): void {
  const contextDir = resolve(process.cwd(), '..', '.context');
  const contextPath = join(contextDir, 'activeContext.md');
  mkdirSync(contextDir, { recursive: true });
  const previous = existsSync(contextPath) ? readFileSync(contextPath, 'utf8') : '';
  const block = [
    '## MTEF parser library v0.1',
    '',
    `- Coverage: ${ok} out of ${total}`,
    `- Top-3 warning categories: ${topWarnings.map(([type, count]) => `${type} (${count})`).join(', ') || 'none'}`,
    `- Updated: ${new Date().toISOString()}`
  ].join('\n');
  const marker = '## MTEF parser library v0.1';
  const next = previous.includes(marker)
    ? previous.replace(new RegExp(`${marker}[\\s\\S]*?(?=\\n## |$)`), block)
    : `${previous.trimEnd()}\n\n${block}\n`;
  writeFileSync(contextPath, next.trimStart(), 'utf8');
}
