import { decodeMtCode } from './encoding-table.js';
import type { MathNode, ParseWarning, TemplateNode } from './types.js';

export function renderLatex(root: MathNode, warnings: ParseWarning[]): string {
  return renderNode(root, warnings).replace(/\s+/g, ' ').trim();
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
    case 'embellished':
      return renderNode(node.child, warnings);
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
      return `\\lim_{${slot(slots[0], warnings)}}`;
    case 27:
      return `${slot(slots[0], warnings)}_{${slot(slots[1], warnings)}}`;
    case 28:
      return `${slot(slots[0], warnings)}^{${slot(slots[1], warnings)}}`;
    case 29:
      return `${slot(slots[0], warnings)}_{${slot(slots[1], warnings)}}^{${slot(slots[2], warnings)}}`;
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
  if (hasLower && hasUpper) return `${command}_{${slot(slots[0], warnings)}}^{${slot(slots[1], warnings)}} ${slot(slots[2], warnings)}`;
  if (hasLower) return `${command}_{${slot(slots[0], warnings)}} ${slot(slots[1], warnings)}`;
  if (hasUpper) return `${command}^{${slot(slots[0], warnings)}} ${slot(slots[1], warnings)}`;
  return `${command} ${slot(slots[0], warnings)}`;
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
