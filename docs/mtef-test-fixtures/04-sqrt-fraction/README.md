# Fixture 04 — `C_s = √(T_e / m_i)` (ion acoustic speed)

**Source:** Trukhachev.docx, oleObject7.bin (formula 007 in WMF preview).
**Complexity tier:** medium.

**Visual:** `C_s = √(T_e / m_i)` — square root of a simple fraction with subscripted identifiers in both numerator and denominator.

## Tests

- `<msqrt>` wrapping a fraction (not standalone identifier)
- `<mfrac>` with subscripted numerator and denominator
- Multiple subscripts nested inside sqrt+frac

## Notes

- Output MathML must close `<msqrt>` on the outside of the full `<mfrac>`, not break
  numerator/denominator apart.
- LaTeX form `\sqrt{\frac{…}{…}}` — sqrt wraps the entire fraction.
