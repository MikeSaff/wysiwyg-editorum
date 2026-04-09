# WYSIWYG Editorum — Progress Tracker

## Active Tasks

### Claude (AI-советник) — Стили подписей + Сноски
- **Status:** in_progress
- **Files:** src/schema.js, src/styles.css, src/word-import.js, src/toolbar.js
- **Scope:** 
  - Стили подписей (Рис. N / Табл. N) — кнопка в toolbar
  - Сноски/ссылки из Word — доработка footnotes
  - НЕ трогать: word-import.js функцию ommlToLatex (Codex) и context-menu.js (Composer)

### Codex — OMML→LaTeX конвертер
- **Status:** in_progress  
- **Task:** CODEX-TASK-OMML.md
- **Files:** src/word-import.js (ТОЛЬКО функция ommlToLatex и связанные)
- **Scope:** Фикс 32 формул, разделение слипшихся уравнений, интегралы, lim
- **НЕ трогать:** schema.js, styles.css, toolbar.js, main.js

### Composer — Контекстное меню
- **Status:** in_progress
- **Task:** COMPOSER-TASK-CONTEXT-MENU.md  
- **Files:** src/context-menu.js (НОВЫЙ файл), дополнения в src/styles.css и src/main.js
- **Scope:** Правый клик + floating toolbar при выделении
- **НЕ трогать:** word-import.js, schema.js

## File Ownership (avoid conflicts)

| File | Owner | Notes |
|------|-------|-------|
| src/word-import.js | Codex | ТОЛЬКО ommlToLatex и helper functions |
| src/context-menu.js | Composer | НОВЫЙ файл |
| src/schema.js | Claude | Стили подписей, новые node types |
| src/toolbar.js | Claude | Кнопки стилей подписей |
| src/styles.css | Claude + Composer | Claude: стили подписей/сносок. Composer: context menu CSS |
| src/main.js | Claude + Composer | Claude: стили. Composer: подключение context-menu |
| index.html | Claude | Если нужно |

## Completed Today
- ГОСТ Р 7.0.110-2025 внедрён в CSS
- Unicode матсимволы в формулах (⊗→\otimes, ∙→\cdot)
- Точки (∙) исправлены на \cdot
- lim не дублируется
- Пустые строки между рисунками убраны
- Lightbox для картинок
- confirm автосохранения убран

## Build & Deploy
- `cd prototype && npx vite build` — проверка
- `git add . && git commit && git push` — деплой (GitHub Pages auto)
- Каждый агент проверяет build перед коммитом
