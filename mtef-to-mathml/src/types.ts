export type WarningType =
  | 'unknown-char'
  | 'unknown-record'
  | 'unknown-template'
  | 'unsupported-record'
  | 'malformed-input'
  | 'latex-best-effort'
  | 'embell-orphan'
  | 'embell-result-trivial'
  | 'embell-decoration-unknown';

export interface ParseWarning {
  type: WarningType;
  message?: string;
  hex?: string;
  position?: number;
  [key: string]: unknown;
}

export interface ParseResult {
  mathml: string;
  latex: string;
  warnings: ParseWarning[];
}

export interface MtefHeader {
  version: number;
  platform?: number;
  product?: number;
  productVersion?: number;
  productSubversion?: number;
  applicationKey?: string;
  equationOptions?: number;
}

export type MathNode =
  | DocumentNode
  | RowNode
  | TextNode
  | TemplateNode
  | PileNode
  | MatrixNode
  | EmbellishedNode
  | UnknownNode;

export interface BaseNode {
  kind: string;
  position: number;
}

export interface DocumentNode extends BaseNode {
  kind: 'document';
  header: MtefHeader;
  children: MathNode[];
}

export interface RowNode extends BaseNode {
  kind: 'row';
  children: MathNode[];
  null?: boolean;
}

export interface TextNode extends BaseNode {
  kind: 'text';
  value: string;
  mtCode?: number;
  typeface?: number;
  functionStart?: boolean;
  unknown?: boolean;
}

export interface TemplateNode extends BaseNode {
  kind: 'template';
  selector: number;
  selectorName: string;
  variation: number;
  templateOptions: number;
  children: MathNode[];
}

export interface PileNode extends BaseNode {
  kind: 'pile';
  children: MathNode[];
}

export interface MatrixNode extends BaseNode {
  kind: 'matrix';
  rows: number;
  cols: number;
  cells: MathNode[];
}

export interface EmbellishedNode extends BaseNode {
  kind: 'embellished';
  embellishment: number;
  child: MathNode;
}

export interface UnknownNode extends BaseNode {
  kind: 'unknown';
  recordType?: number;
  value?: string;
  children?: MathNode[];
}

export interface ParserContext {
  warnings: ParseWarning[];
}
