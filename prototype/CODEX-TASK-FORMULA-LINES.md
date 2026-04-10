# CODEX TASK: Формула (2) — 4-я строка отрывается

## ПРАВИЛО: после каждого изменения пиши в .context/progress.md

## Проблема
Формула (2) в Word — одна таблица с 1 строкой и 2 ячейками:
- Ячейка 0: вся формула (6 строк OMML math)
- Ячейка 1: номер "(2)"

Конвертер разбивает содержимое на:
- `formulaLines` (3 строки → math-block с cases)
- `auxiliarySegments` → отдельные `<p>` абзацы

Результат: 3 строки в формуле, а `u(t) ∈ U, w(t) ∈ W, t ∈ [t₀, tf]` и `где x(⋅) ∈ C¹(...)` — отдельные абзацы после формулы.

## Как должно быть
Все строки из одной ячейки Word-таблицы должны быть **в одном math-block** как mtable строки. Строки "где" с пояснениями можно оставить текстовыми абзацами.

Но `u(t) ∈ U, w(t) ∈ W, t ∈ [t₀, tf]` — это **часть формулы**, не пояснение.

## Где смотреть
Функция `extractFormulaContentFromCell` в `src/word-import.js` — логика разделения на formulaLines и auxiliarySegments.

## Acceptance Criteria
- [ ] Формула (2): `u(t) ∈ U, w(t) ∈ W, t ∈ [t₀, tf]` внутри math-block
- [ ] Строка «где» — текстовый абзац (не формула)
- [ ] npm test проходит
- [ ] npx vite build проходит
- [ ] Записать в .context/progress.md

## НЕ ТРОГАТЬ
- schema.js, styles.css, toolbar.js, main.js, context-menu.js
