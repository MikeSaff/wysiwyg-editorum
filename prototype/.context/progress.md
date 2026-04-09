# WYSIWYG Editorum — Progress Tracker

## Сессия 9 апреля 2026

### Завершено сегодня

| # | Задача | Кто | Файлы | Статус |
|---|--------|-----|-------|--------|
| 1 | ГОСТ Р 7.0.110-2025 — CSS | Claude | styles.css | ✅ |
| 2 | Unicode матсимволы (⊗→\otimes) | Claude | word-import.js | ✅ |
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

### В работе

| # | Задача | Кто | Приоритет |
|---|--------|-----|-----------|
| 16 | Запятые в формулах (разделение строк) | Codex | HIGH |
| 17 | Lightbox чёрный фон не закрывается | Claude | HIGH |
| 18 | Знак = разного оттенка | — | LOW (subpixel rendering) |

### Backlog

| # | Задача | Приоритет |
|---|--------|-----------|
| 19 | Внутренние ссылки/сноски (REF field codes) | MEDIUM |
| 20 | Перекрёстные ссылки (якоря) | MEDIUM |
| 21 | Шаблоны стилей A4/A5 для PDF | MEDIUM |
| 22 | Экспорт в JATS XML | HIGH |
| 23 | Экспорт в HTML5 | MEDIUM |
| 24 | Экспорт в PDF | MEDIUM |
| 25 | Мультиязычность (AI-перевод) | LOW |

## Версии деплоя

| Версия | Дата | Основное |
|--------|------|----------|
| v0.1 | 06.04 | Первый прототип ProseMirror |
| v0.10 | 08.04 | Sticky toolbar, выравнивание |
| v0.17 | 08.04 | Autosave, undo/redo |
| v0.20 | 08.04 | Formula editing, footnotes, drag-drop fix |
| v0.22 | 08.04 | Formula numbering (SEQ), TIFF/WMF placeholders |
| v0.25 | 09.04 | Научная типографика, formula numbering works |
| v0.30 | 09.04 | ГОСТ Р 7.0.110-2025 полностью |
| v0.32 | 09.04 | Multi-agent: captions + context menu + OMML |
| v0.34 | 09.04 | Codex: 32 формулы OK |
| v0.38 | 09.04 | Навигация с рисунками/формулами, lightbox fix |

## Build & Deploy
- Build: `cd prototype && npx vite build`
- Test: `cd prototype && npm test`
- Deploy: auto via GitHub Pages on push to master
- Repo: https://github.com/MikeSaff/wysiwyg-editorum
- Live: https://mikesaff.github.io/wysiwyg-editorum/
