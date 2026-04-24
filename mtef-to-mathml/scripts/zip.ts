import { inflateRawSync } from 'node:zlib';

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

export function readZipEntries(buffer: Uint8Array, predicate: (name: string) => boolean): ZipEntry[] {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const eocdOffset = findEndOfCentralDirectory(view);
  const entryCount = view.getUint16(eocdOffset + 10, true);
  const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);
  const entries: ZipEntry[] = [];
  let offset = centralDirectoryOffset;

  for (let i = 0; i < entryCount; i += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error(`Invalid ZIP central directory header at ${offset}`);
    }
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const name = new TextDecoder().decode(buffer.slice(offset + 46, offset + 46 + nameLength));

    if (predicate(name)) {
      entries.push({
        name,
        data: extractLocalFile(buffer, view, localHeaderOffset, method, compressedSize, uncompressedSize)
      });
    }

    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

function findEndOfCentralDirectory(view: DataView): number {
  const min = Math.max(0, view.byteLength - 0xffff - 22);
  for (let offset = view.byteLength - 22; offset >= min; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) return offset;
  }
  throw new Error('Could not find ZIP end of central directory');
}

function extractLocalFile(
  buffer: Uint8Array,
  view: DataView,
  offset: number,
  method: number,
  compressedSize: number,
  uncompressedSize: number
): Uint8Array {
  if (view.getUint32(offset, true) !== 0x04034b50) {
    throw new Error(`Invalid ZIP local file header at ${offset}`);
  }
  const nameLength = view.getUint16(offset + 26, true);
  const extraLength = view.getUint16(offset + 28, true);
  const dataOffset = offset + 30 + nameLength + extraLength;
  const compressed = buffer.slice(dataOffset, dataOffset + compressedSize);
  if (method === 0) return compressed;
  if (method === 8) {
    const inflated = inflateRawSync(compressed);
    if (inflated.length !== uncompressedSize) {
      throw new Error(`ZIP inflate size mismatch: got ${inflated.length}, expected ${uncompressedSize}`);
    }
    return inflated;
  }
  throw new Error(`Unsupported ZIP compression method ${method}`);
}
