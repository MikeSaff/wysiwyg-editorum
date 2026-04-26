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
    case 'embellished':
      return renderNode(node.child, warnings);
    case 'unknown':
      return node.value ? renderText(node.value) : '<mtext>?</mtext>';
    default:
      return '<mtext>?</mtext>';
  }
}

function renderText(value: string, unknown = false): string {
  if (unknown) return '<mtext>?</mtext>';
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
      // tmLDIV — linear fraction in MathType (often emitted as stacked fraction in output)
      return `<mfrac>${slot(slots[0], warnings)}${slot(slots[1], warnings)}</mfrac>`;
    case 12:
      return `<munder>${slot(slots[0], warnings)}<mo>_</mo></munder>`;
    case 13:
      return `<mover>${slot(slots[0], warnings)}<mo>¯</mo></mover>`;
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
    case 23:
      return `<munder><mi>lim</mi>${slot(slots[0], warnings)}</munder>`;
    case 27:
      return `<msub>${slot(slots[0], warnings)}${slot(slots[1], warnings)}</msub>`;
    case 28:
      return `<msup>${slot(slots[0], warnings)}${slot(slots[1], warnings)}</msup>`;
    case 29:
      return `<msubsup>${slot(slots[0], warnings)}${slot(slots[1], warnings)}${slot(slots[2], warnings)}</msubsup>`;
    case 31:
      return `<mover>${slot(slots[0], warnings)}<mo>→</mo></mover>`;
    case 32:
      return `<mover>${slot(slots[0], warnings)}<mo>~</mo></mover>`;
    case 33:
      return `<mover>${slot(slots[0], warnings)}<mo>^</mo></mover>`;
    case 24:
      return node.variation & 0x0001
        ? `<mover>${slot(slots[0], warnings)}<mo>⏞</mo></mover>`
        : `<munder>${slot(slots[0], warnings)}<mo>⏟</mo></munder>`;
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
    return `<munderover>${op}${slot(slots[0], warnings)}${slot(slots[1], warnings)}</munderover>${slot(slots[2], warnings)}`;
  }
  if (hasLower) return `<munder>${op}${slot(slots[0], warnings)}</munder>${slot(slots[1], warnings)}`;
  if (hasUpper) return `<mover>${op}${slot(slots[0], warnings)}</mover>${slot(slots[1], warnings)}`;
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
