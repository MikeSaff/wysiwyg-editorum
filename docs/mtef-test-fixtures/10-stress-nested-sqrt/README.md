# Fixture 10 — f_W(W_i) = √3 / (T √W_i · (e^{√(2W_iM − W)} − √(2W_iM − 1))^{1/2})

**Source:** Trukhachev.docx, oleObject89.bin (formula 089 in WMF preview).
**Complexity tier:** complex (stress test).

**Visual:** The energy distribution function — a dense expression combining a fraction,
multiple nested square roots, an exponential with sqrt exponent, a difference of sqrts,
and a ^{1/2} power applied to a parenthesized expression.

## Tests

This is the corner-case fixture. Everything at once:

- Top-level fraction: numerator = `√3`, denominator = multiplicative chain
- Three distinct `<msqrt>` blocks: one in numerator, one over `W_i`, one over `2W_iM−1`
- Inline exponential with sqrt expression as exponent: `e^{√(2W_iM − W)}`
  — `<msup>` with `<msqrt>` as the superscript content
- Difference of two sqrt terms inside parens: `(e^{…} − √(…))`
- Power `1/2` on the parenthesized subexpression — `<msup>` with `<mrow>1/2</mrow>` exponent
- Repeated subscripted identifier `W_i` appearing 5 times — substructure de-duplication hint
- Implicit multiplication between `T`, `√W_i`, `(...)` — no explicit `×`

## Notes

- This is the **coverage killer** fixture. If parser handles this cleanly, it
  handles the bulk of the corpus.
- The `(...)^{1/2}` pattern is distinct from `√(...)`. Preserve as `msup` with
  `1/2` exponent, NOT silently convert to `msqrt`.
- MathType would normally store the outer `^{1/2}` as a template slot with
  a nested fraction AST — parser must NOT simplify it out.
- LaTeX `\left(...\right)` inside the denominator — sizing around the tall
  sqrt-exp subexpression.
- If parser fails here but passes 01-09, that's a strong signal the deep-nesting
  path has edge cases.
