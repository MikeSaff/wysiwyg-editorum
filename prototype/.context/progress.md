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

*Следующая версия (v0.40+): добавлять строку при значимом релизе или по договорённости команды.*

---

## Сессия 2026-04-09 (продолжение)

| # | Задача | Кто | Файлы | Статус | Билд |
|---|--------|-----|-------|--------|------|
| — | Документация: правила, владение файлами, Ticket protocol | Composer | `.context/activeContext.md`, `.context/progress.md` | ✅ | OK |
| 16 | OMML: multiline/comma/integral fix, 32 формулы и регрессионные тесты | Codex | `src/word-import.js`, `tests/word-import.test.js`, `tests/fixtures/omml-fixtures.js`, `package.json`, `src/styles.css`* | ✅ | OK |
| 19 | OMML: запятые в формулах, `cases`, вынос `u∈U/w∈W/t∈[...]` из (2), split строк в (4)/(15)/(16), фиксы тестов | Codex | `src/word-import.js`, `tests/word-import.test.js`, `.context/progress.md` | ✅ | OK |
| 20 | OMML follow-up: split auxiliary conditions через whitespace-run (`w∈W`, `t∈[...]`) | Codex | `src/word-import.js`, `tests/word-import.test.js`, `.context/progress.md` | ✅ | OK |
| 21 | Тестовый follow-up: скорректировано synthetic-ожидание по хвостовой запятой в auxiliary conditions | Codex | `tests/word-import.test.js`, `.context/progress.md` | ✅ | OK |

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
| 17 | Lightbox: чёрный фон не закрывается | Claude | HIGH |
| 18 | Знак «=» разного оттенка (subpixel) | — | LOW |

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

## Notes

- `*` `src/styles.css` owner = Claude. Codex внёс минимальный CSS fix `.ProseMirror .katex .mrel { color: inherit; }` для выравнивания цвета `=`; нужен review владельца по file-ownership protocol.

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
