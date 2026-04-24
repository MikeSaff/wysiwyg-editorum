#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { parseMathTypeSync } from './index.js';

interface CliArgs {
  input?: string;
  output?: string;
  warnings?: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '-o' || arg === '--output') {
      const value = argv[++i];
      if (value) args.output = value;
    } else if (arg === '--warnings') {
      args.warnings = true;
    } else if (!args.input) {
      if (arg) args.input = arg;
    }
  }
  return args;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) {
    console.error('Usage: mtef-to-mathml input.bin -o output.xml [--warnings]');
    process.exitCode = 2;
    return;
  }

  const result = parseMathTypeSync(readFileSync(args.input));
  if (args.output) {
    writeFileSync(args.output, result.mathml, 'utf8');
  } else {
    process.stdout.write(`${result.mathml}\n`);
  }

  if (args.warnings && result.warnings.length > 0) {
    process.stderr.write(`${JSON.stringify(result.warnings, null, 2)}\n`);
  }
}

main();
