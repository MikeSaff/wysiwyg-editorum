# prototype/scripts

- **`corpus-baseline.mjs`** — обходит `Docx/Nauka/Сложные журналы/**/*.docx` (корень задаётся `CORPUS_DOCX_ROOT` или путь рядом с репо), гоняет `extractDocxArchiveContext` + `docxXmlToHtml` + `normalizeImportedHtml`, пишет агрегированные метрики в `tests/corpus-baseline.json`. Ошибки на отдельных файлах не останавливают прогон.
- **`corpus-diff.mjs`** — читает сохранённый baseline, снова прогоняет корпус, печатает `REGRESSION` / `IMPROVEMENT` по числовым метрикам; код выхода **1**, если есть регрессии (удобно для CI).
- После намеренного изменения импорта перезапишите baseline: `npm run corpus:baseline`, затем закоммитьте обновлённый `tests/corpus-baseline.json`.
- **`formula-quality.mjs`** — метрики качества формул по всему `Docx/Nauka/**/*.docx` (пустые `msub`, `validateLatex`, `embell-orphan`, односимвольные формулы, `<merror>`). Пишет `tests/formula-quality-baseline.json`. Запуск: `npm run formula-quality`. Используйте после правок в `mtef-to-mathml/` или `word-import.js`.
- **`formula-quality-diff.mjs`** — сравнение агрегированных `totals` с baseline; код выхода **1** при ухудшении (кроме `formulas_total`, где больше — лучше). `npm run formula-quality:diff`.
- **`formula-diff.mjs`** — точечный разбор OLE в одном DOCX: `node scripts/formula-diff.mjs --docx path/to/file.docx` или `--all` по корпусу.
