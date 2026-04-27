export interface EncodingEntry {
  unicode: string;
  latex?: string;
  source: string;
}

// Sources:
// - ASCII rows: Unicode Basic Latin.
// - Common math rows: Unicode mathematical operators and Greek blocks.
// - MTEF/MTCode behavior cross-checked against Design Science MTEF v5 reference
//   and corpus-driven warnings from MathType Equation Native streams.
/** Exported for LaTeX command-name resolution (`fixLatexSpacing`, `validateLatex`). */
export const MT_CODE_TO_UNICODE: Record<number, EncodingEntry> = {
  0x0020: { unicode: ' ', source: 'Unicode Basic Latin' },
  0x0028: { unicode: '(', latex: '(', source: 'Unicode Basic Latin' },
  0x0029: { unicode: ')', latex: ')', source: 'Unicode Basic Latin' },
  0x002b: { unicode: '+', latex: '+', source: 'Unicode Basic Latin' },
  0x002c: { unicode: ',', latex: ',', source: 'Unicode Basic Latin' },
  0x002d: { unicode: '-', latex: '-', source: 'Unicode Basic Latin' },
  0x002e: { unicode: '.', latex: '.', source: 'Unicode Basic Latin' },
  0x002f: { unicode: '/', latex: '/', source: 'Unicode Basic Latin' },
  0x003a: { unicode: ':', latex: ':', source: 'Unicode Basic Latin' },
  0x003b: { unicode: ';', latex: ';', source: 'Unicode Basic Latin' },
  0x003c: { unicode: '<', latex: '<', source: 'Unicode Basic Latin' },
  0x003d: { unicode: '=', latex: '=', source: 'Unicode Basic Latin' },
  0x003e: { unicode: '>', latex: '>', source: 'Unicode Basic Latin' },
  0x005b: { unicode: '[', latex: '[', source: 'Unicode Basic Latin' },
  0x005c: { unicode: '\\', latex: '\\backslash', source: 'Unicode Basic Latin' },
  0x005d: { unicode: ']', latex: ']', source: 'Unicode Basic Latin' },
  0x007b: { unicode: '{', latex: '\\{', source: 'Unicode Basic Latin' },
  0x007c: { unicode: '|', latex: '|', source: 'Unicode Basic Latin' },
  0x007d: { unicode: '}', latex: '\\}', source: 'Unicode Basic Latin' },
  0x00b1: { unicode: '±', latex: '\\pm', source: 'Unicode Mathematical Operators' },
  0x00a0: { unicode: ' ', latex: ' ', source: 'Unicode Latin-1 Supplement' },
  0x00d7: { unicode: '×', latex: '\\times', source: 'Unicode Latin-1 Supplement' },
  0x00f7: { unicode: '÷', latex: '\\div', source: 'Unicode Latin-1 Supplement' },
  0x0391: { unicode: 'Α', latex: 'A', source: 'Unicode Greek and Coptic' },
  0x0392: { unicode: 'Β', latex: 'B', source: 'Unicode Greek and Coptic' },
  0x0393: { unicode: 'Γ', latex: '\\Gamma', source: 'Unicode Greek and Coptic' },
  0x0394: { unicode: 'Δ', latex: '\\Delta', source: 'Unicode Greek and Coptic' },
  0x0395: { unicode: 'Ε', latex: 'E', source: 'Unicode Greek and Coptic' },
  0x0396: { unicode: 'Ζ', latex: 'Z', source: 'Unicode Greek and Coptic' },
  0x0397: { unicode: 'Η', latex: 'H', source: 'Unicode Greek and Coptic' },
  0x0398: { unicode: 'Θ', latex: '\\Theta', source: 'Unicode Greek and Coptic' },
  0x0399: { unicode: 'Ι', latex: 'I', source: 'Unicode Greek and Coptic' },
  0x039a: { unicode: 'Κ', latex: 'K', source: 'Unicode Greek and Coptic' },
  0x039b: { unicode: 'Λ', latex: '\\Lambda', source: 'Unicode Greek and Coptic' },
  0x039c: { unicode: 'Μ', latex: 'M', source: 'Unicode Greek and Coptic' },
  0x039d: { unicode: 'Ν', latex: 'N', source: 'Unicode Greek and Coptic' },
  0x039e: { unicode: 'Ξ', latex: '\\Xi', source: 'Unicode Greek and Coptic' },
  0x039f: { unicode: 'Ο', latex: 'O', source: 'Unicode Greek and Coptic' },
  0x03a0: { unicode: 'Π', latex: '\\Pi', source: 'Unicode Greek and Coptic' },
  0x03a1: { unicode: 'Ρ', latex: 'P', source: 'Unicode Greek and Coptic' },
  0x03a3: { unicode: 'Σ', latex: '\\Sigma', source: 'Unicode Greek and Coptic' },
  0x03a4: { unicode: 'Τ', latex: 'T', source: 'Unicode Greek and Coptic' },
  0x03a5: { unicode: 'Υ', latex: '\\Upsilon', source: 'Unicode Greek and Coptic' },
  0x03a6: { unicode: 'Φ', latex: '\\Phi', source: 'Unicode Greek and Coptic' },
  0x03a7: { unicode: 'Χ', latex: 'X', source: 'Unicode Greek and Coptic' },
  0x03a8: { unicode: 'Ψ', latex: '\\Psi', source: 'Unicode Greek and Coptic' },
  0x03a9: { unicode: 'Ω', latex: '\\Omega', source: 'Unicode Greek and Coptic' },
  0x03b1: { unicode: 'α', latex: '\\alpha', source: 'Unicode Greek and Coptic' },
  0x03b2: { unicode: 'β', latex: '\\beta', source: 'Unicode Greek and Coptic' },
  0x03b3: { unicode: 'γ', latex: '\\gamma', source: 'Unicode Greek and Coptic' },
  0x03b4: { unicode: 'δ', latex: '\\delta', source: 'Unicode Greek and Coptic' },
  0x03b5: { unicode: 'ε', latex: '\\epsilon', source: 'Unicode Greek and Coptic' },
  0x03b6: { unicode: 'ζ', latex: '\\zeta', source: 'Unicode Greek and Coptic' },
  0x03b7: { unicode: 'η', latex: '\\eta', source: 'Unicode Greek and Coptic' },
  0x03b8: { unicode: 'θ', latex: '\\theta', source: 'Unicode Greek and Coptic' },
  0x03b9: { unicode: 'ι', latex: '\\iota', source: 'Unicode Greek and Coptic' },
  0x03ba: { unicode: 'κ', latex: '\\kappa', source: 'Unicode Greek and Coptic' },
  0x03bb: { unicode: 'λ', latex: '\\lambda', source: 'Unicode Greek and Coptic' },
  0x03bc: { unicode: 'μ', latex: '\\mu', source: 'Unicode Greek and Coptic' },
  0x03bd: { unicode: 'ν', latex: '\\nu', source: 'Unicode Greek and Coptic' },
  0x03be: { unicode: 'ξ', latex: '\\xi', source: 'Unicode Greek and Coptic' },
  0x03bf: { unicode: 'ο', latex: 'o', source: 'Unicode Greek and Coptic' },
  0x03c0: { unicode: 'π', latex: '\\pi', source: 'Unicode Greek and Coptic' },
  0x03c1: { unicode: 'ρ', latex: '\\rho', source: 'Unicode Greek and Coptic' },
  0x03c2: { unicode: 'ς', latex: '\\varsigma', source: 'Unicode Greek and Coptic' },
  0x03c3: { unicode: 'σ', latex: '\\sigma', source: 'Unicode Greek and Coptic' },
  0x03c4: { unicode: 'τ', latex: '\\tau', source: 'Unicode Greek and Coptic' },
  0x03c5: { unicode: 'υ', latex: '\\upsilon', source: 'Unicode Greek and Coptic' },
  0x03c6: { unicode: 'φ', latex: '\\phi', source: 'Unicode Greek and Coptic' },
  0x03c7: { unicode: 'χ', latex: '\\chi', source: 'Unicode Greek and Coptic' },
  0x03c8: { unicode: 'ψ', latex: '\\psi', source: 'Unicode Greek and Coptic' },
  0x03c9: { unicode: 'ω', latex: '\\omega', source: 'Unicode Greek and Coptic' },
  0x03d1: { unicode: 'ϑ', latex: '\\vartheta', source: 'Unicode Greek and Coptic' },
  0x03d5: { unicode: 'ϕ', latex: '\\varphi', source: 'Unicode Greek and Coptic' },
  0x03f0: { unicode: 'ϰ', latex: '\\varkappa', source: 'Unicode Greek and Coptic' },
  0x03f1: { unicode: 'ϱ', latex: '\\varrho', source: 'Unicode Greek and Coptic' },
  0x03d6: { unicode: 'ϖ', latex: '\\varpi', source: 'Unicode Greek and Coptic' },
  0x2026: { unicode: '…', latex: '\\ldots', source: 'Unicode General Punctuation' },
  0x2032: { unicode: '′', latex: "'", source: 'Unicode General Punctuation' },
  0x2033: { unicode: '″', latex: "''", source: 'Unicode General Punctuation' },
  0x2190: { unicode: '←', latex: '\\leftarrow', source: 'Unicode Arrows' },
  0x2192: { unicode: '→', latex: '\\to', source: 'Unicode Arrows' },
  0x21d2: { unicode: '⇒', latex: '\\Rightarrow', source: 'Unicode Arrows' },
  0x21d4: { unicode: '⇔', latex: '\\Leftrightarrow', source: 'Unicode Arrows' },
  0x2200: { unicode: '∀', latex: '\\forall', source: 'Unicode Mathematical Operators' },
  0x2203: { unicode: '∃', latex: '\\exists', source: 'Unicode Mathematical Operators' },
  0x2208: { unicode: '∈', latex: '\\in', source: 'Unicode Mathematical Operators' },
  0x2209: { unicode: '∉', latex: '\\notin', source: 'Unicode Mathematical Operators' },
  0x2202: { unicode: '∂', latex: '\\partial', source: 'Unicode Mathematical Operators; added from Trukhachev corpus warnings' },
  0x2212: { unicode: '−', latex: '-', source: 'Unicode Mathematical Operators' },
  0x2219: { unicode: '∙', latex: '\\bullet', source: 'Unicode Mathematical Operators' },
  0x221a: { unicode: '√', latex: '\\sqrt{}', source: 'Unicode Mathematical Operators' },
  0x221e: { unicode: '∞', latex: '\\infty', source: 'Unicode Mathematical Operators' },
  0x2229: { unicode: '∩', latex: '\\cap', source: 'Unicode Mathematical Operators' },
  0x222a: { unicode: '∪', latex: '\\cup', source: 'Unicode Mathematical Operators' },
  0x222b: { unicode: '∫', latex: '\\int', source: 'Unicode Mathematical Operators' },
  0x2248: { unicode: '≈', latex: '\\approx', source: 'Unicode Mathematical Operators' },
  0x2260: { unicode: '≠', latex: '\\ne', source: 'Unicode Mathematical Operators' },
  0x2264: { unicode: '≤', latex: '\\le', source: 'Unicode Mathematical Operators' },
  0x2265: { unicode: '≥', latex: '\\ge', source: 'Unicode Mathematical Operators' },
  0x226b: { unicode: '≫', latex: '\\gg', source: 'Unicode Mathematical Operators; added from Trukhachev corpus warnings' },
  0x2282: { unicode: '⊂', latex: '\\subset', source: 'Unicode Mathematical Operators' },
  0x2286: { unicode: '⊆', latex: '\\subseteq', source: 'Unicode Mathematical Operators' },
  0x22c5: { unicode: '⋅', latex: '\\cdot', source: 'Unicode Mathematical Operators' },
  0x2329: { unicode: '〈', latex: '\\langle', source: 'Unicode Misc Technical' },
  0x232a: { unicode: '〉', latex: '\\rangle', source: 'Unicode Misc Technical' }
};

for (let code = 0x30; code <= 0x39; code += 1) {
  MT_CODE_TO_UNICODE[code] = {
    unicode: String.fromCharCode(code),
    latex: String.fromCharCode(code),
    source: 'Unicode Basic Latin'
  };
}

for (let code = 0x41; code <= 0x5a; code += 1) {
  MT_CODE_TO_UNICODE[code] = {
    unicode: String.fromCharCode(code),
    latex: String.fromCharCode(code),
    source: 'Unicode Basic Latin'
  };
}

for (let code = 0x61; code <= 0x7a; code += 1) {
  MT_CODE_TO_UNICODE[code] = {
    unicode: String.fromCharCode(code),
    latex: String.fromCharCode(code),
    source: 'Unicode Basic Latin'
  };
}

export function decodeMtCode(code: number): EncodingEntry | undefined {
  return MT_CODE_TO_UNICODE[code];
}
