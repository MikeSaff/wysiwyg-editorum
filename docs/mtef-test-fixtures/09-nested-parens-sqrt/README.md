# Fixture 09 — `U(Φ) = (1 − e^Φ) − M(√(M² − 2Φ) − M)` (pseudopotential)

**Source:** Trukhachev.docx, oleObject23.bin (formula 023 in WMF preview).
**Complexity tier:** complex.

**Visual:** Sagdeev-like pseudopotential: U of Phi equals the bracketed expression (1 minus e-to-the-Phi) minus M times bracketed (square-root of M-squared-minus-two-Phi minus M).

## Tests

- Multiple `<mrow>` fenced groups at the SAME level (two outer pairs of parens)
- Superscript with identifier as exponent (`e^Φ` — Greek in the superscript slot)
- Nested sqrt inside parens (not wrapping the whole outer expression)
- Difference of sqrt and identifier inside the second paren group
- Outer minus between two parenthesized subexpressions
- Four separate binary minus operators in the whole formula

## Notes

- CRITICAL: the `e^Φ` pattern — exponential of Phi — must NOT be misread as
  `exp(Φ)` function call. MathType distinguishes them: `e^Φ` is `<msup><mi>e</mi><mi>Φ</mi></msup>`.
- The outer `M(...)` is implicit multiplication, not function call. Both render
  identically in MathML (space handling differs).
- LaTeX `\left(...\right)` for auto-sizing — recommended for the second paren
  group (contains tall sqrt).
