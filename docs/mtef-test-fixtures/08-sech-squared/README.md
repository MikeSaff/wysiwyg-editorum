# Fixture 08 — `Φ(x,t) = Φ_s sech²((X − Mt)/Δ)` (ion-sound soliton profile)

**Source:** Trukhachev.docx, oleObject16.bin (formula 016 in WMF preview).
**Complexity tier:** complex.

**Visual:** Phi of (x comma t) equals Phi-sub-s times sech-squared of the fraction (X minus M t) over Delta.

## Tests

- Function call with multi-argument list (`Φ(x, t)` — comma-separated args)
- Subscripted Greek identifier (`Φ_s`)
- **Named function with superscript on function name itself** (`sech²`) — the 2 sits on `sech`, not on the argument
- Named function not in LaTeX base standard (`sech` — needs `\operatorname{sech}`)
- Fraction as function argument with compound numerator (`X − Mt`)
- Greek capital Delta (U+0394 / `\Delta`) as standalone denominator
- Implicit multiplication between `M` and `t` (no `·`)

## Notes

- `sech` is NOT in LaTeX base `\sin`/`\cos`-family. Use `\operatorname{sech}`.
- MathType emits `sech` as one character sequence in roman (upright) style —
  parser must recognize the multi-char identifier and wrap as `<mi>sech</mi>` not
  `<mi>s</mi><mi>e</mi><mi>c</mi><mi>h</mi>`.
- Power `²` on the function name is `<msup><mi>sech</mi><mn>2</mn></msup>`.
- `Mt` is multiplication `M × t`, NOT the variable "Mt" — MTEF separates them as
  two CHAR records.
