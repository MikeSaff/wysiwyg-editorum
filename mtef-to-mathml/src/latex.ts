import { decodeMtCode } from './encoding-table.js';
import type { MathNode, ParseWarning, TemplateNode } from './types.js';

export function renderLatex(root: MathNode, warnings: ParseWarning[]): string {
  const raw = renderNode(root, warnings).replace(/\s+/g, ' ').trim();
  return fixLatexSpacing(raw);
}

/**
 * Insert a space after `\\command` when the next character would glue (invalid TeX).
 * Uses longest \\word at each position so we never split `\frac` into `\fr` + `ac`.
 */
export function fixLatexSpacing(s: string): string {
  let out = '';
  let i = 0;
  while (i < s.length) {
    if (s[i] === '\\') {
      const m = s.slice(i).match(/^\\([a-zA-Z]+)/);
      if (m?.[1]) {
        const cmd = m[1];
        const len = 1 + cmd.length;
        const next = s[i + len];
        out += m[0];
        if (next !== undefined && /[A-Za-z0-9]/.test(next) && !/[{( _^\\\n]/.test(next)) {
          out += ' ';
        }
        i += len;
        continue;
      }
    }
    out += s[i];
    i += 1;
  }
  return out;
}

export function validateLatex(latex: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const s = latex.trim();
  if (!s) return { valid: true, errors: [] };

  if (/_\{\}\s*_\{\}/.test(s) || /\^{}\s*\^{}/.test(s)) {
    errors.push('empty subscript/superscript pair');
  }
  if (/_\{\}(?:\s*_\{\})+/.test(s)) errors.push('repeated empty subscripts');
  if (/\^{}(?:\s*\^{})+/.test(s)) errors.push('repeated empty superscripts');

  let depth = 0;
  for (const c of s) {
    if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth < 0) {
        errors.push('unbalanced closing brace');
        break;
      }
    }
  }
  if (depth !== 0) errors.push('unbalanced braces');

  const lefts = (s.match(/\\left(?![a-z])/g) || []).length;
  const rights = (s.match(/\\right(?![a-z])/g) || []).length;
  if (lefts !== rights) errors.push('\\left / \\right count mismatch');

  let i = 0;
  while (i < s.length) {
    if (s[i] === '\\') {
      const m = s.slice(i).match(/^\\([a-zA-Z]+)/);
      if (m?.[1]) {
        const cmd = m[1];
        i += 1 + cmd.length;
        const next = s[i];
        if (
          next !== undefined &&
          /[A-Za-z0-9]/.test(next) &&
          !/[{( _^\\\n]/.test(next)
        ) {
          if (!errors.includes('missing delimiter after \\command')) {
            errors.push('missing delimiter after \\command');
          }
        }
        continue;
      }
    }
    i += 1;
  }

  return { valid: errors.length === 0, errors };
}

function unwrapSingletonRow(node: MathNode): MathNode {
  if (node.kind === 'row' && node.children.length === 1) {
    const only = node.children[0];
    if (only) return only;
  }
  return node;
}

/** Wrap subscript argument in `{}` when it is not a single Latin letter. */
function wrapSubSeg(inner: string): string {
  if (!inner) return '';
  if (/^\{[^{}]*\}$/.test(inner)) return inner;
  if (/^[a-zA-Z]$/.test(inner)) return inner;
  return `{${inner}}`;
}

function emitLatexSubSup(base: string, sub: string, sup: string): string {
  const hs = sub.length > 0;
  const hu = sup.length > 0;
  if (!hs && !hu) return base;
  let out = base;
  if (hs) out += `_${wrapSubSeg(sub)}`;
  if (hu) out += `^{${sup}}`;
  return out;
}

function emitLatexUnderOver(
  command: string,
  sub: string,
  sup: string,
  rest: string
): string {
  const hs = sub.length > 0;
  const hu = sup.length > 0;
  if (!hs && !hu) {
    return `${command} ${rest}`.replace(/\s+/g, ' ').trim();
  }
  if (!hs && hu) {
    return `${command}^{${sup}} ${rest}`.replace(/\s+/g, ' ').trim();
  }
  if (hs && !hu) {
    return `${command}_${wrapSubSeg(sub)} ${rest}`.replace(/\s+/g, ' ').trim();
  }
  return `${command}_${wrapSubSeg(sub)}^{${sup}} ${rest}`.replace(/\s+/g, ' ').trim();
}

function renderNode(node: MathNode, warnings: ParseWarning[]): string {
  switch (node.kind) {
    case 'document':
    case 'row':
      return node.children.map((child) => renderNode(child, warnings)).join('');
    case 'pile':
      return node.children.map((child) => renderNode(child, warnings)).join(' \\\\ ');
    case 'text':
      if (node.unknown) return '?';
      if (node.mtCode !== undefined) return decodeMtCode(node.mtCode)?.latex ?? escapeLatexText(node.value);
      return escapeLatexText(node.value);
    case 'template':
      return renderTemplate(node, warnings);
    case 'matrix':
      return `\\begin{matrix}${renderMatrix(node, warnings)}\\end{matrix}`;
    case 'embellished': {
      const ch = unwrapSingletonRow(node.child);
      const prime =
        node.embellishment === 5
          ? '\\prime'
          : node.embellishment === 6
            ? '\\prime\\prime'
            : node.embellishment === 18
              ? '\\prime\\prime\\prime'
              : '';
      if (!prime) return renderNode(ch, warnings);
      if (ch.kind === 'template' && ch.selector === 27) {
        const b = slot(ch.children[0], warnings);
        const sub = slot(ch.children[1], warnings);
        return emitLatexSubSup(b, sub, prime);
      }
      if (ch.kind === 'template' && ch.selector === 28) {
        const b = slot(ch.children[0], warnings);
        const sup = slot(ch.children[1], warnings);
        const merged = `{${b}^{${prime}}}`;
        if (!sup) return merged;
        return `${merged}^{${sup}}`;
      }
      return `${renderNode(ch, warnings)}^{${prime}}`;
    }
    case 'unknown':
      return node.value ?? '?';
    default:
      return '?';
  }
}

function renderTemplate(node: TemplateNode, warnings: ParseWarning[]): string {
  const slots = node.children;
  switch (node.selector) {
    case 0:
      return `\\left\\langle ${slot(slots[0], warnings)} \\right\\rangle`;
    case 1:
      return `\\left(${slot(slots[0], warnings)}\\right)`;
    case 2:
      return `\\left\\{${slot(slots[0], warnings)}\\right\\}`;
    case 3:
      return `\\left[${slot(slots[0], warnings)}\\right]`;
    case 4:
      return `\\left|${slot(slots[0], warnings)}\\right|`;
    case 10:
      return node.variation === 1
        ? `\\sqrt[${slot(slots[0], warnings)}]{${slot(slots[1], warnings)}}`
        : `\\sqrt{${slot(slots[0], warnings)}}`;
    case 11:
      return `\\frac{${slot(slots[0], warnings)}}{${slot(slots[1], warnings)}}`;
    case 12:
      return `\\underline{${slot(slots[0], warnings)}}`;
    case 13:
      return `\\overline{${slot(slots[0], warnings)}}`;
    case 15:
      return bigOperator('\\int', node, warnings);
    case 16:
      return bigOperator('\\sum', node, warnings);
    case 17:
      return bigOperator('\\prod', node, warnings);
    case 19:
      return bigOperator('\\bigcup', node, warnings);
    case 20:
      return bigOperator('\\bigcap', node, warnings);
    case 21:
      return bigOperator('\\int', node, warnings);
    case 22:
      return bigOperator('\\sum', node, warnings);
    case 23:
      return emitLatexSubSup('\\lim', slot(slots[0], warnings), '');
    case 27:
      return emitLatexSubSup(slot(slots[0], warnings), slot(slots[1], warnings), '');
    case 28:
      return emitLatexSubSup(slot(slots[0], warnings), '', slot(slots[1], warnings));
    case 29:
      return emitLatexSubSup(slot(slots[0], warnings), slot(slots[1], warnings), slot(slots[2], warnings));
    case 31:
      return `\\vec{${slot(slots[0], warnings)}}`;
    case 32:
      return `\\tilde{${slot(slots[0], warnings)}}`;
    case 33:
      return `\\hat{${slot(slots[0], warnings)}}`;
    case 24:
      return node.variation & 0x0001
        ? `\\overbrace{${slot(slots[0], warnings)}}`
        : `\\underbrace{${slot(slots[0], warnings)}}`;
    default:
      warnings.push({
        type: 'latex-best-effort',
        hex: `0x${node.selector.toString(16).toUpperCase().padStart(2, '0')}`,
        position: node.position,
        message: `LaTeX rendered unsupported template ${node.selectorName} by concatenating children`
      });
      return slots.map((child) => renderNode(child, warnings)).join('');
  }
}

function slot(node: MathNode | undefined, warnings: ParseWarning[]): string {
  return node ? renderNode(node, warnings) : '';
}

function bigOperator(command: string, node: TemplateNode, warnings: ParseWarning[]): string {
  const slots = node.children;
  const hasLower = (node.variation & 0x0010) !== 0;
  const hasUpper = (node.variation & 0x0020) !== 0;
  if (hasLower && hasUpper) {
    return emitLatexUnderOver(command, slot(slots[0], warnings), slot(slots[1], warnings), slot(slots[2], warnings));
  }
  if (hasLower) {
    const low = slot(slots[0], warnings);
    const rest = slot(slots[1], warnings);
    if (!low) return `${command} ${rest}`.replace(/\s+/g, ' ').trim();
    return `${command}_${wrapSubSeg(low)} ${rest}`.replace(/\s+/g, ' ').trim();
  }
  if (hasUpper) {
    const up = slot(slots[0], warnings);
    const rest = slot(slots[1], warnings);
    if (!up) return `${command} ${rest}`.replace(/\s+/g, ' ').trim();
    return `${command}^{${up}} ${rest}`.replace(/\s+/g, ' ').trim();
  }
  return `${command} ${slot(slots[0], warnings)}`.replace(/\s+/g, ' ').trim();
}

function renderMatrix(node: Extract<MathNode, { kind: 'matrix' }>, warnings: ParseWarning[]): string {
  const rows: string[] = [];
  for (let row = 0; row < node.rows; row += 1) {
    const cells: string[] = [];
    for (let col = 0; col < node.cols; col += 1) {
      cells.push(slot(node.cells[row * node.cols + col], warnings));
    }
    rows.push(cells.join(' & '));
  }
  return rows.join(' \\\\ ');
}

function escapeLatexText(value: string): string {
  if (value === '{') return '\\{';
  if (value === '}') return '\\}';
  if (value === '\\') return '\\backslash';
  return value;
}
