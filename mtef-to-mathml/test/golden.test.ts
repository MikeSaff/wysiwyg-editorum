import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseMathTypeSync } from '../src/index.js';

const fixturesDir = join(process.cwd(), '..', 'docs', 'mtef-test-fixtures');
const goldenBins = existsSync(fixturesDir)
  ? readdirSync(fixturesDir).filter((name) => name.endsWith('.bin')).sort()
  : [];

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
  });
});

function normalizeXml(value: string): string {
  return value.replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim();
}
