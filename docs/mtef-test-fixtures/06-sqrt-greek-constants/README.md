# Fixture 06 — `λ_D = √(T_e / (4π e² n₀))` (Debye length expression)

**Source:** Trukhachev.docx, oleObject15.bin (formula 015 in WMF preview).
**Complexity tier:** medium.

**Visual:** Debye length as square root of a fraction; denominator contains a numeric constant (4), Greek π, letter e squared, and n with subscript 0.

## Tests

- Subscripted identifier on LHS (`λ_D`)
- Sqrt wrapping a fraction (same pattern as fixture 04, but more complex)
- Denominator with 4 multiplied entities: integer × Greek × letter² × subscripted letter
- Implicit multiplication (no `·` operator between them)
- Both subscripts (`T_e`, `n_0`) AND a superscript (`e^2`) in the same formula
- Greek pi (U+03C0 / `\pi`)

## Notes

- Distinguish `e²` (constant `e` squared, charge of electron squared in physics)
  from `exp` function. Here it's the constant.
- Numerator `T_e` has subscript; denominator factors stand in an `<mrow>` with no
  explicit operator between them.
- LaTeX thin-space `\,` between factors is optional.
