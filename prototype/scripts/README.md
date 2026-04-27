# prototype/scripts

- **`corpus-baseline.mjs`** — обходит `Docx/Nauka/Сложные журналы/**/*.docx` (корень задаётся `CORPUS_DOCX_ROOT` или путь рядом с репо), гоняет `extractDocxArchiveContext` + `docxXmlToHtml` + `normalizeImportedHtml`, пишет агрегированные метрики в `tests/corpus-baseline.json`. Ошибки на отдельных файлах не останавливают прогон.
- **`corpus-diff.mjs`** — читает сохранённый baseline, снова прогоняет корпус, печатает `REGRESSION` / `IMPROVEMENT` по числовым метрикам; код выхода **1**, если есть регрессии (удобно для CI).
- После намеренного изменения импорта перезапишите baseline: `npm run corpus:baseline`, затем закоммитьте обновлённый `tests/corpus-baseline.json`.
- **`formula-quality.mjs`** — метрики по корпусу `Docx/Nauka/Сложные журналы` (пустые `msub`, строгий `validateLatex`, `embell-orphan`, **семантический** single-char по атомам MathML, фигуры/усечённые подписи, `metadata_completeness_pct`, `bilingual_extraction_score`). Пишет `tests/formula-quality-baseline.json`. `npm run formula-quality`.
- **`formula-quality-diff.mjs`** — сравнение `totals` с baseline; **1** при ухудшении «чем меньше тем лучше»; для `formulas_total`, `figure_count`, `metadata_completeness_pct`, `bilingual_extraction_score` больше — лучше. `npm run formula-quality:diff`.
- **`formula-diff.mjs`** — OLE в DOCX: `node scripts/formula-diff.mjs --docx path/to/file.docx` или `--all`. Диагностика картинок/подписей: **`--inspect-figures`** вместе с `--docx` (таблица `pStyle`, тип `drawing`/`pict`, соседняя подпись).
