# WYSIWYG Editorum — Progress Tracker

Полный трекер: **версии**, **история сессий**, **активные тикеты**, **backlog**.

---

## Ticket protocol (напоминание)

Каждое изменение → **запись в этом файле** → **`npx vite build`** без ошибок.

Шаблон строки в таблице «Сессия»:

`| # | Кратко что сделано | Кто | Файлы | Статус | Билд |`

В колонке **Билд**: `OK` после успешного `npx vite build`, или `fix` если сначала падал, потом починили.

---

## Версии (релизы прототипа)

| Версия | Дата | Основное |
|--------|------|----------|
| v0.1 | 2026-04-06 | Первый прототип ProseMirror |
| v0.10 | 2026-04-08 | Sticky toolbar, выравнивание |
| v0.17 | 2026-04-08 | Autosave, undo/redo |
| v0.20 | 2026-04-08 | Редактирование формул, сноски, drag-drop fix |
| v0.22 | 2026-04-08 | Нумерация формул (SEQ), TIFF/WMF placeholders |
| v0.25 | 2026-04-09 | Научная типографика, нумерация формул |
| v0.30 | 2026-04-09 | ГОСТ Р 7.0.110-2025 полностью (CSS) |
| v0.32 | 2026-04-09 | Multi-agent: подписи, контекстное меню, OMML |
| v0.34 | 2026-04-09 | Codex: 32 формулы OK |
| v0.38 | 2026-04-09 | Навигация: рисунки/формулы/таблицы, правки lightbox |
| **v0.39** | **2026-04-09** | **Документация контекста: `.context/activeContext.md`, расширенный `progress.md`, Ticket protocol** |
| **v0.40** | **2026-04-09** | **ГОСТ §16: кавычки «»„" и тире —/– (input rules), `typography-rules.js`, тесты** |
| **v0.41** | **2026-04-09** | **Экспорт HTML5 + MathJax: `export-html.js`, `editorum-publication.css`, кнопка 📄 HTML в toolbar** |
| **v0.42** | **2026-04-10** | **Codex: OMML→MathML, MathJax в редакторе, katex убран из deps; `npm test` 12/12 зелёный** |
| **v0.44** | **2026-04-15** | **Composer: приоритет `data-latex` над MathML (`math-render.js`); пост-импорт `createTypographyNormalizationTransaction` — двойные пробелы, пустые `<p>`** |
| **v0.45** | **2026-04-15** | **MathJax v3 `mathjax-full` (npm): lazy `tex-mml-chtml`, `chtml.displayOverflow: 'linebreak'`, приоритет `data-mathml` для рендера, `resolveTexSource` без MathML→TeX; MathLive только модалка; стили `mjx-container`** |
| **v0.45c** | **2026-04-15** | **MathJax v4 с CDN (jsDelivr `mathjax@4/tex-mml-chtml.js`): `displayOverflow: 'linebreak'` (v3 npm не поддерживал); `math-render.js` только `window.MathJax`; убран `mathjax-full`** |
| **v0.46** | **2026-04-16** | **Schema v2: `heading` + id/sectionType, `paragraph` + lang, `math_block` + id; `figure_block`/`figure_image`, `table_block`/`table_caption`; `citation_ref`, `footnote_ref`, mark `lang`; `newNodeId`; legacy JSON OK; тулбар + `export-html`** |
| **v0.47** | **2026-04-15** | **Узлы `formula_image_block` / `formula_image_inline`; тулбар + модал; CSS нумерации; lightbox; Shift+drop; `formula-image-insert.js`; экспорт HTML + TODO JATS; тесты `formula-image.test.js`** |
| **v0.48** | **2026-04-15** | **Weak-path: UPPERCASE + весь абзац bold → `h2` + `detectSectionType`; MathJax `mtextInheritFont` / `merrorInheritFont`; CSS mjx-utext/mtext; новые section types; linkedom devDep; тесты** |
| **v0.45b** | **2026-04-15** | **Codex: без static split и без `{\displaystyle}` в block LaTeX; см. сессию** |
| **v0.44b–h** | **2026-04-15** | **Codex: OMML/импорт — `cdots`, `bmatrix`, пробелы вокруг inline math, прямой шрифт индексов (см. сессию 2026-04-15)** |
| **v0.44d** | **2026-04-15** | **Пробелы перед `,.;:!?)]}»"` — input rule + `normalizeSpaceBeforePunctuation`** |
| **v0.44e** | **2026-04-15** | **Короткое тире → длинное вне диапазонов `5–10` — `normalizeEnDashToEmDash`, input rules** |
| **v0.44f** | **2026-04-15** | **Висячие предлоги (RU + EN): `normalizeHangingPrepositions`, input rules** |
| **v0.44g** | **2026-04-15** | **Поиск/замена: `find-replace.js`, `openFindPanel` / `openReplacePanel`, декорации, стили панели** |
| **v0.44o** | **2026-04-15** | **MathLive: `mathstyle: 'displaystyle' | 'textstyle'` в `convertLatexToMarkup` для block/inline (`math-render.js`)** |
| **v0.44p** | **2026-04-15** | **MathLive: рендер через `<math-div>` / `<math-span>` вместо `convertLatexToMarkup` (настоящий displaystyle для block; `escapeXml`)** |
| **v0.44u** | **2026-04-15** | **Block-формулы: auto-shrink по ширине `.math-block` (`transform: scale`, min 0.7; повторное измерение после 50ms для shadow DOM)** |
| **v0.44u2** | **2026-04-15** | **Auto-shrink: ширина по `container.scrollWidth` (родитель `.math-block`), не `math-div`; сброс transform перед замером; тайминг 50ms + 100ms** |
| **v0.44u3** | **2026-04-15** | **Auto-shrink: `font-size` на `math-div` вместо `transform: scale` — уменьшается реальный `scrollWidth`, без лишнего scrollbar** |
| **v0.44u4** | **2026-04-15** | **Auto-shrink: не сбрасывать `font-size` между повторами; наращивать em от текущего; тайминги 50/200/500ms** |
| **v0.44u5** | **2026-04-15** | **Auto-shrink: замер только при `parentWidth > 0`; `load` + `ResizeObserver` на `.math-block`; тайминги до 1000ms (`math-render.js`)** |
| **v0.44t2** | **2026-04-15** | **ГОСТ §8.2: красная строка после формул/рисунков/таблиц; `text-indent: 0` только после заголовков (`styles.css`)** |
| **v0.44x** | **2026-04-15** | **Floating toolbar: кнопки 📋 Копировать и ✂ Вырезать (`execCommand`), `context-menu.js`** |

*Следующая версия (v0.43+): добавлять строку при значимом релизе или по договорённости команды.*

---

## Сессия 2026-04-26 — v0.51.x MTEF OLE + corpus baseline

| # | Задача | Кто | Файлы | Статус | Билд |
|---|--------|-----|-------|--------|------|
| — | MTEF/MathType OLE в `word-import.js`, `mtef-to-mathml`, тесты (синтетика + Trukhachev optional), Semion 32 без регрессии | Composer | `package.json`, `package-lock.json`, `src/word-import.js`, `tests/word-import.test.js`, `.context/activeContext.md` | ✅ | OK (`npm test` 81 pass + 1 skip, `npm run build`) |
| — | Корпус: baseline/diff скрипты, `tests/corpus-baseline.json`, `scripts/README.md` | Composer | `scripts/corpus-metrics.mjs`, `scripts/corpus-baseline.mjs`, `scripts/corpus-diff.mjs`, `scripts/README.md`, `tests/corpus-baseline.json` | ✅ | `npm run corpus:diff` exit 0 |

## Сессия 2026-04-15 — v0.44 пакет (типографика, поиск, math priority)

| # | Задача | Кто | Файлы | Статус | Билд |
|---|--------|-----|-------|--------|------|
| — | v0.44–v0.44g: math `data-latex` приоритет; типографика d/e/f + нормализатор; find-replace панель + тесты | Composer | `math-render.js`, `typography-rules.js`, `find-replace.js`, `styles.css`, `tests/*.test.js` | ✅ | OK (`npm test`, `npx vite build`) |
| v0.45 | MathJax `mathjax-full`: lazy `tex-mml-chtml`, `displayOverflow: linebreak`, рендер по `data-mathml` / `data-latex`; `resolveTexSource`; CSS `mjx-container`; тесты `math-render` | Composer | `math-render.js`, `styles.css`, `index.html`, `tests/math-render.test.js`, `.context/progress.md` | ✅ | OK (`npm test`, `npx vite build`) |
| v0.45c | MathJax v4 CDN вместо `mathjax-full`; `index.html` + `math-render.js` через `window.MathJax`; тесты mock + проверка `mathjax@4`; `export-html.js` на v4 | Composer | `index.html`, `math-render.js`, `export-html.js`, `package.json`, `tests/*.test.js`, `.context/progress.md` | ✅ | OK (`npm test`, `npx vite build`) |
| v0.46 | Schema v2: новые block/inline узлы и mark `lang`; обёртки `figure_block` / `table_block`; расширенные attrs; `toolbar.js` + `export-html.js`; тесты `schema-v2.test.js` | Composer | `schema.js`, `toolbar.js`, `export-html.js`, `tests/schema-v2.test.js`, `.context/progress.md` | ✅ | OK (`npm test`, `npx vite build`) |
| v0.47 | Узлы `formula_image_block` / `formula_image_inline`: модал тулбара (файл/URL, номер, LaTeX-hint, блок/инлайн), CSS нумерации, lightbox, Shift+drop vs обычный drop → `image`, `formula-image-insert.js`, экспорт HTML + TODO JATS, тесты | Composer | `schema.js`, `toolbar.js`, `main.js`, `styles.css`, `export-html.js`, `formula-image-insert.js`, `tests/formula-image.test.js`, `.context/activeContext.md`, `.context/progress.md` | ✅ | OK (`npm test`, `npx vite build`) |
| v0.48 | Эвристика заголовков weak-path Word; расширенный `detectSectionType`; MathJax font inheritance + CSS; schema section types + legacy `acknowledgements`; linkedom; тесты | Composer | `word-import.js`, `index.html`, `export-html.js`, `styles.css`, `schema.js`, `main.js`, `package.json`, `tests/word-import.test.js`, `tests/math-render.test.js`, `.context/activeContext.md`, `.context/progress.md` | ✅ | OK (`npm test`, `npx vite build`) |

## Сессия 2026-04-09 (продолжение)

| # | Задача | Кто | Файлы | Статус | Билд |
|---|--------|-----|-------|--------|------|
| — | Документация: правила, владение файлами, Ticket protocol | Composer | `.context/activeContext.md`, `.context/progress.md` | ✅ | OK |
| — | COMPOSER-TYPOGRAPHY: кавычки «»„", тире `---`→—, `--`+символ→–; убраны smartQuotes/emDash PM | Composer | `src/typography-rules.js`, `src/main.js`, `tests/typography-rules.test.js` | ✅ | OK |
| — | COMPOSER-EXPORT: HTML5 + MathJax, article/header/main/footer, figcaption/caption, кнопка скачивания | Composer | `src/export-html.js`, `src/editorum-publication.css`, `public/editorum-publication.css`, `src/toolbar.js` | ✅ | OK |
| — | Codex: OMML→MathML pipeline, тесты (в т.ч. Semion 32 формулы), MathJax в `index.html`; повторная проверка **`npm test` — 12/12** | Codex / проверка | `word-import.js`, `index.html`, `package.json`, `tests/` | ✅ | `npm test` OK |
| — | ~~Codex: membership внутри одного math-block~~ **(10.04 откат):** v0.43 fix — снова `auxiliarySegments` + `trailingHtml` для условий (∈, ⊂); основной блок без membership-строк | Composer | `src/word-import.js`, `tests/word-import.test.js` | ✅ | OK |

## Сессия 2026-04-15

| # | Задача | Кто | Файлы | Статус | Билд |
|---|--------|-----|-------|--------|------|
| v0.44b | Inline OMML: убран лишний пробел в `i=1,\\cdots,n`; при `dPr` + `bmatrix` больше нет двойной обёртки `\\left[ ... \\right]` | Codex | `src/word-import.js`, `tests/word-import.test.js`, `.context/progress.md` | ✅ | OK |
| v0.44c | Склейка текста и inline math: добавлены безопасные пробелы до/после `<span class="math-inline">` без лишнего пробела перед `,.;:!?)]}»"` | Codex | `src/word-import.js`, `tests/word-import.test.js`, `.context/progress.md` | ✅ | OK |
| v0.44h | Индексы-аббревиатуры и кириллица рендерятся прямым шрифтом: `\\text{...}` в LaTeX и `<mtext>` в MathML; в `importDocx()` оставлен TODO на `typographyNormalizer(html)` до экспорта Composer v0.44d/e/f | Codex | `src/word-import.js`, `tests/word-import.test.js`, `.context/activeContext.md`, `.context/progress.md` | ✅ | OK |
| v0.44j | Многострочные block-формулы без `cases` теперь оборачиваются в `\\begin{aligned} ... \\end{aligned}`; обновлены synthetic/real DOCX тесты для Semion labels `(2)`, `(4)`, `(25)` | Codex | `src/word-import.js`, `tests/word-import.test.js`, `.context/progress.md` | ✅ | OK |
| v0.44k | Дроби в display-блоках теперь идут как `\\dfrac`, в inline остаются `\\tfrac`; для block MathML добавлен `displaystyle="true"` на `<mfrac>`, тесты покрывают оба контекста | Codex | `src/word-import.js`, `tests/word-import.test.js`, `.context/progress.md` | ✅ | OK |
| v0.44l | Системы с фигурной скобкой больше не используют `\\begin{cases}`: теперь `\\left\\{\\begin{aligned} ... \\end{aligned}\\right.`; MathML-ветка использует `mfenced` + `mtable displaystyle="true"`, тесты обновлены для Semion `(7)` и `(9)` | Codex | `src/word-import.js`, `tests/word-import.test.js`, `.context/progress.md` | ✅ | OK |
| v0.44n | Все block-формулы теперь получают внешний `{\displaystyle ...}`, а строки в `aligned` выравниваются по первому `=` через `&=`; inline-формулы не тронуты, тесты обновлены на displaystyle-wrapper и alignment markers | Codex | `src/word-import.js`, `tests/word-import.test.js`, `.context/progress.md` | ✅ | OK |
| v0.44r | Формула `(2)` из `test_semion_full.docx`: relation-only 4-я строка (`u(t)∈U, w(t)∈W, t∈[t₀,t_f]`) больше не уходит в отдельный `<p>`, а склеивается в тот же `aligned`; добавлены synthetic тесты на 3/4 строки system-table и обновлена проверка реального DOCX | Codex | `src/word-import.js`, `tests/word-import.test.js`, `.context/progress.md` | ✅ | OK |
| v0.44s | Многострочные block-формулы без `\\left\\{` теперь генерируются как left-aligned `\\begin{array}{l} ... \\end{array}` без `&=`; системы с `\\left\\{` сохраняют `aligned + &=`; MathML для non-brace multiline получает `columnalign="left"` | Codex | `src/word-import.js`, `tests/word-import.test.js`, `.context/progress.md` | ✅ | OK |
| v0.44v | Post-import HTML-нормализация в `importDocx()`: удаление пустых `<p>` без текста/math/image и автокоррекция подписей `Рисунок N` / `Рис. N` без точки; используется `normalizeTypographyPlainText` из `typography-rules.js`, добавлены тесты на cleanup и caption-fix | Codex | `src/word-import.js`, `tests/word-import.test.js`, `.context/progress.md` | ✅ | OK |
| v0.44w | Post-import cleanup теперь проходит по текстовым сегментам абзацев вне формул: схлопываются двойные пробелы/табы, убираются пробелы перед пунктуацией, тримятся края `<p>`, инициалы переводятся на NBSP; пустые `<p>` по-прежнему удаляются без затрагивания `math-inline` и `img` | Codex | `src/word-import.js`, `tests/word-import.test.js`, `.context/progress.md` | ✅ | OK |
| v0.44w2 | Добавлен второй проход по text-сегментам абзаца на границах вокруг `math-inline`/`img`: убираются двойные пробелы и пробелы перед пунктуацией, которые раньше оставались между соседними text-node через inline-элементы; добавлен регрессионный тест на стык `text + inline-math + text` | Codex | `src/word-import.js`, `tests/word-import.test.js`, `.context/progress.md` | ✅ | OK |
| v0.44z | Импортёр теперь помечает plain-text нумерованные абзацы вида `1)` / `2.` классом `list-item-numbered`, сохраняя существующие классы `<p>`; добавлен регрессионный тест на добавление класса и совместимость с уже заданным `class` | Codex | `src/word-import.js`, `tests/word-import.test.js`, `.context/progress.md` | ✅ | OK |
| v0.44aa | Длинные однострочные block-формулы теперь автоматически разбиваются по top-level операциям `= + - \\cdot \\times / :` в `\\begin{array}{l} ... \\end{array}` с повтором знака на новой строке; для разбитых формул block MathML перестраивается в `<mtable columnalign="left">`, добавлены unit и integration тесты на long/small/fraction cases | Codex | `src/word-import.js`, `tests/word-import.test.js`, `.context/progress.md` | ✅ | OK |
| v0.45b | Убран static split длинных display-формул и внешняя LaTeX-обёртка `{\displaystyle ...}`: block `data-latex` теперь сохраняет исходный display LaTeX как есть, MathML display-mode остаётся основным сигналом для MathJax; сохранены existing multiline `array/aligned` и гигиенические нормализаторы, тесты обновлены под несбитый long-line и новые ожидания без `{\displaystyle}` | Codex | `src/word-import.js`, `tests/word-import.test.js`, `.context/progress.md` | ✅ | OK |
| v0.46b | DOCX-import подготовлен под schema v2: heading/paragraph/math-block получают auto-UUID `id`, headings получают `data-section-type` по эвристике секций, `img + fig-caption` объединяются в `<figure id><img><figcaption>`, а `table-number/table-caption + table` — в `<div class="table-wrap" id>...`; добавлены synthetic тесты на ids, sectionType, figure-wrap и table-wrap | Codex | `src/word-import.js`, `tests/word-import.test.js`, `.context/progress.md` | ✅ | OK |

### Ранее в этот день (сводка)

| # | Задача | Кто | Файлы | Статус |
|---|--------|-----|-------|--------|
| 1 | ГОСТ Р 7.0.110-2025 — CSS | Claude | styles.css | ✅ |
| 2 | Unicode матсимволы (⊗→\\otimes) | Claude | word-import.js | ✅ |
| 3 | Стили подписей (Рис./Табл.) | Claude | schema.js, toolbar.js, styles.css | ✅ |
| 4 | Контекстное меню + floating toolbar | Composer | context-menu.js, styles.css, main.js | ✅ |
| 5 | OMML конвертер — 32 формулы | Codex | word-import.js, tests/ | ✅ |
| 6 | Пустые строки (ProseMirror separator) | Claude | styles.css | ✅ |
| 7 | Нумерация формул (SEQ field codes) | Claude | word-import.js | ✅ |
| 8 | Lightbox картинок | Claude | main.js, styles.css | ✅ |
| 9 | Resize картинок (drag corner) | Claude | main.js, styles.css | ✅ |
| 10 | Автораспознавание подписей при импорте | Claude | word-import.js | ✅ |
| 11 | Кнопка 🗑 Новый документ | Claude | toolbar.js | ✅ |
| 12 | Навигация: рисунки, формулы, таблицы | Claude | main.js, styles.css | ✅ |
| 13 | Свёртка секций в навигации | Claude | main.js, styles.css | ✅ |
| 14 | KaTeX цвет = чёрный | Claude | styles.css | ✅ |
| 15 | Right-click не выделяет строку | Claude | context-menu.js | ✅ |

---

## В работе

| # | Задача | Кто | Приоритет |
|---|--------|-----|-----------|
| 16 | OMML: запятые в формулах (разделение строк, не ломать `f(x,y)`) | Codex | HIGH |
| 17 | Lightbox: чёрный фон не закрывается | Claude | HIGH |
| 18 | Знак «=» разного оттенка (subpixel) | — | LOW |

**Детали #16 (Codex):** см. `activeContext.md`; тест: `docs/test_semion_full.docx` (32 формулы), особенно (2), (4), (15), (16).

---

## Backlog

| # | Задача | Приоритет |
|---|--------|-----------|
| 19 | Внутренние ссылки/сноски (REF field codes) | MEDIUM |
| 20 | Перекрёстные ссылки (якоря) | MEDIUM |
| 21 | Шаблоны стилей A4/A5 для PDF | MEDIUM |
| 22 | Экспорт в JATS XML | HIGH |
| 23 | Экспорт в HTML5 | MEDIUM |
| 24 | Экспорт в PDF | MEDIUM |
| 25 | Мультиязычность (AI-перевод) | LOW |

---

## Build & deploy

| Действие | Команда |
|----------|---------|
| Билд | `cd prototype && npx vite build` |
| Тесты | `cd prototype && npm test` |
| Deploy | GitHub Pages при push в `master` (см. репозиторий) |

- **Репозиторий:** https://github.com/MikeSaff/wysiwyg-editorum  
- **Live:** https://mikesaff.github.io/wysiwyg-editorum/

---

## История (краткая хронология)

- **2026-04-06..09** — прототип, ГОСТ, импорт Word, формулы, навигация, контекстное меню, multi-agent владение файлами.
- Версии v0.1 → v0.39 см. таблицу выше; детальные строки по дням — в секциях «Сессия».

## Стратегическое решение: MathML + MathJax (10.04.2026)

**Проблема:** OMML→LaTeX→KaTeX теряет нюансы, формулы выглядят несуразно.
**Решение:** OMML→MathML (XSLT, почти 1:1) → MathJax (рендер идентичен Word).
**LaTeX:** для LaTeX есть EdiLaTeX, в WYSIWYG формулы через MathML визуально.

### Новые задачи → закрыто (10.04.2026)
| # | Задача | Кто | Файл тикета | Статус |
|---|--------|-----|-------------|--------|
| 26 | OMML→MathML + MathJax | Codex | CODEX-TASK-MATHML.md | ✅ v0.42 |
| 27 | Экспорт HTML5 + метаданные | Composer | COMPOSER-TASK-EXPORT.md | ✅ v0.41 |

---

## [2026-04-10] Задача v0.43 fix: восстановить auxiliarySegments в `word-import.js`

**СТАТУС:** done

**ИЗМЕНЕНИЯ:** `prototype/src/word-import.js` — возвращены `isAuxiliaryFormulaSegment()`, `buildAuxiliaryMathParagraph()`, сбор `auxiliarySegments` в `extractFormulaFromRow()` / `extractFormulaContentFromCell()`, `trailingHtml: buildAuxiliaryMathParagraph(...)` вместо пустой строки. `prototype/tests/word-import.test.js` — снова проверка вынесения membership в отдельный `<p>` с inline math; Semion (2): membership не в основном `data-latex`.

**ТЕСТЫ:** `npm test` — 12/12 pass

**ПРОБЛЕМЫ:** нет

**БИЛД:** `npx vite build` — OK

**СЛЕДУЮЩИЙ ШАГ:** при необходимости уточнить эвристику `isAuxiliaryFormulaSegment` (другие операторы условий).

**Не трогали:** `math-render.js`, `mathlive-setup.js`, `main.js`, `schema.js`, `index.html` (по задаче).
