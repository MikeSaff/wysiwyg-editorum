import { getEmbellishmentDescriptor } from './embellishments.js';
import type { MathNode, ParseWarning, TemplateNode, TextNode } from './types.js';
import { escapeXml, flattenRow, isIdentifier, isNamedFunction, isNumber, isOperator } from './util.js';

/** Longest first so `sinh` wins over `sin`. */
const MULTI_CHAR_FUNCS = [
  'arcsin',
  'arccos',
  'arctan',
  'sinh',
  'cosh',
  'tanh',
  'sech',
  'csch',
  'coth',
  'sin',
  'cos',
  'tan',
  'cot',
  'sec',
  'csc',
  'log',
  'ln',
  'exp',
  'lim',
  'inf',
  'sup',
  'min',
  'max',
  'det',
  'dim',
  'arg'
];

/** True if rendered script/accent slot has semantic math (not empty mrow / whitespace-only). */
export function scriptHtmlMeaningful(html: string): boolean {
  const t = html.replace(/\s+/g, ' ').trim();
  if (!t) return false;
  if (/^<mrow\s*\/>\s*$/i.test(t)) return false;
  if (/^<mrow>\s*<\/mrow>\s*$/i.test(t)) return false;
  if (/^<mspace\b[^>]*\/>\s*$/i.test(t)) return false;
  if (/^<mrow>\s*<mspace\b[^>]*\/>\s*<\/mrow>\s*$/i.test(t)) return false;
  return /<(mi|mn|mo|mtext|mfrac|msqrt|mroot|msub|msup|msubsup|mtable)\b/i.test(t);
}

function emitSubSup(base: string, sub: string, sup: string): string {
  const hs = scriptHtmlMeaningful(sub);
  const hu = scriptHtmlMeaningful(sup);
  if (!hs && !hu) return base;
  if (!hs && hu) return `<msup>${base}${sup}</msup>`;
  if (hs && !hu) return `<msub>${base}${sub}</msub>`;
  return `<msubsup>${base}${sub}${sup}</msubsup>`;
}

function emitUnderOver(base: string, under: string, over: string, closeSuffix: string): string {
  const hu = scriptHtmlMeaningful(under);
  const ho = scriptHtmlMeaningful(over);
  if (!hu && !ho) return `<mrow>${base}${closeSuffix}</mrow>`;
  if (!hu && ho) return `<mover>${base}${over}</mover>${closeSuffix}`;
  if (hu && !ho) return `<munder>${base}${under}</munder>${closeSuffix}`;
  return `<munderover>${base}${under}${over}</munderover>${closeSuffix}`;
}

/** MTEF often wraps a template in a single-child row; unwrap for embellishment composition. */
function unwrapSingletonRow(node: MathNode): MathNode {
  if (node.kind === 'row' && node.children.length === 1) return node.children[0];
  return node;
}

function collapseFunctionNamesInRow(children: MathNode[]): MathNode[] {
  const out: MathNode[] = [];
  let i = 0;
  while (i < children.length) {
    const c = children[i];
    if (c.kind !== 'text') {
      out.push(c);
      i += 1;
      continue;
    }
    let j = i;
    let buf = '';
    while (j < children.length && children[j].kind === 'text') {
      const ch = (children[j] as TextNode).value;
      if (ch.length !== 1 || !/[a-zA-Z]/.test(ch)) break;
      buf += ch;
      j += 1;
    }
    if (buf.length >= 2) {
      const low = buf.toLowerCase();
      let merged: string | null = null;
      for (const name of MULTI_CHAR_FUNCS) {
        if (low === name) {
          merged = buf;
          break;
        }
      }
      if (merged != null) {
        out.push({ kind: 'text', position: (c as TextNode).position, value: merged });
        i = j;
        continue;
      }
    }
    out.push(c);
    i += 1;
  }
  return out;
}

export function renderMathML(root: MathNode, warnings: ParseWarning[]): string {
  const body = renderNode(root, warnings);
  return `<math xmlns="http://www.w3.org/1998/Math/MathML">${body}</math>`;
}

function renderNode(node: MathNode, warnings: ParseWarning[]): string {
  switch (node.kind) {
    case 'document':
    case 'row':
    case 'pile':
      return `<mrow>${collapseFunctionNamesInRow(node.children)
        .map((child) => renderNode(child, warnings))
        .join('')}</mrow>`;
    case 'text':
      return renderText(node.value, node.unknown);
    case 'template':
      return renderTemplate(node, warnings);
    case 'matrix':
      return `<mtable>${renderMatrixRows(node.cells, node.rows, node.cols, warnings)}</mtable>`;
    case 'embellished': {
      const descriptor = getEmbellishmentDescriptor(node.embellishment);
      const ch = unwrapSingletonRow(node.child);
      if (!descriptor) {
        warnings.push({
          type: 'embell-decoration-unknown',
          position: node.position,
          decoration_hex: `0x${node.embellishment.toString(16).toUpperCase().padStart(2, '0')}`,
          message: 'Unknown EMBELL decoration; emitted visible fallback accent'
        });
        return `<mover>${renderNode(ch, warnings)}<mtext>?</mtext></mover>`;
      }
      const mo = `<mo>${descriptor.mathmlMarkup || escapeXml(descriptor.mathml)}</mo>`;
      if (descriptor.kind === 'prime' && ch.kind === 'template' && ch.selector === 27) {
        const base = slot(ch.children[0], warnings);
        const sub = slot(ch.children[1], warnings);
        if (!scriptHtmlMeaningful(sub)) {
          return `<msup>${base}${mo}</msup>`;
        }
        return `<msubsup>${base}${sub}${mo}</msubsup>`;
      }
      if (descriptor.kind === 'prime' && ch.kind === 'template' && ch.selector === 28) {
        const base = slot(ch.children[0], warnings);
        const sup = slot(ch.children[1], warnings);
        const inner = `<mrow>${base}${mo}</mrow>`;
        if (!scriptHtmlMeaningful(sup)) {
          return inner;
        }
        return `<msup>${inner}${sup}</msup>`;
      }
      if (descriptor.kind === 'prime') {
        return `<msup>${renderNode(ch, warnings)}${mo}</msup>`;
      }
      return `<mover accent="true">${renderNode(ch, warnings)}${mo}</mover>`;
    }
    case 'unknown':
      return node.value ? renderText(node.value) : '<mtext>?</mtext>';
    default:
      return '<mtext>?</mtext>';
  }
}

function renderText(value: string, unknown = false): string {
  if (unknown) return '<mtext>?</mtext>';
  if (value === "'" || value === '\u2019') return '<mo>&#x2032;</mo>';
  if (value === '\u2032') return '<mo>&#x2032;</mo>';
  if (value === '\u2033') return '<mo>&#x2033;</mo>';
  if (value === '\u2034') return '<mo>&#x2034;</mo>';
  const escaped = escapeXml(value);
  if (value.trim() === '') return '<mspace width="0.25em"/>';
  if (isNamedFunction(value)) return `<mi>${escaped}</mi>`;
  if (isNumber(value)) return `<mn>${escaped}</mn>`;
  if (isIdentifier(value)) return `<mi>${escaped}</mi>`;
  if (isOperator(value)) return `<mo>${escaped}</mo>`;
  return `<mtext>${escaped}</mtext>`;
}

function renderTemplate(node: TemplateNode, warnings: ParseWarning[]): string {
  const slots = node.children;
  switch (node.selector) {
    case 0:
      return fenced(slots[0], '〈', '〉', warnings);
    case 1:
      return fenced(slots[0], '(', ')', warnings);
    case 2:
      return fenced(slots[0], '{', '}', warnings);
    case 3:
      return fenced(slots[0], '[', ']', warnings);
    case 4:
      return fenced(slots[0], '|', '|', warnings);
    case 5:
      return fenced(slots[0], '‖', '‖', warnings);
    case 10:
      return node.variation === 1
        ? `<mroot>${slot(slots[1], warnings)}${slot(slots[0], warnings)}</mroot>`
        : `<msqrt>${slot(slots[0], warnings)}</msqrt>`;
    case 11:
      return `<mfrac>${slot(slots[0], warnings)}${slot(slots[1], warnings)}</mfrac>`;
    case 26:
      return `<mfrac>${slot(slots[0], warnings)}${slot(slots[1], warnings)}</mfrac>`;
    case 12: {
      const b = slot(slots[0], warnings);
      if (!scriptHtmlMeaningful(b)) return '<mo>_</mo>';
      return `<munder>${b}<mo>_</mo></munder>`;
    }
    case 13: {
      const b = slot(slots[0], warnings);
      if (!scriptHtmlMeaningful(b)) return '<mo>¯</mo>';
      return `<mover>${b}<mo>¯</mo></mover>`;
    }
    case 15:
      return bigOperator('∫', node, warnings);
    case 16:
      return bigOperator('∑', node, warnings);
    case 17:
      return bigOperator('∏', node, warnings);
    case 19:
      return bigOperator('∪', node, warnings);
    case 20:
      return bigOperator('∩', node, warnings);
    case 21:
      return bigOperator('∫', node, warnings);
    case 22:
      return bigOperator('∑', node, warnings);
    case 23: {
      const limArg = slot(slots[0], warnings);
      if (!scriptHtmlMeaningful(limArg)) return '<mi>lim</mi>';
      return `<munder><mi>lim</mi>${limArg}</munder>`;
    }
    case 27:
      return emitSubSup(slot(slots[0], warnings), slot(slots[1], warnings), '');
    case 28:
      return emitSubSup(slot(slots[0], warnings), '', slot(slots[1], warnings));
    case 29:
      return emitSubSup(slot(slots[0], warnings), slot(slots[1], warnings), slot(slots[2], warnings));
    case 31: {
      const b = slot(slots[0], warnings);
      if (!scriptHtmlMeaningful(b)) return '<mo>→</mo>';
      return `<mover>${b}<mo>→</mo></mover>`;
    }
    case 32: {
      const b = slot(slots[0], warnings);
      if (!scriptHtmlMeaningful(b)) return '<mo>~</mo>';
      return `<mover>${b}<mo>~</mo></mover>`;
    }
    case 33: {
      const b = slot(slots[0], warnings);
      if (!scriptHtmlMeaningful(b)) return '<mo>^</mo>';
      return `<mover>${b}<mo>^</mo></mover>`;
    }
    case 24:
      if (node.variation & 0x0001) {
        const b = slot(slots[0], warnings);
        if (!scriptHtmlMeaningful(b)) return '<mo>⏞</mo>';
        return `<mover>${b}<mo>⏞</mo></mover>`;
      }
      {
        const b = slot(slots[0], warnings);
        if (!scriptHtmlMeaningful(b)) return '<mo>⏟</mo>';
        return `<munder>${b}<mo>⏟</mo></munder>`;
      }
    default:
      warnings.push({
        type: 'unknown-template',
        hex: `0x${node.selector.toString(16).toUpperCase().padStart(2, '0')}`,
        position: node.position,
        message: `Rendered unsupported template ${node.selectorName} as grouped children`
      });
      return `<mrow>${slots.map((child) => renderNode(child, warnings)).join('')}</mrow>`;
  }
}

function slot(node: MathNode | undefined, warnings: ParseWarning[]): string {
  return node ? renderNode(node, warnings) : '<mrow/>';
}

function fenced(node: MathNode | undefined, open: string, close: string, warnings: ParseWarning[]): string {
  return `<mrow><mo>${escapeXml(open)}</mo>${slot(node, warnings)}<mo>${escapeXml(close)}</mo></mrow>`;
}

function bigOperator(symbol: string, node: TemplateNode, warnings: ParseWarning[]): string {
  const slots = node.children;
  const hasLower = (node.variation & 0x0010) !== 0;
  const hasUpper = (node.variation & 0x0020) !== 0;
  const op = `<mo>${symbol}</mo>`;
  if (hasLower && hasUpper) {
    const low = slot(slots[0], warnings);
    const up = slot(slots[1], warnings);
    const rest = slot(slots[2], warnings);
    return emitUnderOver(op, low, up, rest);
  }
  if (hasLower) {
    const low = slot(slots[0], warnings);
    const rest = slot(slots[1], warnings);
    if (!scriptHtmlMeaningful(low)) return `<mrow>${op}${rest}</mrow>`;
    return `<munder>${op}${low}</munder>${rest}`;
  }
  if (hasUpper) {
    const up = slot(slots[0], warnings);
    const rest = slot(slots[1], warnings);
    if (!scriptHtmlMeaningful(up)) return `<mrow>${op}${rest}</mrow>`;
    return `<mover>${op}${up}</mover>${rest}`;
  }
  return `<mrow>${op}${slot(slots[0], warnings)}</mrow>`;
}

function renderMatrixRows(cells: MathNode[], rows: number, cols: number, warnings: ParseWarning[]): string {
  const out: string[] = [];
  for (let row = 0; row < rows; row += 1) {
    const rowCells: string[] = [];
    for (let col = 0; col < cols; col += 1) {
      rowCells.push(`<mtd>${slot(cells[row * cols + col], warnings)}</mtd>`);
    }
    out.push(`<mtr>${rowCells.join('')}</mtr>`);
  }
  return out.join('');
}
