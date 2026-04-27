# Active Context — WYSIWYG Editorum

Единая точка правды: кто за что отвечает, какие задачи активны, как фиксировать изменения.

---

## 08. Rules: Правила агентов (F/T/Q/W/K)

ПРАВИЛА ВЗАИМОДЕЙСТВИЯ CLAUDE CODE <> ПОЛЬЗОВАТЕЛЬ

Область применения: только Claude Code (Orchestrator). Codex/Composer получают только технические инварианты + acceptance criteria через tocket.

ФОРМАТ
F1. Перед задачами — только 1-3 строки саммари. Запрещены рассуждения, варианты, обоснования — пока пользователь не попросил.
F2. Запрещено добавлять в конец: «если хочешь...», «уточни если нужно», «могу сделать X».

ЗАДАЧИ
T3. Если нужен перезапуск — явная отдельная задача ПЕРЕД остальными.
T4. Все задачи выполнимы агентом без ручных действий пользователя.

ВОПРОСЫ > ЗАДАЧИ
Q1. Уточняющий вопрос — только В НАЧАЛЕ сообщения. Никогда после задач.
Q2. Если ответ влияет на задачу — сначала вопрос, дождись ответа, потом задача.
Q3. Следующая задача зависит от результата текущей > НЕ формулировать заранее.

ВОРКФЛОУ
W1. Каждый блок задач = явный workflow: кому / порядок / что нужно ДО.
W3. Задачи разных агентов визуально различимы (заголовки/разделители).

KNOWLEDGE GATE
K1. Архитектурный контракт/инвариант → пометить PROJECT-LEVEL ARTIFACT.
K4. SEMANTIC SNAPSHOT при фазовом переходе: ПРОБЛЕМА / ПОДХОД / ИСХОД / ВЫВОД / ЗАПРЕТ / СТРАТЕГ.РИСК.
K5. MENTAL MODEL GATE при старте сессии: 3-5 пунктов текущего состояния → подтверждение CEO.

ДИАЛОГ КАК АРТЕФАКТ
D1. Диалог — первичный артефакт. Смысл > документы > код.
D2. Логи = источник смыслов. MCP = финальная архитектура и контракты.

АГЕНТЫ (Codex/Composer)
Эфемерные исполнители. Передавать только: технические инварианты + acceptance criteria + files.
Правила F/Q/W/K/D — только для Claude Code.
A5. Промежуточная коммуникация: агент пишет в .context/activeContext.md. Claude мониторит.
A6. Reporting: после каждой задачи агент ОБЯЗАТЕЛЬНО дописывает progress.md.

---

## Ticket protocol (обязательно)

После КАЖДОГО изменения:
1. Запись в .context/progress.md: что сделано, файлы, статус
2. npx vite build без ошибок
3. Коммиты в git — Claude Code (не агенты)
4. Если билд упал — сначала исправление, потом запись

---

## File ownership (владение файлами)

| Файл | Владелец | Комментарий |
|------|----------|-------------|
| src/schema.js | Claude | типы узлов, marks, атрибуты |
| src/word-import.js | Codex | OMML, таблицы, формулы, импорт .docx |
| src/context-menu.js | Composer | контекстное меню, floating toolbar |
| src/typography-rules.js | Composer | ГОСТ §16: кавычки, тире |
| src/export-html.js | Composer | экспорт HTML5 + MathJax |
| src/toolbar.js | Claude | кнопки панели инструментов |
| src/main.js | Claude | инициализация, lightbox, навигация, autosave |
| src/styles.css | Claude | CSS (Composer — только свои секции) |
| index.html | Claude | разметка страницы |
| .context/*.md | Общий | правила и трекер |

---

## Текущие задачи

| Роль | Статус | Задача |
|------|--------|--------|
| **Composer** | **IN PROGRESS** | **v0.43: MathLive вместо MathJax (задача в чате Claude Code)** |
| **Codex** | **WAITING** | **v0.44: post-import `typographyNormalizer(html)` ждёт export из `src/typography-rules.js` от Composer (v0.44d/e/f); в `src/word-import.js` оставлен TODO у `importDocx()`** |
| Claude | DONE | Скобки cases — mfenced fix, shouldWrapFormulaLinesInCases=false |
| Claude | DONE | MathJax menu/explorer отключён |

---

## Архитектура

- Стек: ProseMirror + Vite + MathLive (с v0.43)
- Документ: DocumentJSON (ProseMirror JSON)
- Формулы: OMML → MathML → MathLive (рендер + редактирование); **MTEF** из OLE `word/embeddings/*.bin` (MathType / Equation.3 / Equation.DSMT4) через `mtef-to-mathml`
- Типографика: ГОСТ Р 7.0.110-2025
- Тесты: `npm test` (node:test)
- Deploy: GitHub Pages auto на push в master

---

## v0.47 — formula-image node type added

Параллельно `math_block` (MathML + LaTeX, редактируемо) добавлены узлы для формул **как картинка**: скриншот из Word, фото с доски, экспорт MathType/ChemDraw в PNG, рукописный ввод без исходной разметки.

**Schema (`src/schema.js`):**

- `formula_image_block` — блочный атом: `id` (UUID через `newNodeId` / `crypto.randomUUID`), обязательный `src`, `alt`, опционально `latex_hint`, `number`. DOM: `figure.formula-image-block` с `data-id`, `data-number`, `data-latex-hint` (если задан) и дочерний `img`.
- `formula_image_inline` — inline-атом: `src`, `alt`, `latex_hint`. DOM: `img.formula-image-inline` (+ `data-latex-hint` при необходимости).

**UI (`src/toolbar.js`):** кнопка «Формула-картинка» → модал: вкладки «Загрузить файл» / «По URL», опционально номер и LaTeX-hint, переключатель блок / инлайн (по умолчанию блок), OK/Cancel. Файл читается в `src` как Data URL.

**Стили (`src/styles.css`):** `.formula-image-block` (центрирование, отступы), нумерация справа через `figure[data-number]::after`, `.formula-image-inline` (высота/выравнивание в строке), стили модалки `.pm-formula-image-*`.

**Lightbox (`src/main.js`):** в селектор клика добавлены `.formula-image-block img` и `.formula-image-inline`.

**Drag-drop:** обычный drop изображения — прежний `image` (inline); **Shift+drop** — `formula_image_block` или `formula_image_inline` в зависимости от позиции (в параграфе — инлайн). Вставка через `dropPoint` + `formula-image-insert.js` (`insertFormulaImageTransaction`).

**Экспорт (`src/export-html.js`):** HTML для обоих узлов; JATS для `disp-formula` / `inline-graphic` помечен TODO в комментарии, не реализован.

**Тесты:** `tests/formula-image.test.js` — валидация URL, JSON round-trip, вставка транзакцией.

---

## v0.48 — UPPERCASE heading heuristic + MathJax font unification

**Weak-path DOCX (Радбио и аналоги):** в конце `normalizeImportedHtml()` (после regex-нормализации параграфов), в браузерном пайплайне импорта, выполняется проход по DOM: короткий абзац (3–80 символов), весь текст в UPPERCASE с буквами, без `img` / inline-block math / таблиц, и **весь** видимый текст лежит внутри `<strong>` или `<b>` — абзац заменяется на `<h2>` с `id` и опционально `data-section-type` из `detectSectionType()`.

**`detectSectionType` (`word-import.js`):** «МАТЕРИАЛЫ И МЕТОДИКА» (`материалы и методика`); составной заголовок «РЕЗУЛЬТАТЫ И ОБСУЖДЕНИЕ» → `results` (первый матч до отдельного `discussion`); новые типы: `funding`, `author_info`, `author_contributions`, `conflicts`; благодарности канонизированы как `acknowledgments` (в схеме оставлен deprecated-ключ `acknowledgements` для старых JSON, в выпадающем списке типов скрыт).

**Экспортированная функция** `applyWeakPathUppercaseHeadingHeuristicToRoot(root)` — для unit-тестов на **linkedom** (devDependency).

**MathJax:** в `index.html` и встроенном скрипте экспорта HTML (`export-html.js`) для `chtml` добавлены `mtextInheritFont: true`, `merrorInheritFont: true`.

**CSS (`styles.css`):** правила для `mjx-utext` / `mjx-mtext` (`font-family: inherit`) и размеров inline/block контейнеров; цвета полосок для новых `data-section-type`.

**Тесты:** `word-import.test.js` (эвристика + отсев DOI / нежирного UPPERCASE), `math-render.test.js` (проверка флагов в `index.html`).

---

## v0.51.x — MTEF OLE objects integration + corpus regression baseline

**Импорт (`src/word-import.js`):**

- Зависимость `mtef-to-mathml` (локальный `file:../mtef-to-mathml`); `parseMathTypeSync(Uint8Array)` для бинарников из `word/embeddings/*.bin`.
- `extractDocxArchiveContext(arrayBuffer)` — общая распаковка: `document.xml`, `media`, **OLE blobs**, `document.xml.rels` (связи `rId` → `embeddings/…` если файл есть в zip).
- `docxXmlToHtml(..., oleEmbedRels, oleBlobs)` — ветка `<w:object>` + `o:OLEObject` (`ProgID` Equation / MathType): display block vs inline (стиль параграфа `Equation`, только объект в `w:p`, или текст + объект); метка `(N)` в том же `w:p` или следующем абзаце → `data-label`, без отдельного `<p>(N)</p>`.
- `docxBufferToNormalizedHtml` — для тестов/скриптов без браузера.
- Предупреждения: неподдерживаемый `ProgID` — `console.warn`, без падения.

**Корпус:**

- `scripts/corpus-baseline.mjs` / `corpus-diff.mjs` + `scripts/corpus-metrics.mjs`; `npm run corpus:baseline` пишет `tests/corpus-baseline.json`; `npm run corpus:diff` сравнивает метрики (exit 1 при регрессии). В Node задаётся `globalThis.DOMParser` из `xmldom`. Корень: `CORPUS_DOCX_ROOT` или `Docx/Nauka/Сложные журналы` рядом с репо.

**Тесты:** синтетические MTEF + опциональный `tests/fixtures/trukhachev.docx`; регрессия Semion 32 OMML без изменений.

**Документация:** `scripts/README.md`.

---

## v0.52 — Pleiades `pStyle` + fig-caption pairing + OLE tail + corpus locks

**Импорт (`src/word-import.js`):**

- **`getPStyleValue`**, **`PLEIADES_PARAGRAPH_STYLE_MAP`**: после эвристик Рис/Таблица маппинг `w:pStyle/@w:val` (TitleArticle, Author, Address, Abstract, Keywords, Heading/Heading1–3, BodyL, Equation, …) → тег, `styleType`, при необходимости `sectionType`; для заголовков — `detectSectionType` по тексту.
- **Подписи к рисункам:** порядок **caption → image** (как image → caption); **`trySplitMergedFigCaption`** — отрезание первого предложения подписи, остаток — обычный body (маркеры «А именно», длинный текст); **`FIG_CAPTION_BODY_MARKERS`** с кириллической **А** и lookahead вместо `\b` после кириллицы.
- **OLE/MathType:** в одном абзаце несколько меток `(n)` и хвостовой текст после последней формулы → дополнительный `<p>` с экранированным plain-текстом; **`classifyOleParagraphLayout`** возвращает **`oleAfter`** во всех ветках.

**Метаданные (`src/metadata-extract.js`):** преамбула по классам `style-title-article`, `style-author`, `style-affiliation`, `style-email`, `style-abstract`, `style-keywords`.

**Корпус:** `scripts/corpus-baseline.mjs` — пропуск файлов `~$*.docx` (Word lock).

**MTEF (`../mtef-to-mathml`):** слияние известных имён функций в один `<mi>`; **`tmLDIV` (26)** → `<mfrac>`; расширенный **`isNamedFunction`**.

**Тесты:** `tests/word-import.test.js` — pStyle, caption-before-image, merged-caption split, Heading1 с `style-heading1`.

---

## v0.53 — OLE label peel fix, context fig-caption, DocumentJSON metadata, MTEF prime

**Импорт (`word-import.js`):** **`peelOleTailLabels`** — при нескольких OLE и одном хвостовом `(n)` номер только на последнее уравнение (как v0.51); полная цепочка `(22)(23)…` по-прежнему распределяется. Эвристика **Рис./Рисунок** → `fig-caption` только если соседний абзац image-only или **`pStyle` Figure**; в дескриптор передаётся **`bodyChildren` + `paragraphIndex`**.

**Метаданные:** `EMPTY_META` — **`abstracts`**, **`dates`** (в т.ч. extension **`revised`**), **`contributors`**; разбор смешанного **`style-abstract`** (Поступила/После доработки/Принята/Ключевые слова + EN); e-mail с **`style-email`/аффилиации** на автора с `*` / одного автора; **`aff_1`**.

**MTEF:** запись **type 6 embellished** парсится как **`kind: embellished`** с дочерним узлом; **prime (5)** + **tmSUB (27)** → **`<msubsup>`**; апостроф **U+0027** в тексте → **`<mo>U+2032</mo>`**.

**Корпус:** обновлён **`tests/corpus-baseline.json`** после массового улучшения заголовков Pleiades в корпусе; **`corpus:diff`** снова exit 0.

---

## v0.55 — что сделано

**1. MTEF EMBELL:** расширен lookahead (до 8 шагов), извлечение базы для embellished из row/matrix; сообщения об orphan включают число попыток.

**2. LaTeX:** известные имена команд из таблицы MTEF→Unicode + дополнения; длина команды определяется как самое длинное распознанное имя (исправление `\partial` + `t`); `fixLatexSpacing` и `validateLatex` используют ту же логику.

**3. Подписи к рисункам:** bilingual split только при строгом английском маркере «Fig.» / «Figure» в абзаце; RU-only подписи остаются целиком на русском.

**4. Сиротские `style-figure`:** абзац со стилем рисунка и текстом подписи, но без встроенного изображения, поднимается в `figure-block` с placeholder (как у плавающих рисунков без embed).

**5. Метаданные:** при одном авторе и строке `*e-mail:` почта и corresponding назначаются детерминированно; повторный блок TitleArticle с латиницей и без кириллицы может задать английский заголовок.

**6. QA:** подсчёт семантических атомов в MathML через linkedom; в отчёт добавлены метрики по фигурам, полноте метаданных и bilingual; `npm run formula-quality:diff` сравнивает baseline; `formula-diff.mjs --inspect-figures` для диагностики DOCX.

## v0.56 — что сделано

### 0. TitleArticle priority hotfix

В `metadata-extract.js` восстановлен приоритет `style-title-article` / `TitleArticle` над эвристикой первого абзаца и issue/header строками.
Synthetic test проверяет, что `Физика плазмы_1_2025` не перебивает реальный article title.
На Trukhachev `meta.title.ru` снова начинается с «Ионные функции распределения…».

### 1. Corpus root resolution + fail-loud

Добавлен общий `scripts/corpus-root.mjs`: env `CORPUS_DOCX_ROOT` → `Docx/Nauka/Сложные журналы` → `Docx/Nauka`, abort при `<5` DOCX.
`formula-quality`, `formula-quality:diff`, `corpus:baseline`, `corpus:diff` теперь используют один root/DOM path и не пишут all-zero baseline.
Добавлены calibration tests на default root, sparse root abort и all-zero baseline guard.

### 2. EMBELL nested/base recovery

В `mtef-to-mathml` добавлены реальные golden fixtures из Trukhachev `oleObject43.bin` и `oleObject46.bin`.
Root cause: char-level `OPT_CHAR_EMBELL` ошибочно потреблял хвостовые records как child-list; теперь char embellishments читаются отдельно и не съедают формулу.
Добавлен `embell-result-trivial` warning для тривиального recovery; Trukhachev даёт `single_char_formula_count = 0`.

### 3. Figure recovery via diagnostic

`formula-diff.mjs --inspect-figures` подтвердил: реальные drawing PNG на pi=112/115/118, image93 без caption, VML/WMF — MathType previews.
Импортёр использует nearest preceding/following caption descriptors для drawing image pairing; image93 остаётся inline `<img>`.
На Trukhachev получаются 3 `figure-block` с `Рис. 1.`, `Рис. 2.`, `Рис. 3.`.

### 4. Caption full text

`splitBilingualFigureCaptionHtml` сохраняет RU-only caption целиком и режет bilingual только по строгому `Fig.` / `Figure`.
Для Pleiades back-matter captions короткие `Рис. N.` расширяются полным текстом из caption list без удаления неиспользованных caption-параграфов с формулами.
На Trukhachev `figure_caption_truncated_count = 0`; третья подпись сохраняет inline math.

### 5. Contributors / corresponding author

Парсер авторов нормализует `&nbsp;`, `&#160;`, NBSP и compact initials перед разбором.
Multi-author Trukhachev даёт 3 authors/contributors; `ftru@mail.ru` назначается starred corresponding author.
Single-author `*e-mail:` fallback сохранён synthetic test-ом и выставляет `is_corresponding=true`.

### 6. Pleiades EN-block

Существующий extractor второго латинского `TitleArticle`/`Abstract`/`Keywords` блока сохранён и покрыт тестом.
Проверка пакета Trukhachev DOCX по XML не нашла EN TitleArticle/Abstract/Keywords: латиница присутствует только в references.
EN metadata не синтезировалась; для Trukhachev `bilingual_extraction_score` остаётся 0 из-за отсутствующего source block, без регрессий Radbio на `corpus:diff`.
