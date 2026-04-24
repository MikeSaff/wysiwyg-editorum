# Fixture 03 — `N_s = exp(Φ)` (Boltzmann electron density)

**Source:** Trukhachev.docx, oleObject5.bin (formula 005 in WMF preview).
**Complexity tier:** simple.

**Visual:** `N` with `s`-subscript, equals, the function name `exp` (roman, not italic), parenthesized Greek Phi.

## Tests

- Roman-letter subscript (`s` under `<msub>`)
- Named function rendered as `<mi>exp</mi>` (NOT `<mi>e</mi><mi>x</mi><mi>p</mi>`)
- Function argument in `<mrow>` with parentheses
- Greek uppercase Phi as argument

## Notes

- In MathType/OMML named functions often come with explicit upright font styling.
  Parser must recognize `exp`, `log`, `ln`, `sin`, `cos`, `tan`, `lim`, `max`, `min`
  as semantic units, not letter sequences.
- Distinguish `exp(Φ)` (named function) from `e × x × p × Φ` (multiplication).
