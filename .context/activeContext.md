## MTEF parser library v0.1

- Coverage: 96 out of 96
- Top-3 warning categories: none
- Updated: 2026-04-24T14:37:32.873Z

## v0.50 — figure/caption detection, bracket scope fix, math size bump

**Implemented**

- **Figure-as-table frame** (`prototype/src/word-import.js` + `normalizeImportedHtml`): small tables (≤4 cells) whose text matches `Рис.` / `Fig.` numbering are promoted to `figure` with `data-schema-v2`, `figure-block`, optional `img`, else `figure-placeholder`; RU/EN `figcaption` classes `figure-caption-ru` / `figure-caption-en`.
- **Bilingual table captions**: consecutive `Таблица N` / `Table N` paragraphs before a bare `<table>` are folded into `div.table-wrap` with `table-caption-ru` / `table-caption-en`; same idea for figure frames where captions precede the layout table.
- **OMML `m:d` bracket scope**: when Word emits one fenced `m:e` plus trailing siblings (or multiple `m:e`), MathML fences wrap only the intended `m:e` content so stretchy parens do not span following terms (Sazykina formula 3). Regression tests in `tests/word-import.test.js`.
- **Schema** (`schema.js`): `figure_block` / `table_block` with bilingual caption nodes; `figure_image.placeholder`.
- **UI**: `styles.css` — `.figure-placeholder` warning strip; math `mjx-container` inline **1.15em**, block **1.4em**.
- **Export** (`export-html.js`): `figure_block` / `table_block` emit the same caption classes and placeholder div as the editor.
- **Navigation** (`main.js`): TOC entries for `figure_block` and `table_block` use RU caption when present.

**Tests**

- `npm test`, `npm run build` after changes.

**Non-goals (this release)**

- Placeholder upload button; MTEF path unchanged; no STIX2 self-host beyond existing CDN preset.

## v0.49 — metadata extractor + envelope + MathJax STIX2 + bracket fix

**Implemented**

- **DocumentJSON envelope** (`prototype/src/document-model.js`): `pm`, `meta`, `references`, `version: "0.1"`. `deserializeEnvelope` wraps legacy autosave that was bare PM JSON (`type: "doc"` root).
- **Metadata extraction** (`prototype/src/metadata-extract.js`): `extractMetadataFromImportedHtml` returns `{ meta, references, cleanedBody }` after normalized DOCX HTML. Front-matter heuristics (title, spaced initials in author lines, affiliations, email, abstract, keywords), back sections via `data-section-type` / `detectSectionType`, references section stripped from body. `mergeExtractedPublication` merges into envelope on import. `console.info` logs missing fields.
- **Section types** (`prototype/src/section-heading.js`): shared `detectSectionType` / heading normalization for import + extractor (avoids circular imports).
- **UI** (`prototype/src/metadata-panel.js`, `styles.css`): collapsible panel above editor; editable fields and reference list (raw + DOI); changes flow to envelope + autosave.
- **Autosave** (`prototype/src/main.js`, toolbar hooks): full envelope in `localStorage`; dev JSON output shows envelope when `version` is present.
- **MathJax**: `math-config.js` presets, `math-jax-boot.js` sets `globalThis.MathJax` with STIX2 CHTML fonts; `index.html` loads boot module then deferred `tex-mml-chtml.js`. `export-html` aligned with same font config.
- **OMML delimiter** (`word-import.js`): `<m:d>` maps to fence with content from direct `<m:e>` children only; `stretchy="false"` on `(` / `)` to fix overstretched closing parenthesis (e.g. Sazykina formula 3). Regression in `tests/word-import.test.js`.

**Tests**

- `tests/document-model.test.js`, `tests/metadata-extract.test.js`, OMML delimiter test, existing word-import suite; `npm test` and `npm run build` green.

**Known issues**

- Metadata heuristics remain document-style dependent; edge cases may miss or mis-classify blocks (logged via `[metadata]`). Keywords regex uses character classes that treat colon/spaces narrowly in some locales.
- JATS export, CrossRef/ORCID/ROR enrichment, and `envelope.rights` are out of scope for v0.49.
- Manual QA on full Сазыкина / Трухачёв / Nauka Radbio / Физика плазмы DOCX set is recommended after each import-path change.

## v0.49.1 — math typeset hotfix

**Cause**

- `startup: { typeset: false }` in `math-jax-boot.js` prevented MathJax from running its normal startup typeset path; per-node `typesetPromise([host])` did not reliably render all `.math-render-host` nodes (many display formulas stayed empty while labels remained).
- `chtml.fontURL` pointed at `mathjax@4/es5/output/chtml/fonts/stix2` (and NewCM analogue) on jsDelivr; those directories are not populated on the npm CDN, so the runtime fell back to loading NewCM assets (`mjx-ncm-*.woff2`) despite `font: stix2` in config.

**Fix**

- Removed `startup: { typeset: false }` so default startup behavior applies; kept explicit `await startup.promise` before each guarded `typesetPromise([host])` in `renderMathLive`, plus a **serialized typeset chain** so concurrent `queueMicrotask` calls from many `math_block` nodes do not overlap.
- `math-config.js`: `fontURL` for `stix2` and `newcm` now targets `@mathjax/mathjax-stix2-font@4/chtml/woff2` and `@mathjax/mathjax-newcm-font@4/chtml/woff2` (verified HTTP 200 for sample woff2 files).

**Tests**

- `tests/math-render.test.js`: fontURL shape assertions; smoke test with mocked MathJax v4 that two `math-block` hosts each receive `typesetPromise` and end with `mjx-container` in DOM.

**Residual**

- If a future build again disables global startup typeset, re-verify that every `math_block` / `math_inline` creation path still calls `renderMathLive` (or a single `typesetPromise` over `#editor`).