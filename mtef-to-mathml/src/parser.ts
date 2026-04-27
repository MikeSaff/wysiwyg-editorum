import { ByteReader } from './byte-reader.js';
import { decodeMtCode } from './encoding-table.js';
import type {
  DocumentNode,
  MathNode,
  MatrixNode,
  MtefHeader,
  ParseWarning,
  RowNode,
  TemplateNode,
  TextNode
} from './types.js';
import { hex } from './util.js';

const OPT_NUDGE = 0x08;
const OPT_CHAR_EMBELL = 0x01;
const OPT_CHAR_FUNC_START = 0x02;
const OPT_CHAR_ENC_CHAR_8 = 0x04;
const OPT_CHAR_ENC_CHAR_16 = 0x10;
const OPT_CHAR_ENC_NO_MTCODE = 0x20;
const OPT_LINE_NULL = 0x01;
const OPT_LINE_LSPACE = 0x04;
const OPT_LP_RULER = 0x02;

const SELECTOR_NAMES: Record<number, string> = {
  0: 'tmANGLE',
  1: 'tmPAREN',
  2: 'tmBRACE',
  3: 'tmBRACK',
  4: 'tmBAR',
  5: 'tmDBAR',
  6: 'tmFLOOR',
  7: 'tmCEILING',
  8: 'tmOBRACK',
  9: 'tmINTERVAL',
  10: 'tmROOT',
  11: 'tmFRACT',
  12: 'tmUBAR',
  13: 'tmOBAR',
  14: 'tmARROW',
  15: 'tmINTEG',
  16: 'tmSUM',
  17: 'tmPROD',
  18: 'tmCOPROD',
  19: 'tmUNION',
  20: 'tmINTER',
  21: 'tmINTOP',
  22: 'tmSUMOP',
  23: 'tmLIM',
  24: 'tmHBRACE',
  25: 'tmHBRACK',
  26: 'tmLDIV',
  27: 'tmSUB',
  28: 'tmSUP',
  29: 'tmSUBSUP',
  30: 'tmDIRAC',
  31: 'tmVEC',
  32: 'tmTILDE',
  33: 'tmHAT',
  34: 'tmARC',
  35: 'tmJSTATUS',
  36: 'tmSTRIKE',
  37: 'tmBOX'
};

interface RecordTag {
  type: number;
  options?: number;
  position: number;
}

export function parseMtef(data: Uint8Array, warnings: ParseWarning[] = []): DocumentNode {
  const reader = new ByteReader(data);
  const header = parseHeader(reader);
  const children = parseObjectList(reader, header.version, warnings, true);
  return {
    kind: 'document',
    position: 0,
    header,
    children
  };
}

function parseHeader(reader: ByteReader): MtefHeader {
  const version = reader.readUInt8();
  const header: MtefHeader = { version };

  if (version >= 3 && reader.remaining >= 5) {
    header.platform = reader.readUInt8();
    header.product = reader.readUInt8();
    header.productVersion = reader.readUInt8();
    header.productSubversion = reader.readUInt8();
    header.applicationKey = reader.readStringZ();
    if (!reader.eof()) header.equationOptions = reader.readUInt8();
  }

  return header;
}

function parseObjectList(
  reader: ByteReader,
  version: number,
  warnings: ParseWarning[],
  topLevel = false
): MathNode[] {
  const nodes: MathNode[] = [];
  let guard = 0;

  while (!reader.eof() && guard < 10000) {
    guard += 1;
    const tag = readRecordTag(reader, version);
    if (tag.type === 0) break;

    try {
      if (tag.type === 6) {
        const emb = readEmbellishmentRecord(reader, version, tag, warnings);
        if (emb.child) {
          nodes.push({
            kind: 'embellished',
            position: tag.position,
            embellishment: emb.embellishment,
            child: emb.child
          });
          continue;
        }
        const tag2 = readRecordTag(reader, version);
        if (tag2.type === 0) {
          warnings.push({
            type: 'embell-orphan',
            position: tag.position,
            decoration_hex: hex(emb.embellishment),
            message: 'EMBELL had no inner base and no following record'
          });
          nodes.push(standaloneEmbellFallbackNode(tag.position, emb.embellishment));
          continue;
        }
        const base = parseRecordPayload(reader, version, tag2, warnings);
        if (!base) {
          warnings.push({
            type: 'embell-orphan',
            position: tag.position,
            decoration_hex: hex(emb.embellishment),
            message: 'EMBELL lookahead record produced no node'
          });
          nodes.push(standaloneEmbellFallbackNode(tag.position, emb.embellishment));
          continue;
        }
        nodes.push({
          kind: 'embellished',
          position: tag.position,
          embellishment: emb.embellishment,
          child: base
        });
        continue;
      }
      const node = parseRecordPayload(reader, version, tag, warnings);
      if (node) nodes.push(node);
    } catch (error) {
      warnings.push({
        type: 'malformed-input',
        message: error instanceof Error ? error.message : String(error),
        position: tag.position,
        hex: hex(tag.type)
      });
      if (topLevel) break;
      throw error;
    }
  }

  return nodes;
}

function readRecordTag(reader: ByteReader, version: number): RecordTag {
  const position = reader.position;
  const raw = reader.readUInt8();
  if (version >= 5 || raw === 0) {
    return { type: raw, position };
  }
  return {
    type: raw & 0x0f,
    options: raw & 0xf0,
    position
  };
}

function readOptions(reader: ByteReader, tag: RecordTag, version: number): number {
  if (tag.options !== undefined) return tag.options;
  return version >= 5 ? reader.readUInt8() : 0;
}

function parseRecordPayload(
  reader: ByteReader,
  version: number,
  tag: RecordTag,
  warnings: ParseWarning[]
): MathNode | null {
  if (tag.type >= 100) {
    skipFutureRecord(reader, tag, warnings);
    return null;
  }

  switch (tag.type) {
    case 1:
      return parseLine(reader, version, tag, warnings);
    case 2:
      return parseChar(reader, version, tag, warnings);
    case 3:
      return parseTemplate(reader, version, tag, warnings);
    case 4:
      return parsePile(reader, version, tag, warnings);
    case 5:
      return parseMatrix(reader, version, tag, warnings);
    case 7:
      skipRuler(reader);
      return null;
    case 8:
      reader.readMtUint();
      reader.readUInt8();
      return null;
    case 9:
      skipSize(reader);
      return null;
    case 10:
    case 11:
    case 12:
    case 13:
    case 14:
      return null;
    case 15:
      reader.readMtUint();
      return null;
    case 16:
      skipColorDef(reader);
      return null;
    case 17:
      reader.readMtUint();
      reader.readStringZ();
      return null;
    case 18:
      skipEquationPrefs(reader);
      return null;
    case 19:
      reader.readStringZ();
      return null;
    default:
      warnings.push({
        type: 'unknown-record',
        hex: hex(tag.type),
        position: tag.position,
        message: 'Unknown MTEF record; stopping current object list to avoid desynchronization'
      });
      return null;
  }
}

function parseLine(
  reader: ByteReader,
  version: number,
  tag: RecordTag,
  warnings: ParseWarning[]
): RowNode {
  const options = readOptions(reader, tag, version);
  skipNudgeIfPresent(reader, options);
  if ((options & OPT_LINE_LSPACE) !== 0) reader.readUInt16LE();
  if ((options & OPT_LP_RULER) !== 0) skipRuler(reader);

  const row: RowNode = {
    kind: 'row',
    position: tag.position,
    children: (options & OPT_LINE_NULL) !== 0 ? [] : parseObjectList(reader, version, warnings)
  };
  if ((options & OPT_LINE_NULL) !== 0) row.null = true;
  return row;
}

function parseChar(
  reader: ByteReader,
  version: number,
  tag: RecordTag,
  warnings: ParseWarning[]
): TextNode {
  const options = readOptions(reader, tag, version);
  skipNudgeIfPresent(reader, options);
  const typeface = reader.readInt8() + 128;
  let mtCode: number | undefined;
  let value = '?';
  let unknown = false;

  if ((options & OPT_CHAR_ENC_NO_MTCODE) === 0) {
    mtCode = reader.readUInt16LE();
    const decoded = decodeMtCode(mtCode);
    if (decoded) {
      value = decoded.unicode;
    } else if (mtCode >= 0x20 && mtCode <= 0x7e) {
      value = String.fromCharCode(mtCode);
    } else {
      unknown = true;
      warnings.push({
        type: 'unknown-char',
        hex: hex(mtCode, 4),
        position: tag.position,
        message: 'Unknown MTEF character; emitted ? fallback'
      });
    }
  }

  if ((options & OPT_CHAR_ENC_CHAR_8) !== 0) {
    const fontPosition = reader.readUInt8();
    if (mtCode === undefined && fontPosition >= 0x20 && fontPosition <= 0x7e) {
      value = String.fromCharCode(fontPosition);
    }
  } else if ((options & OPT_CHAR_ENC_CHAR_16) !== 0) {
    const fontPosition = reader.readUInt16LE();
    if (mtCode === undefined && fontPosition >= 0x20 && fontPosition <= 0x7e) {
      value = String.fromCharCode(fontPosition);
    }
  }

  if ((options & OPT_CHAR_EMBELL) !== 0) {
    const embellishments = parseObjectList(reader, version, warnings).flatMap((node) =>
      node.kind === 'unknown' && typeof node.value === 'string' ? [Number(node.value)] : []
    );
    if (embellishments.length > 0) {
      return makeTextNode(
        tag.position,
        applyPrimeEmbellishment(value, embellishments),
        mtCode,
        typeface,
        (options & OPT_CHAR_FUNC_START) !== 0,
        unknown
      );
    }
  }

  return makeTextNode(tag.position, value, mtCode, typeface, (options & OPT_CHAR_FUNC_START) !== 0, unknown);
}

function makeTextNode(
  position: number,
  value: string,
  mtCode: number | undefined,
  typeface: number | undefined,
  functionStart: boolean,
  unknown: boolean
): TextNode {
  const input: {
    kind: 'text';
    position: number;
    value: string;
    mtCode?: number;
    typeface?: number;
    functionStart?: boolean;
    unknown?: boolean;
  } = {
        kind: 'text',
    position,
    value,
  };
  if (mtCode !== undefined) input.mtCode = mtCode;
  if (typeface !== undefined) input.typeface = typeface;
  if (functionStart) input.functionStart = true;
  if (unknown) input.unknown = true;
  return textNode(input);
}

function textNode(input: {
  kind: 'text';
  position: number;
  value: string;
  mtCode?: number;
  typeface?: number;
  functionStart?: boolean;
  unknown?: boolean;
}): TextNode {
  const node: TextNode = {
    kind: 'text',
    position: input.position,
    value: input.value
  };
  if (input.mtCode !== undefined) node.mtCode = input.mtCode;
  if (input.typeface !== undefined) node.typeface = input.typeface;
  if (input.functionStart) node.functionStart = true;
  if (input.unknown) node.unknown = true;
  return node;
}

function parseTemplate(
  reader: ByteReader,
  version: number,
  tag: RecordTag,
  warnings: ParseWarning[]
): TemplateNode {
  const options = readOptions(reader, tag, version);
  skipNudgeIfPresent(reader, options);
  const selector = reader.readUInt8();
  const first = reader.readUInt8();
  const second = (first & 0x80) !== 0 ? reader.readUInt8() : 0;
  const variation = (first & 0x7f) | (second << 8);
  const templateOptions = reader.readUInt8();
  const children = parseObjectList(reader, version, warnings);

  if (!SELECTOR_NAMES[selector]) {
    warnings.push({
      type: 'unknown-template',
      hex: hex(selector),
      position: tag.position,
      message: 'Unknown MTEF template selector'
    });
  }

  return {
    kind: 'template',
    position: tag.position,
    selector,
    selectorName: SELECTOR_NAMES[selector] ?? 'unknown',
    variation,
    templateOptions,
    children
  };
}

function parsePile(
  reader: ByteReader,
  version: number,
  tag: RecordTag,
  warnings: ParseWarning[]
): MathNode {
  const options = readOptions(reader, tag, version);
  skipNudgeIfPresent(reader, options);
  reader.readUInt8();
  reader.readUInt8();
  if ((options & OPT_LP_RULER) !== 0) skipRuler(reader);
  return {
    kind: 'pile',
    position: tag.position,
    children: parseObjectList(reader, version, warnings)
  };
}

function parseMatrix(
  reader: ByteReader,
  version: number,
  tag: RecordTag,
  warnings: ParseWarning[]
): MatrixNode {
  const options = readOptions(reader, tag, version);
  skipNudgeIfPresent(reader, options);
  reader.readUInt8();
  reader.readUInt8();
  reader.readUInt8();
  const rows = reader.readUInt8();
  const cols = reader.readUInt8();
  reader.skip(Math.ceil((rows + 1) / 4));
  reader.skip(Math.ceil((cols + 1) / 4));
  const cells = parseObjectList(reader, version, warnings);
  return {
    kind: 'matrix',
    position: tag.position,
    rows,
    cols,
    cells
  };
}

/** Reads EMBELL (type 6) payload; if inner list has no child, `child` is undefined (caller does lookahead). */
function readEmbellishmentRecord(
  reader: ByteReader,
  version: number,
  tag: RecordTag,
  warnings: ParseWarning[]
): { embellishment: number; child?: MathNode } {
  const options = readOptions(reader, tag, version);
  skipNudgeIfPresent(reader, options);
  const embellishment = reader.readUInt8();
  const children = parseObjectList(reader, version, warnings);
  const first = children[0];
  if (first) return { embellishment, child: first };
  return { embellishment };
}

function standaloneEmbellFallbackNode(position: number, embellishment: number): TextNode {
  if (embellishment === 5) return makeTextNode(position, '\u2032', undefined, undefined, false, false);
  if (embellishment === 6) return makeTextNode(position, '\u2033', undefined, undefined, false, false);
  if (embellishment === 18) return makeTextNode(position, '\u2034', undefined, undefined, false, false);
  return makeTextNode(position, '?', undefined, undefined, false, true);
}

function skipFutureRecord(reader: ByteReader, tag: RecordTag, warnings: ParseWarning[]): void {
  const length = reader.readMtUint();
  const safeLength = Math.min(length, reader.remaining);
  reader.skip(safeLength);
  warnings.push({
    type: 'unknown-record',
    hex: hex(tag.type),
    position: tag.position,
    length,
    message: 'Skipped future MTEF record'
  });
}

function skipNudgeIfPresent(reader: ByteReader, options: number): void {
  if ((options & OPT_NUDGE) === 0) return;
  const dx = reader.readUInt8();
  const dy = reader.readUInt8();
  if (dx === 0x80 && dy === 0x80) {
    reader.readUInt16LE();
    reader.readUInt16LE();
  }
}

function skipRuler(reader: ByteReader): void {
  const count = reader.readUInt8();
  reader.skip(count * 3);
}

function skipSize(reader: ByteReader): void {
  const selector = reader.readUInt8();
  if (selector === 101) {
    reader.readUInt16LE();
  } else if (selector === 100) {
    reader.readUInt8();
    reader.readUInt16LE();
  } else {
    reader.readUInt8();
  }
}

function skipColorDef(reader: ByteReader): void {
  const options = reader.readUInt8();
  const cmyk = (options & 0x01) !== 0;
  reader.skip(cmyk ? 8 : 6);
  if ((options & 0x04) !== 0) reader.readStringZ();
}

function skipEquationPrefs(reader: ByteReader): void {
  reader.readUInt8();
  const sizes = reader.readUInt8();
  for (let i = 0; i < sizes; i += 1) skipDimensionEntry(reader);
  const spaces = reader.readUInt8();
  for (let i = 0; i < spaces; i += 1) skipDimensionEntry(reader);
  const styles = reader.readUInt8();
  for (let i = 0; i < styles; i += 1) {
    const fontDef = reader.readUInt8();
    if (fontDef !== 0) reader.readUInt8();
  }
  reader.alignByte();
}

function skipDimensionEntry(reader: ByteReader): void {
  reader.readNibble();
  while (!reader.eof()) {
    if (reader.readNibble() === 0x0f) break;
  }
}

function applyPrimeEmbellishment(value: string, embellishments: number[]): string {
  let result = value;
  for (const embellishment of embellishments) {
    if (embellishment === 5) result += '′';
    else if (embellishment === 6) result += '″';
    else if (embellishment === 18) result += '‴';
  }
  return result;
}
