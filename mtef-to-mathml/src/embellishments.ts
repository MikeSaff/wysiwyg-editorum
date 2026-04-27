export type EmbellishmentKind = "prime" | "accent"

export interface EmbellishmentDescriptor {
  code: number
  kind: EmbellishmentKind
  mathml: string
  mathmlMarkup?: string
  latex: string
}

const EMBELLISHMENT_TABLE: Record<number, EmbellishmentDescriptor> = {
  2: { code: 2, kind: "accent", mathml: "\u02D9", latex: "\\dot" },
  3: { code: 3, kind: "accent", mathml: "\u00A8", latex: "\\ddot" },
  4: { code: 4, kind: "accent", mathml: "\u20DB", latex: "\\dddot" },
  5: { code: 5, kind: "prime", mathml: "\u2032", mathmlMarkup: "&#x2032;", latex: "\\prime" },
  6: { code: 6, kind: "prime", mathml: "\u2033", mathmlMarkup: "&#x2033;", latex: "\\prime\\prime" },
  8: { code: 8, kind: "accent", mathml: "~", latex: "\\tilde" },
  9: { code: 9, kind: "accent", mathml: "^", latex: "\\hat" },
  11: { code: 11, kind: "accent", mathml: "\u2192", latex: "\\vec" },
  17: { code: 17, kind: "accent", mathml: "\u00AF", latex: "\\bar" },
  18: { code: 18, kind: "prime", mathml: "\u2034", mathmlMarkup: "&#x2034;", latex: "\\prime\\prime\\prime" },
}

export function getEmbellishmentDescriptor(embellishment: number): EmbellishmentDescriptor | null {
  return EMBELLISHMENT_TABLE[embellishment] || null
}
