# Active Context — WYSIWYG Editorum

## Current Task for Codex/Composer

### ПРАВИЛО: Все изменения фиксировать в progress.md

После каждого изменения файла:
1. Записать что сделано в `.context/progress.md`
2. Проверить билд: `npx vite build`
3. НЕ коммитить в git — это делает Claude

### Codex — OMML конвертер
**Task:** CODEX-TASK-OMML.md
**File:** src/word-import.js (функция ommlToLatex и helpers)
**НЕ ТРОГАТЬ:** schema.js, styles.css, toolbar.js, main.js, context-menu.js

Что нужно:
- Разделить слипшиеся уравнения в формулах (2)(4)(15)(16)(25)(26)(31)
- Исправить обрезку интегралов в (8)(24)
- Сохранить запятые в (25)(26)
- Проверить все 32 формулы из docs/test_semion_full.docx
- Написать в progress.md что сделано

### Composer — свободен
Если есть новая задача — взять из progress.md

## File Ownership
| File | Owner |
|------|-------|
| src/word-import.js (ommlToLatex) | Codex |
| src/context-menu.js | Composer |
| src/schema.js | Claude |
| src/toolbar.js | Claude |
| src/styles.css | Claude + Composer (разные секции) |
| src/main.js | Claude + Composer |
