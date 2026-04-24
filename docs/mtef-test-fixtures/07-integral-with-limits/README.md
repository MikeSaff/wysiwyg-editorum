# Fixture 07 — `J_i = ∫₀^{v₀} f_u(v_i) dv_i` (cumulative flux integral)

**Source:** Trukhachev.docx, oleObject78.bin (formula 078 in WMF preview).
**Complexity tier:** medium.

**Visual:** Definite integral of a function with subscripted name. Lower limit is 0, upper limit is v with subscript 0. Integrand is f_u of v_i. Differential is dv_i.

## Tests

- Integral symbol `∫` (U+222B) as `<mo>`
- **`<msubsup>`** — integral simultaneously has lower AND upper limit
- Upper limit is itself a subscripted identifier (`v_0`) — nested subscript
- Function call with subscript (`f_u(v_i)`)
- Differential `d` followed by subscripted variable (`dv_i`)

## Notes

- MathType stores integrals as TMPL records with slots for lower-limit, upper-limit,
  integrand, and optional differential.
- The `d` in `dv_i` is a literal letter 'd', typically upright. Parser MAY emit
  `<mi>d</mi>` or the more formal `<mo>d</mo>` with lspace=0 — either is acceptable
  as long as the next token `v_i` follows immediately.
- LaTeX thin-space `\,` before `dv_i` is conventional.
