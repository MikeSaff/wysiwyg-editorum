declare module 'cfb' {
  export interface CfbEntry {
    name?: string;
    type?: number;
    content?: Uint8Array | Buffer;
  }

  export interface CfbContainer {
    FullPaths: string[];
    FileIndex: CfbEntry[];
  }

  export function read(data: Uint8Array | Buffer, options?: { type?: 'buffer' }): CfbContainer;
  export function find(container: CfbContainer, path: string): CfbEntry | null;
}
