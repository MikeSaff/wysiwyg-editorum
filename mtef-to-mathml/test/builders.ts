export function mtef(records: number[]): Uint8Array {
  return Uint8Array.from([
    5,
    1,
    0,
    7,
    0,
    0x54,
    0x45,
    0x53,
    0x54,
    0,
    0,
    ...records,
    0
  ]);
}

type Bytes = number | number[];

function flatten(parts: Bytes[]): number[] {
  return parts.flatMap((part) => (Array.isArray(part) ? part : [part]));
}

export function line(children: Bytes[] = []): number[] {
  return [1, 0, ...flatten(children), 0];
}

export function char(code: number, options = 0): number[] {
  return [2, options, 0, code & 0xff, (code >> 8) & 0xff];
}

export function char8(code: number): number[] {
  return [2, 0x24, 0, code & 0xff];
}

export function template(selector: number, variation: number, children: Bytes[] = []): number[] {
  const variationBytes =
    variation > 0x7f ? [(variation & 0x7f) | 0x80, (variation >> 8) & 0xff] : [variation & 0x7f];
  return [3, 0, selector, ...variationBytes, 0, ...flatten(children), 0];
}

/** MTEF record type 6 — embellishment (e.g. 5 = prime) wrapping a single child line/template. */
export function embellish(embellishment: number, child: number[]): number[] {
  return [6, 0, embellishment, ...flatten(child), 0];
}

export function matrix(rows: number, cols: number, cells: number[][]): number[] {
  return [5, 0, 0, 0, 0, rows, cols, 0, 0, ...cells.flat(), 0];
}
