# Fixture 02 — `Φ₀ = 3(M − 1)` (definition of Phi-zero)

**Source:** Trukhachev.docx, oleObject17.bin (formula 017 in WMF preview).
**Complexity tier:** simple.

**Visual:** Phi with 0-subscript, equals sign, integer 3, parenthesized `M − 1`.

## Tests

- Greek uppercase identifier (`Φ` → U+03A6 / `\Phi`)
- Subscript with number (integer `0` under `<msub>`)
- Equals operator
- Integer literal standalone (`3`)
- Parenthesized subexpression (`<mrow>` with `(` `)` operators)
- Minus sign (U+2212, not ASCII hyphen)
- Implicit multiplication (3 adjacent to `(M-1)` — no explicit `·`)

## Notes

- The minus MUST be U+2212 (MATHEMATICAL MINUS), not U+002D (hyphen).
- Parenthesized group uses `<mrow>` wrapper per MathML guidance.
