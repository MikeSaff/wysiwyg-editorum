# COMPOSER TASK: Экспорт HTML5 + метаданные

## ПРАВИЛО: после каждого изменения пиши в .context/progress.md

## Контекст
Цель WYSIWYG: из DocumentJSON получить HTML5 с MathJax для сайта Editorum.
Сейчас редактор работает, но нет кнопки «Экспорт в HTML».

## Что нужно сделать

### 1. Кнопка «Экспорт HTML» в toolbar (группа Документ)
При нажатии: генерирует HTML5 файл из текущего DocumentJSON и скачивает.

### 2. Структура HTML5
```html
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>{заголовок из первого H1}</title>
  <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
  <link rel="stylesheet" href="editorum-publication.css">
</head>
<body>
  <article>
    <header>
      <!-- метаданные: заголовок, авторы, аннотация, ключевые слова -->
    </header>
    <main>
      <!-- контент из DocumentJSON -->
    </main>
    <footer>
      <!-- библиография -->
    </footer>
  </article>
</body>
</html>
```

### 3. Метаданные в HTML
Параграфы со стилем `style-fig-caption` → `<figcaption>`
Параграфы со стилем `style-table-caption` → `<caption>`
Формулы → `<div class="formula">` с MathJax
Заголовки → `<h1>`-`<h4>` с id для навигации

### 4. Реализация
Создать новый файл `src/export-html.js`:
```js
export function exportToHtml(doc, schema) {
  // doc = ProseMirror document JSON
  // return: HTML string
}
```

Подключить в toolbar.js — кнопка «📄 HTML».

### НЕ ТРОГАТЬ
- word-import.js (Codex)
- schema.js (Codex меняет для MathML)

## Acceptance Criteria
- [ ] Кнопка «📄 HTML» генерирует и скачивает HTML файл
- [ ] HTML содержит все элементы документа
- [ ] Формулы рендерятся через MathJax при открытии HTML
- [ ] npx vite build без ошибок
- [ ] Записать в .context/progress.md
