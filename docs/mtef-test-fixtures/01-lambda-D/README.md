# Fixture 01 — `λ_D` (Debye length symbol)

**Source:** Trukhachev.docx, oleObject14.bin (formula 014 in WMF preview).
**Complexity tier:** simple.

**Visual:** Greek lambda with subscript D — a single identifier with one level of subscript.

## Tests

- Single Greek lowercase letter (`λ` → U+03BB / `\lambda`)
- One-letter Roman subscript
- `<msub>` with two identifier children

## Notes

- Baseline MTEF test: minimal valid formula containing only `CHAR` records and a template.
- If this fixture fails, the parser can't handle the simplest case.
