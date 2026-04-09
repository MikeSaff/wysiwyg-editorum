# CODEX TASK: Починить lightbox (чёрный фон)

## ПРАВИЛО: после каждого изменения пиши в .context/progress.md

## Проблема
При клике на картинку в редакторе появляется чёрный полупрозрачный оверлей (lightbox), 
но он НЕ ЗАКРЫВАЕТСЯ при клике по оверлею. Пользователь застревает с чёрным экраном.

## Текущая реализация
- `index.html`: `<div id="lightbox-overlay"><img id="lightbox-img"></div>`
- `src/main.js`: 
  - `window._openLightbox(src)` — добавляет class `active`
  - Click listener на editorEl для `.inline-image` → вызывает _openLightbox
  - Escape listener → remove `active`
  - Click listener на overlay → remove `active` (НЕ РАБОТАЕТ)

- `src/styles.css`:
  ```css
  #lightbox-overlay { display: none; position: fixed; z-index: 10000; background: rgba(0,0,0,0.85); }
  #lightbox-overlay.active { display: flex; }
  ```

## Что нужно починить
1. Клик по чёрному фону (overlay) должен закрывать lightbox
2. Клик по картинке внутри lightbox НЕ должен закрывать (stopPropagation на img)
3. Escape должен закрывать
4. НЕ открывать lightbox для SVG-плейсхолдеров (WMF/TIFF)

## Файлы для изменения
- `src/main.js` — секция lightbox (window._openLightbox и listeners)
- `index.html` — структура lightbox-overlay (если нужно)

## НЕ ТРОГАТЬ
- word-import.js (кроме lightbox-секции в main.js)
- schema.js, toolbar.js, context-menu.js, styles.css

## Acceptance Criteria
- [ ] Клик по overlay → lightbox закрывается
- [ ] Клик по картинке в lightbox → НЕ закрывается
- [ ] Escape → закрывается
- [ ] SVG placeholders не открывают lightbox
- [ ] `npx vite build` без ошибок
- [ ] Записать в `.context/progress.md`
