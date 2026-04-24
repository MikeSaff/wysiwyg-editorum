# Fixture 05 — `∂²Φ/∂X² = N_s − N_i` (Poisson equation)

**Source:** Trukhachev.docx, oleObject6.bin (formula 006 in WMF preview).
**Complexity tier:** medium.

**Visual:** second partial derivative of Phi with respect to X equals the difference of two subscripted N identifiers.

## Tests

- Partial derivative symbol `∂` (U+2202, NOT letter `d`)
- Superscript `2` on both `∂` (numerator) and `X` (denominator)
- Fraction with multi-element mrows in numerator and denominator
- Two subscripted identifiers separated by minus

## Notes

- `∂²Φ` is rendered as `<msup><mo>∂</mo><mn>2</mn></msup><mi>Φ</mi>` — the 2 is on the ∂,
  not on the Phi. Important MathType → MathML mapping distinction.
- Similarly `∂X²` has the 2 on X, not on ∂.
- LaTeX: `\partial^2` and `X^2` handle this naturally via the `{}` grouping.
