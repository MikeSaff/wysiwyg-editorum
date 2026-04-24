import type { MathNode } from './types.js';

export function toUint8Array(input: ArrayBuffer | Uint8Array): Uint8Array {
  if (input instanceof Uint8Array) return input;
  return new Uint8Array(input);
}

export function hex(value: number, width = 2): string {
  return `0x${value.toString(16).toUpperCase().padStart(width, '0')}`;
}

export function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function isRowLike(node: MathNode): boolean {
  return node.kind === 'row' || node.kind === 'pile';
}

export function flattenRow(node: MathNode): MathNode[] {
  if (node.kind === 'row' || node.kind === 'pile') return node.children;
  return [node];
}

export function isOperator(value: string): boolean {
  return /^[+\-=<>()\[\]{}|,.;:/*±×·÷∫∑∏∪∩∀∃∈∉⊂⊆⇒⇔→←≤≥≠≈∞]$/.test(value);
}

export function isNumber(value: string): boolean {
  return /^[0-9.,]+$/.test(value);
}

export function isIdentifier(value: string): boolean {
  return /^[A-Za-zΑ-ωϑϕϰϱϖ]$/.test(value);
}

export function isNamedFunction(value: string): boolean {
  return /^(sin|cos|tan|log|ln|lim|max|min|sup|inf)$/i.test(value);
}
