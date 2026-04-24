## MTEF parser library v0.1

- Coverage: 96 out of 96
- Top-3 warning categories: none
- Updated: 2026-04-24T14:37:32.873Z

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