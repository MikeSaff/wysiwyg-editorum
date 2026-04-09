# Active Context — WYSIWYG Editorum

## ПРАВИЛА ДЛЯ ВСЕХ АГЕНТОВ

### 1. Tocket Protocol
После КАЖДОГО изменения:
- Записать в `.context/progress.md`: что сделано, какие файлы, статус
- Проверить билд: `npx vite build`
- НЕ коммитить в git — это делает Claude
- Если билд сломался — починить ДО записи в progress

### 2. File Ownership (НЕ ТРОГАТЬ чужие файлы!)
| File | Owner | Scope |
|------|-------|-------|
| src/word-import.js | Codex | ommlToLatex, processTableOrFormula, helpers |
| src/context-menu.js | Composer | контекстное меню, floating toolbar |
| src/schema.js | Claude | node types, marks, attributes |
| src/toolbar.js | Claude | кнопки toolbar |
| src/styles.css | Claude | CSS (Composer может добавлять в секцию Context Menu) |
| src/main.js | Claude | инициализация, lightbox, навигация, autosave |
| index.html | Claude | HTML-структура |

### 3. Конфликты
Если нужно изменить чужой файл — написать в progress.md запрос к владельцу.

## Текущие задачи

### Codex — OMML конвертер: запятые в формулах
**Status:** TODO
**Task:** Формула (2) неправильно делится на строки по запятым.
**Правила для запятых в математике:**
- Запятая остаётся В КОНЦЕ строки (не переносится на начало следующей)
- Если несколько уравнений — каждое на отдельной строке
- Разделение по паттерну: `выражение,` → конец строки, `следующее_выражение` → новая строка
- НЕ разделять внутри аргументов функций: f(x, y) — запятая между x и y НЕ является разделителем уравнений
**Тестовый файл:** docs/test_semion_full.docx (32 формулы)
**Проверить:** все 32 формулы, особенно (2), (4), (15), (16)

### Composer — свободен
Взять задачу из progress.md или ждать новую.

### Claude — навигация, lightbox, общий контроль
- Навигация с рисунками/формулами/таблицами — сделано
- Lightbox close fix — сделано
- Контроль progress.md

## Архитектура
- **Стек:** ProseMirror + Vue 3 (будущее) + Java backend (будущее)
- **Формат:** DocumentJSON v1 (ProseMirror JSON)
- **Экспорт:** JATS XML, HTML5+MathJax, PDF
- **ГОСТ:** Р 7.0.110-2025 внедрён в CSS
- **Тесты:** npm test (6 тестов, Vitest)
