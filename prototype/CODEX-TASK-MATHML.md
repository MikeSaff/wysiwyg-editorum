# CODEX TASK: Переход с KaTeX/LaTeX на MathJax/MathML

## ПРАВИЛО: после каждого изменения пиши в .context/progress.md

## Контекст
Текущая архитектура формул: OMML (Word) → LaTeX (наш конвертер) → KaTeX (рендер)
Проблема: конвертер OMML→LaTeX теряет нюансы, формулы выглядят «несуразно»

## Новая архитектура
OMML (Word) → MathML (XSLT от Microsoft) → MathJax (рендер)

MathML — XML-формат для математики, почти 1:1 с OMML.
MathJax — рендерит MathML нативно, результат идентичен Word.

## Что нужно сделать

### 1. Заменить KaTeX на MathJax
- Удалить `katex` из dependencies
- Добавить MathJax (CDN или npm): `mathjax` или `mathjax-full`
- В `index.html`: подключить MathJax вместо KaTeX CSS

### 2. Изменить schema.js — хранить MathML вместо LaTeX
Текущие ноды `math_block` и `math_inline` хранят `attrs.latex`.
Нужно: `attrs.mathml` (строка MathML XML) + `attrs.latex` (опционально, для ручного редактирования)

```js
math_block: {
  attrs: { 
    mathml: { default: "" },    // MathML XML строка
    latex: { default: "" },     // LaTeX (для редактирования, опционально)
    label: { default: null }    // номер формулы
  },
  toDOM(node) {
    const div = document.createElement("div")
    div.classList.add("math-block")
    div.innerHTML = node.attrs.mathml  // MathJax подхватит <math> элемент
    MathJax.typeset([div])  // или MathJax.typesetPromise
    // ...
  }
}
```

### 3. Изменить word-import.js — OMML → MathML
Заменить функцию `ommlToLatex()` на `ommlToMathML()`.

Конвертация OMML → MathML:
- Microsoft предоставляет XSLT: `OMML2MML.xsl` (идёт с Word)
- npm пакет: `omml2mathml` (уже установлен!)
- Или прямой маппинг тегов (они почти совпадают):
  - `m:f` → `<mfrac>`, `m:r` → `<mi>/<mn>/<mo>`, `m:sSub` → `<msub>`, и т.д.

### 4. Сохранить возможность редактирования
- По клику на формулу: показать LaTeX (конвертировать MathML→LaTeX для редактирования)
- Или визуальный math-editor (будущее)
- При сохранении LaTeX: конвертировать LaTeX→MathML обратно

### 5. Обновить экспорт
- HTML5: `<math>` элементы + MathJax script → идеальный рендер
- JATS XML: `<mml:math>` — MathML стандарт для JATS
- PDF: MathJax → SVG → вставка в макет

## Файлы для изменения
- `src/schema.js` — math_block/math_inline attrs (mathml вместо latex)
- `src/word-import.js` — ommlToMathML() вместо ommlToLatex()
- `src/main.js` — инициализация MathJax вместо KaTeX
- `index.html` — подключение MathJax
- `package.json` — зависимости

## НЕ ТРОГАТЬ
- context-menu.js
- toolbar.js (кроме формульных кнопок если нужно)
- typography-rules.js

## Acceptance Criteria
- [ ] Формулы рендерятся через MathJax/MathML
- [ ] Все 32 формулы из docs/test_semion_full.docx выглядят как в Word
- [ ] Формулы кликабельны для редактирования (LaTeX prompt)
- [ ] npm test проходит
- [ ] npx vite build проходит
- [ ] Записать в .context/progress.md
