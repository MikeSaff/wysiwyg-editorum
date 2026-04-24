# MTEF → MathML Golden Fixtures

10 reference formulas for testing the `mtef-to-mathml` library.

All fixtures are sourced from a single real-world DOCX:
**Trukhachev.docx**, `Физика плазмы` journal, issue 1/2025.
Author: Ф.М. Трухачёв et al, theme: "Ion distribution functions perturbed by ion-sound solitons."
Located in the WYSIWYG repo at:
`Docx/Nauka/Сложные журналы/Физика плазмы/1 25/Trukhachev/Trukhachev.docx`

## Purpose

Each fixture is a binary MathType Equation OLE object (`input.bin`) paired with:
- `expected.mathml` — hand-crafted, validated MathML 3.0 reference
- `expected.tex` — hand-crafted LaTeX reference (precise, not best-effort)
- `preview.png` — visual reference (rendered from the WMF preview stored in the DOCX)
- `README.md` — description + tested constructs + parser notes

The `mtef-to-mathml` parser must produce output matching `expected.mathml` (after
whitespace normalization) and `expected.tex` for every fixture.

## Coverage by complexity tier

### Simple (3)
| # | Formula | Primary tests |
|---|---------|---------------|
| 01 | `λ_D` | Greek lowercase, simple subscript |
| 02 | `Φ₀ = 3(M − 1)` | Greek uppercase, numeric subscript, parens, minus, implicit mult |
| 03 | `N_s = exp(Φ)` | Named function (`exp`), upright-letter subscript |

### Medium (4)
| # | Formula | Primary tests |
|---|---------|---------------|
| 04 | `C_s = √(T_e / m_i)` | Sqrt wrapping fraction with subscripts |
| 05 | `∂²Φ/∂X² = N_s − N_i` | Partial-derivative fraction, superscript on `∂` and `X` |
| 06 | `λ_D = √(T_e / (4π e² n₀))` | Sqrt over fraction with Greek π, constant², subscript-0 |
| 07 | `J_i = ∫₀^{v₀} f_u(v_i) dv_i` | Integral with both limits (`<msubsup>`), subscripted function, differential |

### Complex / stress (3)
| # | Formula | Primary tests |
|---|---------|---------------|
| 08 | `Φ(x,t) = Φ_s sech²((X−Mt)/Δ)` | Multi-arg function, `sech` multi-char identifier, squared on function name, fraction as arg |
| 09 | `U(Φ) = (1 − e^Φ) − M(√(M²−2Φ) − M)` | Nested parens, `e^Φ` (not `exp(Φ)`), sqrt inside parens, multiple minus |
| 10 | `f_W(W_i) = √3 / (T √W_i (e^{√(2W_iM−W)} − √(2W_iM−1))^{1/2})` | Fraction, 3 nested sqrt, exp with sqrt exponent, `(...)^{1/2}` pattern, repeated subscripted identifier |

## MUST-coverage constructs (per parser spec)

All of these appear in at least one fixture:

- [x] Variables, numbers, operators (+, −, =)
- [x] Greek letters (λ, π, Φ, Δ)
- [x] Fractions (`<mfrac>`)
- [x] Superscripts and subscripts (`<msup>`, `<msub>`, `<msubsup>`)
- [x] Square roots, including nested (`<msqrt>`)
- [x] Parentheses as fenced groups (`<mrow>` with `<mo>(</mo>` / `<mo>)</mo>`)
- [x] Named functions (`exp`, `sech`)
- [x] Partial derivative symbol (`∂` — U+2202)
- [x] Integral symbol (`∫` — U+222B) with upper and lower limits
- [x] Implicit multiplication (juxtaposition, no explicit operator)
- [x] Minus sign (U+2212, mathematical minus)

## NOT covered in this fixture set

Not present in Trukhachev.docx, covered instead by corpus-runner statistics:
- Matrices / `eqArray` systems
- Summation `∑`, product `∏`
- Embellishments (`\vec`, `\hat`, `\dot`, `\bar`, `\tilde`)
- Ruler / tabulation
- Color, font-size, or font-family definition records

If parser coverage on corpus (Trukhachev 96 formulas) falls below 88/96, we may add a
second round of fixtures from other Физика-плазмы files with matrix-heavy content
(e.g., Gospodchikov, Kartashev).

## Running against fixtures

The `mtef-to-mathml` test suite reads every subdirectory here as a fixture:
- Load `input.bin`
- Invoke `parseMathTypeSync(input)`
- Assert `mathml` matches `expected.mathml` (after whitespace normalization)
- Assert `latex` matches `expected.tex`
- Assert `warnings` is empty (for fixtures 01-10, best-effort is NOT accepted)

Corpus runner (separate) tests against all 96 OLE objects in Trukhachev.docx with
best-effort acceptance and warning accumulation.

## Source of truth for the MathML

MathML content was hand-authored by Claude from the visual reference (WMF preview)
after cross-checking against:
- MathML 3.0 specification (W3C)
- MathType 6 Reference Guide (Design Science, 2004-2010 editions)
- MathJax-produced reference rendering of the same LaTeX

Each fixture's `expected.mathml` was validated with MathJax locally — all 10 render
correctly to visually-equivalent output as the original WMF preview.

## Directory layout

```
mtef-test-fixtures/
├── README.md                 ← this file
├── 01-lambda-D/
│   ├── input.bin             ← OLE MathType object (96 bytes .. ~4KB)
│   ├── expected.mathml       ← hand-crafted MathML 3.0
│   ├── expected.tex          ← hand-crafted LaTeX
│   ├── preview.png           ← visual reference (from WMF)
│   └── README.md             ← description + tests + notes
├── 02-phi0-equation/
├── 03-exp-phi/
├── 04-sqrt-fraction/
├── 05-second-partial/
├── 06-sqrt-greek-constants/
├── 07-integral-with-limits/
├── 08-sech-squared/
├── 09-nested-parens-sqrt/
├── 10-stress-nested-sqrt/
├── _raw/                     ← (gitignored) all 96 bins + 92 WMFs extracted from Trukhachev
├── _preview/                 ← (gitignored) all 92 PNG previews
└── _mont_*.png               ← (gitignored) preview montages for fixture selection
```

## Why Trukhachev

- Real article from the target corpus (Издательство Наука)
- Pure MathType Equation 3.0 — exactly the format the parser must handle (97% of corpus)
- 96 formulas across the full complexity spectrum in one file
- Same article was used during earlier (OMML-only) parser development — Claude knows
  the content visually
