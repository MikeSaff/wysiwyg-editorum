## MTEF parser library v0.1

- Coverage: 96 out of 96
- Top-3 warning categories: none
- Updated: 2026-04-24T14:37:32.873Z

## v0.50.5 — drag overlay scoping, bilingual caption split everywhere, plain-text bracket fix

**CEO QA after v0.50.4 deploy:**

1. Drag-over подсвечивал ВЕСЬ редактор зелёным fullscreen overlay вместо самого placeholder'а.
2. Подпись Сазыкиной перенеслась, но RU+EN склеились в один figcaption («…2023 гг.Fig. 1. …»).
3. Скобка в формуле 3 (Сазыкина) — всё ещё растянута.

**Fixes**

- `prototype/src/main.js` — `dragover` handler теперь skip'ает fullscreen overlay, если drag происходит над `.figure-placeholder`. Подсветка только на самом плейсхолдере (через `setupFigurePlaceholderDnD`).
- `prototype/src/word-import.js` — текст placeholder'а: «🖼 Перетащите изображение сюда или щёлкните правой кнопкой» (убрано упоминание несуществующей панели).
- `prototype/src/word-import.js` — новый exported helper `splitBilingualFigureCaptionHtml(html)`: 3 стратегии (`<br>` separator → `<strong>Fig` boundary → plain non-letter + `Fig.|Figure`+digit). Подключён в strong-path `renderFigureBlockHtml` (раньше билингвал шёл одним figure-caption-ru), и заменил inline split в `promoteFigureAsTableFramesInRoot` / `attachLooseFigureCaptionsToFiguresInRoot` / `promoteLooseFigureCaptionsAroundImagesInRoot` (DRY).
- `prototype/src/word-import.js` `textToMathML` — для plain-text скобок `( ) [ ] { }` теперь эмитится `<mo stretchy="false">`. Word-сценарий Сазыкиной формулы 3: скобки `(λ_{r,exit} + λ_r)` приходят НЕ внутри `<m:d>` (delimiter), а как обычный текст в нескольких `<m:r><m:t>(λ</m:t></m:r>` — без stretchy=false MathJax растягивал их по высоте subscript'а. Реальные fence-скобки из `<m:d>` идут через другую ветку (`fence="true"`) и не затронуты.

**Tests** (`prototype/tests/word-import.test.js`)

- 6 новых cases: 4 на `splitBilingualFigureCaptionHtml` (`<br>` / `<strong>` / plain / null), 2 на bracket stretchy (plain-text `(λ` → stretchy=false; `<m:d>` fence → fence="true" сохранён).
- `npm test` 76/76; `npm run build` OK.

## v0.50.4 — loose figure captions absorbed (Sazykina pattern)

**Problem (CEO 2026-04-25):** «Плейсхолдер рисунка появился, но подпись подрисуночная при импорте исчезла совсем». Reason: in Sazykina-like DOCX the caption is NOT inside the layout table — it lives as a sibling `<p>Рис. N…</p><p>Fig. N…</p>` next to a bare `<p><img></p>`. v0.50.x table→figure promoter only looked inside cells, so captions stayed as loose paragraphs and visually drifted away from the image.

**Implemented (`prototype/src/word-import.js`)**

- New `promoteLooseFigureCaptionsAroundImagesInRoot(root, doc)` — wraps `<p><img></p>` followed by Рис./Fig. paragraphs into `<figure.figure-block>` with proper `figure-caption-ru` / `figure-caption-en` and `data-number`.
- New `attachLooseFigureCaptionsToFiguresInRoot(root, doc)` — for any existing `figure-block` without `<figcaption>` (e.g. produced by `promoteFigureAsTableFramesInRoot` from a caption-less table) absorbs adjacent Рис./Fig. siblings (forward first, then backward).
- Bilingual single-`<p>` split now has fallback regex (`[\s\S]*? + non-letter + Fig\.?|Figure`) for captions WITHOUT `<strong>` wrapper. Previously failed on `Рис. 1. Описание... Fig. 1. Description...` plain-text mixes.
- Hooked into `normalizeImportedHtml` between `promoteFigureAsTableFramesInRoot` and `promoteLooseTableCaptionsInRoot`.

**Tests** (`prototype/tests/word-import.test.js`)

- 3 new cases: bare `<img>` + adjacent captions; figure-as-table without inner caption (limitation documented); plain-text bilingual single-`<p>` split.
- `npm test` 69/69; `npm run build` OK.

**Non-goals**

- Image upload UX (covered by v0.51); no folder-import auto-PNG match yet; no JATS export changes.

## v0.51 — figure-placeholder image insertion UX

**Implemented**

- **Drag and drop** (`main.js` `handleDrop` + `figure-placeholder.js`): dropping an image file on `.figure-placeholder` calls `setNodeMarkup` on the `figure_image` atom (placeholder → `src` data URL, `placeholder: false`). `dragover` on the editor highlights the target (`.drag-target`); `dragend` clears it.
- **Context menu** (`context-menu.js`): right-click on placeholder shows «Загрузить файл...» (hidden file input + `readAsDataURL`) and «Указать URL...» (`prompt` + `https` / `data:image/` via `isAllowedImageUrl`). Uses document **position** for async file read so the transaction stays valid.
- **Styles** (`styles.css`): placeholder `cursor` / `:hover`, `.drag-target` green highlight.
- **Tests** (`tests/figure-placeholder.test.js`): `isAllowedImageUrl` smoke checks.

**Non-goals**

- No server upload, crop, or co-located PNG autodetect on import (future folder-import API).

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