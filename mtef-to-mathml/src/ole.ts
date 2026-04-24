import * as CFB from 'cfb';
import type { ParseWarning } from './types.js';
import { hex, toUint8Array } from './util.js';

const CFB_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] as const;

export interface NormalizedInput {
  data: Uint8Array;
  warnings: ParseWarning[];
}

export function normalizeInput(input: ArrayBuffer | Uint8Array): NormalizedInput {
  const bytes = toUint8Array(input);
  const warnings: ParseWarning[] = [];
  const native = isCfb(bytes) ? extractEquationNative(bytes, warnings) : bytes;
  const data = stripOleHeader(native, warnings);
  return { data, warnings };
}

export function isCfb(bytes: Uint8Array): boolean {
  return CFB_MAGIC.every((value, index) => bytes[index] === value);
}

function extractEquationNative(bytes: Uint8Array, warnings: ParseWarning[]): Uint8Array {
  const container = CFB.read(Buffer.from(bytes), { type: 'buffer' });
  const entry = CFB.find(container, 'Equation Native');
  if (!entry?.content) {
    warnings.push({
      type: 'malformed-input',
      message: 'OLE object does not contain Equation Native stream',
      position: 0
    });
    throw new Error('OLE object does not contain Equation Native stream');
  }
  return new Uint8Array(entry.content);
}

function stripOleHeader(bytes: Uint8Array, warnings: ParseWarning[]): Uint8Array {
  if (looksLikeMtef(bytes, 0)) return bytes;
  if (bytes.length < 28) return bytes;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const headerLength = view.getUint16(0, true);
  const version = view.getUint32(2, true);
  const payloadLength = view.getUint32(8, true);
  const offset = headerLength === 28 ? 28 : 0;

  if (offset === 28 && version === 0x00020000 && looksLikeMtef(bytes, offset)) {
    const end = payloadLength > 0 ? Math.min(bytes.length, offset + payloadLength) : bytes.length;
    return bytes.slice(offset, end);
  }

  if (offset === 28 && looksLikeMtef(bytes, offset)) {
    warnings.push({
      type: 'malformed-input',
      message: 'Equation Native header did not match expected version; continuing after 28-byte header',
      hex: hex(version, 8),
      position: 2
    });
    return bytes.slice(offset);
  }

  return bytes;
}

function looksLikeMtef(bytes: Uint8Array, offset: number): boolean {
  const version = bytes[offset];
  return version === 3 || version === 4 || version === 5;
}
