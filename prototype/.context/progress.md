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

*Следующая версия (v0.43+): добавлять строку при значимом релизе или по договорённости команды.*

---

## Сессия 2026-04-09 (продолжение)

| # | Задача | Кто | Файлы | Статус | Билд |
|---|--------|-----|-------|--------|------|
| — | Документация: правила, владение файлами, Ticket protocol | Composer | `.context/activeContext.md`, `.context/progress.md` | ✅ | OK |
| — | COMPOSER-TYPOGRAPHY: кавычки «»„", тире `---`→—, `--`+символ→–; убраны smartQuotes/emDash PM | Composer | `src/typography-rules.js`, `src/main.js`, `tests/typography-rules.test.js` | ✅ | OK |
| — | COMPOSER-EXPORT: HTML5 + MathJax, article/header/main/footer, figcaption/caption, кнопка скачивания | Composer | `src/export-html.js`, `src/editorum-publication.css`, `public/editorum-publication.css`, `src/toolbar.js` | ✅ | OK |
| — | Codex: OMML→MathML pipeline, тесты (в т.ч. Semion 32 формулы), MathJax в `index.html`; повторная проверка **`npm test` — 12/12** | Codex / проверка | `word-import.js`, `index.html`, `package.json`, `tests/` | ✅ | `npm test` OK |
| — | Codex: формула (2) из `docs/test_semion_full.docx` больше не выносит `u(t) ∈ U, w(t) ∈ W, t ∈ [t₀, tf]` в отдельный абзац; membership-строки остаются внутри `math-block`, тесты обновлены | Codex | `src/word-import.js`, `tests/word-import.test.js`, `.context/progress.md` | ✅ | OK |

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
