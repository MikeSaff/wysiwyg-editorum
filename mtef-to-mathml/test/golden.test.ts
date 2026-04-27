import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseMathTypeSync, validateLatex } from '../src/index.js';

const fixturesDir = join(process.cwd(), '..', 'docs', 'mtef-test-fixtures');
const localGoldenDir = join(process.cwd(), 'test', 'golden');

function listGoldenBins(dir: string): string[] {
  return existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith('.bin')).sort() : [];
}

const goldenBins = listGoldenBins(fixturesDir);
const localGoldenBins = listGoldenBins(localGoldenDir);

describe('golden fixtures', () => {
  it('discovers golden fixture files when Claude adds them', () => {
    expect(Array.isArray(goldenBins)).toBe(true);
  });

  it.each(goldenBins)('matches %s MathML and LaTeX', (binName) => {
    const stem = basename(binName, '.bin');
    const mathmlPath = join(fixturesDir, `${stem}.mathml`);
    const texPath = join(fixturesDir, `${stem}.tex`);
    if (!existsSync(mathmlPath) || !existsSync(texPath)) {
      return;
    }
    const result = parseMathTypeSync(readFileSync(join(fixturesDir, binName)));
    expect(normalizeXml(result.mathml)).toBe(normalizeXml(readFileSync(mathmlPath, 'utf8')));
    expect(result.latex).toBe(readFileSync(texPath, 'utf8').trim());
    expect(validateLatex(result.latex).valid).toBe(true);
  });

  it.each(localGoldenBins)('local golden %s MathML, LaTeX, validateLatex', (binName) => {
    const stem = basename(binName, '.bin');
    const mathmlPath = join(localGoldenDir, `${stem}.mathml`);
    const texPath = join(localGoldenDir, `${stem}.tex`);
    const result = parseMathTypeSync(readFileSync(join(localGoldenDir, binName)));
    expect(normalizeXml(result.mathml)).toBe(normalizeXml(readFileSync(mathmlPath, 'utf8')));
    expect(result.latex).toBe(readFileSync(texPath, 'utf8').trim());
    expect(validateLatex(result.latex).valid).toBe(true);
  });
});

function normalizeXml(value: string): string {
  return value.replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim();
}
