# prototype/scripts

- **`corpus-baseline.mjs`** — обходит `Docx/Nauka/Сложные журналы/**/*.docx` (корень задаётся `CORPUS_DOCX_ROOT` или путь рядом с репо), гоняет `extractDocxArchiveContext` + `docxXmlToHtml` + `normalizeImportedHtml`, пишет агрегированные метрики в `tests/corpus-baseline.json`. Ошибки на отдельных файлах не останавливают прогон.
- **`corpus-diff.mjs`** — читает сохранённый baseline, снова прогоняет корпус, печатает `REGRESSION` / `IMPROVEMENT` по числовым метрикам; код выхода **1**, если есть регрессии (удобно для CI).
- После намеренного изменения импорта перезапишите baseline: `npm run corpus:baseline`, затем закоммитьте обновлённый `tests/corpus-baseline.json`.
