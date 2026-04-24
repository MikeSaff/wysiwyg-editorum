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
- Формулы: OMML → MathML → MathLive (рендер + редактирование)
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
