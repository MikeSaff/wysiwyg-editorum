export class ByteReader {
  private offset = 0;
  private pendingNibble: number | null = null;

  constructor(private readonly data: Uint8Array) {}

  get position(): number {
    return this.offset;
  }

  get length(): number {
    return this.data.length;
  }

  get remaining(): number {
    return this.data.length - this.offset;
  }

  eof(): boolean {
    return this.offset >= this.data.length;
  }

  seek(position: number): void {
    this.offset = Math.max(0, Math.min(this.data.length, position));
    this.pendingNibble = null;
  }

  skip(count: number): void {
    this.require(count);
    this.offset += count;
    this.pendingNibble = null;
  }

  readUInt8(): number {
    this.require(1);
    this.pendingNibble = null;
    return this.data[this.offset++] ?? 0;
  }

  readInt8(): number {
    const value = this.readUInt8();
    return value > 0x7f ? value - 0x100 : value;
  }

  readUInt16LE(): number {
    this.require(2);
    this.pendingNibble = null;
    const value = (this.data[this.offset] ?? 0) | ((this.data[this.offset + 1] ?? 0) << 8);
    this.offset += 2;
    return value;
  }

  readStringZ(): string {
    const start = this.offset;
    while (!this.eof() && this.data[this.offset] !== 0) this.offset += 1;
    const bytes = this.data.slice(start, this.offset);
    if (!this.eof()) this.offset += 1;
    this.pendingNibble = null;
    return new TextDecoder('latin1').decode(bytes);
  }

  readMtUint(): number {
    const first = this.readUInt8();
    if (first < 0xff) return first;
    const low = this.readUInt8();
    const high = this.readUInt8();
    return low | (high << 8);
  }

  readNibble(): number {
    if (this.pendingNibble !== null) {
      const value = this.pendingNibble;
      this.pendingNibble = null;
      return value;
    }
    this.require(1);
    const byte = this.data[this.offset++] ?? 0;
    this.pendingNibble = byte & 0x0f;
    return (byte >> 4) & 0x0f;
  }

  alignByte(): void {
    this.pendingNibble = null;
  }

  private require(count: number): void {
    if (this.offset + count > this.data.length) {
      throw new Error(`Unexpected end of MTEF stream at offset ${this.offset}`);
    }
  }
}
