import { describe, expect, it } from 'vitest';
import { parseMathTypeSync } from '../src/index.js';
import { char, char8, embellish, line, matrix, mtef, template } from './builders.js';

describe('parseMathTypeSync', () => {
  it('parses a simple variable', () => {
    const result = parseMathTypeSync(mtef(line(char(0x0078))));
    expect(result.mathml).toContain('<mi>x</mi>');
    expect(result.latex).toBe('x');
  });

  it('parses a number', () => {
    const result = parseMathTypeSync(mtef(line(char(0x0031))));
    expect(result.mathml).toContain('<mn>1</mn>');
    expect(result.latex).toBe('1');
  });

  it('parses an operator', () => {
    const result = parseMathTypeSync(mtef(line([...char(0x0078), ...char(0x002b), ...char(0x0079)])));
    expect(result.mathml).toContain('<mo>+</mo>');
    expect(result.latex).toBe('x+y');
  });

  it('parses unknown char fallback', () => {
    const result = parseMathTypeSync(mtef(line(char(0xe123))));
    expect(result.mathml).toContain('<mtext>?</mtext>');
    expect(result.warnings.some((warning) => warning.type === 'unknown-char')).toBe(true);
  });

  it('parses char without MTCode using 8-bit font position', () => {
    const result = parseMathTypeSync(mtef(line(char8(0x41))));
    expect(result.latex).toBe('A');
  });

  it('skips future records with warnings', () => {
    const result = parseMathTypeSync(mtef([100, 2, 0xaa, 0xbb, ...line(char(0x0078))]));
    expect(result.latex).toBe('x');
    expect(result.warnings.some((warning) => warning.type === 'unknown-record')).toBe(true);
  });

  it('parses a fraction template', () => {
    const result = parseMathTypeSync(mtef(line(template(11, 0, [line(char(0x0061)), line(char(0x0062))]))));
    expect(result.mathml).toContain('<mfrac>');
    expect(result.latex).toBe('\\frac{a}{b}');
  });

  it('parses superscript', () => {
    const result = parseMathTypeSync(mtef(line(template(28, 0, [line(char(0x0078)), line(char(0x0032))]))));
    expect(result.mathml).toContain('<msup>');
    expect(result.latex).toBe('x^{2}');
  });

  it('parses subscript', () => {
    const result = parseMathTypeSync(mtef(line(template(27, 0, [line(char(0x0078)), line(char(0x0069))]))));
    expect(result.mathml).toContain('<msub>');
    expect(result.latex).toBe('x_{i}');
  });

  it('parses prime embellishment on subscript (υ′ᵢ)', () => {
    const result = parseMathTypeSync(
      mtef(line(embellish(5, line(template(27, 0, [line(char(0x03c5)), line(char(0x0069))])))))
    );
    expect(result.mathml).toContain('<msubsup>');
    expect(result.mathml).toContain('&#x2032;');
    expect(result.mathml).toContain('υ');
    expect(result.latex).toMatch(/\\prime/);
    expect(result.latex).toContain('i');
  });

  it('parses combined script', () => {
    const result = parseMathTypeSync(mtef(line(template(29, 0, [line(char(0x0078)), line(char(0x0069)), line(char(0x0032))]))));
    expect(result.mathml).toContain('<msubsup>');
    expect(result.latex).toBe('x_{i}^{2}');
  });

  it('parses square root', () => {
    const result = parseMathTypeSync(mtef(line(template(10, 0, [line(char(0x0078))]))));
    expect(result.mathml).toContain('<msqrt>');
    expect(result.latex).toBe('\\sqrt{x}');
  });

  it('parses nth root', () => {
    const result = parseMathTypeSync(mtef(line(template(10, 1, [line(char(0x0033)), line(char(0x0078))]))));
    expect(result.mathml).toContain('<mroot>');
    expect(result.latex).toBe('\\sqrt[3]{x}');
  });

  it('parses a matrix', () => {
    const result = parseMathTypeSync(
      mtef(line(matrix(2, 2, [line(char(0x0061)), line(char(0x0062)), line(char(0x0063)), line(char(0x0064))])))
    );
    expect(result.mathml).toContain('<mtable>');
    expect(result.latex).toBe('\\begin{matrix}a & b \\\\ c & d\\end{matrix}');
  });
});

describe('character and template coverage', () => {
  const chars = [
    [0x03b1, '\\alpha'],
    [0x03b2, '\\beta'],
    [0x03b3, '\\gamma'],
    [0x03b4, '\\delta'],
    [0x03c0, '\\pi'],
    [0x03c3, '\\sigma'],
    [0x03c9, '\\omega'],
    [0x0394, '\\Delta'],
    [0x0393, '\\Gamma'],
    [0x221e, '\\infty'],
    [0x00b1, '\\pm'],
    [0x00d7, '\\times'],
    [0x22c5, '\\cdot'],
    [0x2264, '\\le'],
    [0x2265, '\\ge'],
    [0x2260, '\\ne'],
    [0x2248, '\\approx'],
    [0x2208, '\\in'],
    [0x2209, '\\notin'],
    [0x2282, '\\subset'],
    [0x2286, '\\subseteq'],
    [0x21d2, '\\Rightarrow'],
    [0x21d4, '\\Leftrightarrow'],
    [0x2192, '\\to']
  ] as const;

  it.each(chars)('maps MTCode %s', (code, latex) => {
    const result = parseMathTypeSync(mtef(line(char(code))));
    expect(result.latex).toBe(latex);
  });

  const fences = [
    [0, '\\left\\langle x \\right\\rangle'],
    [1, '\\left(x\\right)'],
    [2, '\\left\\{x\\right\\}'],
    [3, '\\left[x\\right]'],
    [4, '\\left|x\\right|']
  ] as const;

  it.each(fences)('renders fence template %s', (selector, latex) => {
    const result = parseMathTypeSync(mtef(line(template(selector, 0x0003, [line(char(0x0078))]))));
    expect(result.latex).toBe(latex);
  });

  const bigOps = [
    [15, '\\int_{0}^{1} x'],
    [16, '\\sum_{0}^{1} x'],
    [17, '\\prod_{0}^{1} x'],
    [19, '\\bigcup_{0}^{1} x'],
    [20, '\\bigcap_{0}^{1} x']
  ] as const;

  it.each(bigOps)('renders big operator %s with limits', (selector, latex) => {
    const result = parseMathTypeSync(
      mtef(line(template(selector, 0x0030, [line(char(0x0030)), line(char(0x0031)), line(char(0x0078))])))
    );
    expect(result.latex).toBe(latex);
  });

  const accents = [
    [13, '\\overline{x}'],
    [31, '\\vec{x}'],
    [32, '\\tilde{x}'],
    [33, '\\hat{x}'],
    [24, '\\overbrace{x}']
  ] as const;

  it.each(accents)('renders accent/template %s', (selector, latex) => {
    const variation = selector === 24 ? 1 : 0;
    const result = parseMathTypeSync(mtef(line(template(selector, variation, [line(char(0x0078))]))));
    expect(result.latex).toBe(latex);
  });
});
