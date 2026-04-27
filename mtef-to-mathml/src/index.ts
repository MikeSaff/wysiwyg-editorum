import { renderLatex } from './latex.js';
import { renderMathML } from './mathml.js';
import { normalizeInput } from './ole.js';
import { parseMtef } from './parser.js';
import type { ParseResult, ParseWarning } from './types.js';

export type { ParseResult, ParseWarning, WarningType } from './types.js';

export function parseMathTypeSync(input: ArrayBuffer | Uint8Array): ParseResult {
  const normalized = normalizeInput(input);
  const warnings: ParseWarning[] = [...normalized.warnings];
  const ast = parseMtef(normalized.data, warnings);
  const mathml = renderMathML(ast, warnings);
  const latex = renderLatex(ast, warnings);
  return { mathml, latex, warnings };
}

export async function parseMathType(input: ArrayBuffer | Uint8Array): Promise<ParseResult> {
  return parseMathTypeSync(input);
}

export { parseMtef } from './parser.js';
export { validateLatex, fixLatexSpacing } from './latex.js';
