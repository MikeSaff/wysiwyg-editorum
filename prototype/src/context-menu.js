import { TextSelection, NodeSelection } from "prosemirror-state"
import { toggleMark, setBlockType } from "prosemirror-commands"
import {
  addColumnAfter,
  addRowAfter,
  deleteColumn,
  deleteRow,
  deleteTable,
  mergeCells,
  splitCell,
} from "prosemirror-tables"
import { schema } from "./schema.js"

/** @typedef {"text"|"math"|"image"|"table"} MenuKind */

/**
 * @param {import("prosemirror-view").EditorView} view
 * @param {MouseEvent} event
 * @param {{ kind: MenuKind, ctx: { pos?: number } }} detected
 */
function ensureSelectionAtClick(view, event, detected) {
  const state = view.state
  const p = detected.ctx?.pos
  if (detected.kind === "math" && p != null) {
    const node = state.doc.nodeAt(p)
    if (node && (node.type === schema.nodes.math_block || node.type === schema.nodes.math_inline)) {
      const sel = NodeSelection.create(state.doc, p)
      if (!sel.eq(state.selection)) {
        view.dispatch(state.tr.setSelection(sel).scrollIntoView())
      }
      return
    }
  }
  if (detected.kind === "image" && p != null) {
    const node = state.doc.nodeAt(p)
    if (node && node.type === schema.nodes.image) {
      const sel = NodeSelection.create(state.doc, p)
      if (!sel.eq(state.selection)) {
        view.dispatch(state.tr.setSelection(sel).scrollIntoView())
      }
      return
    }
  }

  const coords = view.posAtCoords({ left: event.clientX, top: event.clientY })
  if (!coords) return
  const $pos = state.doc.resolve(coords.pos)

  let sel = state.selection
  if ($pos.parent.inlineContent && $pos.nodeAfter?.isAtom) {
    sel = NodeSelection.create(state.doc, $pos.pos)
  } else {
    sel = TextSelection.near($pos)
  }
  if (!sel.eq(state.selection)) {
    view.dispatch(state.tr.setSelection(sel).scrollIntoView())
  }
}

function insertMathInline(state, dispatch) {
  const latex = prompt("Inline LaTeX:", "\\alpha + \\beta")
  if (!latex) return false
  const node = schema.nodes.math_inline.create({ latex })
  if (dispatch) dispatch(state.tr.replaceSelectionWith(node))
  return true
}

function toggleLink(state, dispatch) {
  if (schema.marks.link.isInSet(state.storedMarks || state.selection.$from.marks())) {
    return toggleMark(schema.marks.link)(state, dispatch)
  }
  const href = prompt("URL:", "https://")
  if (!href) return false
  return toggleMark(schema.marks.link, { href })(state, dispatch)
}

function setParagraphAlign(align) {
  return (state, dispatch) => {
    const { from, to } = state.selection
    let tr = state.tr
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (node.type === schema.nodes.paragraph || node.type === schema.nodes.heading) {
        tr = tr.setNodeMarkup(pos, null, { ...node.attrs, align })
      }
    })
    if (dispatch) dispatch(tr.scrollIntoView())
    return true
  }
}

function setFigureCaptionStyle(state, dispatch) {
  return setBlockType(schema.nodes.paragraph, { align: "center" })(state, dispatch)
}

function setTableCaptionStyle(state, dispatch) {
  return setBlockType(schema.nodes.paragraph, { align: "center" })(state, dispatch)
}

function openLightbox(imgEl) {
  const overlay = document.getElementById("lightbox-overlay")
  const img = document.getElementById("lightbox-img")
  if (!overlay || !img || !imgEl?.src) return
  img.src = imgEl.src
  img.alt = imgEl.alt || ""
  overlay.classList.add("active")
}

function runCommand(view, fn) {
  fn(view.state, view.dispatch, view)
  view.focus()
}

function createMenuShell() {
  const el = document.createElement("div")
  el.className = "pm-context-menu"
  el.setAttribute("role", "menu")
  return el
}

function createItem(label, title, onRun) {
  const btn = document.createElement("button")
  btn.type = "button"
  btn.className = "pm-context-menu-item"
  btn.textContent = label
  btn.title = title
  btn.setAttribute("role", "menuitem")
  btn.addEventListener("mousedown", (e) => e.preventDefault())
  btn.addEventListener("click", (e) => {
    e.stopPropagation()
    onRun()
  })
  return btn
}

function createSep() {
  const s = document.createElement("div")
  s.className = "pm-context-menu-sep"
  return s
}

/**
 * @param {import("prosemirror-view").EditorView} view
 * @param {MenuKind} kind
 * @param {{ pos?: number, node?: import("prosemirror-model").Node, imgEl?: HTMLImageElement }} ctx
 */
function buildMenuContent(view, kind, ctx) {
  const root = createMenuShell()

  if (kind === "text") {
    root.appendChild(
      createItem("✂ Вырезать", "Вырезать", () => {
        document.execCommand("cut")
        view.focus()
      })
    )
    root.appendChild(
      createItem("📋 Копировать", "Копировать", () => {
        document.execCommand("copy")
        view.focus()
      })
    )
    root.appendChild(
      createItem("📥 Вставить", "Вставить", async () => {
        try {
          const text = await navigator.clipboard.readText()
          if (text) {
            const tr = view.state.tr.insertText(text)
            view.dispatch(tr.scrollIntoView())
          }
        } catch (err) {
          console.warn("Paste failed:", err)
        }
        view.focus()
      })
    )
    root.appendChild(createSep())
    root.appendChild(
      createItem("¶ Обычный", "Обычный абзац", () =>
        runCommand(view, setBlockType(schema.nodes.paragraph))
      )
    )
    ;[1, 2, 3].forEach((level) => {
      root.appendChild(
        createItem(`H${level} Заголовок`, `Заголовок ${level}`, () =>
          runCommand(view, setBlockType(schema.nodes.heading, { level }))
        )
      )
    })
    root.appendChild(
      createItem("🖼 Подпись рисунка", "Стиль подписи к рисунку (центр)", () =>
        runCommand(view, setFigureCaptionStyle)
      )
    )
    root.appendChild(
      createItem("⊞ Подпись таблицы", "Стиль подписи к таблице (центр)", () =>
        runCommand(view, setTableCaptionStyle)
      )
    )
    root.appendChild(createSep())
    ;[
      ["⇤", "left", "По левому краю"],
      ["⇔", "center", "По центру"],
      ["⇥", "right", "По правому краю"],
      ["☰", "justify", "По ширине"],
    ].forEach(([label, align, title]) => {
      root.appendChild(
        createItem(`${label} ${title}`, title, () => runCommand(view, setParagraphAlign(align)))
      )
    })
    return root
  }

  if (kind === "math") {
    const pos = ctx.pos
    const node = ctx.node
    if (pos == null || !node) return root

    root.appendChild(
      createItem("✎ Редактировать", "Редактировать LaTeX", () => {
        const isBlock = node.type === schema.nodes.math_block
        const next = prompt(
          isBlock ? "Редактирование блочной формулы (LaTeX):" : "Редактирование inline формулы (LaTeX):",
          node.attrs.latex || ""
        )
        if (next !== null && next !== node.attrs.latex) {
          const tr = view.state.tr.setNodeMarkup(pos, null, { ...node.attrs, latex: next })
          view.dispatch(tr.scrollIntoView())
        }
        view.focus()
      })
    )
    root.appendChild(
      createItem("🗑 Удалить", "Удалить формулу", () => {
        const tr = view.state.tr.delete(pos, pos + node.nodeSize)
        view.dispatch(tr.scrollIntoView())
        view.focus()
      })
    )
    root.appendChild(
      createItem("📋 LaTeX", "Копировать LaTeX", async () => {
        try {
          await navigator.clipboard.writeText(node.attrs.latex || "")
        } catch (e) {
          console.warn(e)
        }
        view.focus()
      })
    )
    return root
  }

  if (kind === "image") {
    const pos = ctx.pos
    const node = ctx.node
    const imgEl = ctx.imgEl
    if (pos == null || !node) return root

    root.appendChild(
      createItem("🔍 Увеличить", "Просмотр (lightbox)", () => {
        if (imgEl) openLightbox(imgEl)
        view.focus()
      })
    )
    root.appendChild(
      createItem("🗑 Удалить", "Удалить изображение", () => {
        const tr = view.state.tr.delete(pos, pos + node.nodeSize)
        view.dispatch(tr.scrollIntoView())
        view.focus()
      })
    )
    root.appendChild(createSep())
    ;[
      ["⇤ Лево", "left"],
      ["⇔ Центр", "center"],
      ["⇥ Право", "right"],
    ].forEach(([label, align]) => {
      root.appendChild(
        createItem(label, `Выравнивание: ${align}`, () => {
          const { state } = view
          const $from = state.doc.resolve(pos)
          for (let d = $from.depth; d > 0; d--) {
            const n = $from.node(d)
            if (n.type === schema.nodes.paragraph) {
              const pStart = $from.before(d)
              const tr = state.tr.setNodeMarkup(pStart, null, { ...n.attrs, align })
              view.dispatch(tr.scrollIntoView())
              view.focus()
              return
            }
          }
        })
      )
    })
    return root
  }

  if (kind === "table") {
    const cmds = [
      ["+ строка", "Добавить строку ниже", addRowAfter],
      ["+ столбец", "Добавить столбец справа", addColumnAfter],
      ["− строка", "Удалить строку", deleteRow],
      ["− столбец", "Удалить столбец", deleteColumn],
      ["⊞ Объединить", "Объединить ячейки", mergeCells],
      ["⊟ Разделить", "Разделить ячейку", splitCell],
      ["🗑 Таблица", "Удалить таблицу", deleteTable],
    ]
    cmds.forEach(([label, title, cmd]) => {
      root.appendChild(
        createItem(label, title, () => runCommand(view, cmd))
      )
    })
    return root
  }

  return root
}

function placeFixed(el, clientX, clientY) {
  el.style.position = "fixed"
  el.style.left = "0"
  el.style.top = "0"
  el.style.zIndex = "500"
  document.body.appendChild(el)
  const pad = 8
  const w = el.offsetWidth
  const h = el.offsetHeight
  let left = clientX
  let top = clientY
  if (left + w + pad > window.innerWidth) left = Math.max(pad, window.innerWidth - w - pad)
  if (top + h + pad > window.innerHeight) top = Math.max(pad, window.innerHeight - h - pad)
  el.style.left = `${left}px`
  el.style.top = `${top}px`
}

/**
 * @param {import("prosemirror-view").EditorView} view
 * @param {MouseEvent} event
 * @returns {{ kind: MenuKind, ctx: object } | null}
 */
function detectContext(view, event) {
  const target = /** @type {HTMLElement} */ (event.target)
  if (!view.dom.contains(target)) return null

  const imgEl = target.closest?.("img.inline-image")
  if (imgEl && view.dom.contains(imgEl)) {
    const pos = view.posAtDOM(imgEl, 0)
    if (pos === undefined || pos === null) return null
    const node = view.state.doc.nodeAt(pos)
    if (!node || node.type !== schema.nodes.image) return null
    return { kind: "image", ctx: { pos, node, imgEl } }
  }

  const mathBlock = target.closest?.(".math-block")
  const mathInline = target.closest?.(".math-inline")
  const mathEl = mathBlock || mathInline
  if (mathEl && view.dom.contains(mathEl)) {
    const pos = view.posAtDOM(mathEl, 0)
    if (pos === undefined || pos === null) return null
    const node = view.state.doc.nodeAt(pos)
    if (!node || (node.type !== schema.nodes.math_block && node.type !== schema.nodes.math_inline)) {
      return null
    }
    return { kind: "math", ctx: { pos, node } }
  }

  const tableEl = target.closest?.("table")
  if (tableEl && view.dom.contains(tableEl)) {
    return { kind: "table", ctx: {} }
  }

  return { kind: "text", ctx: {} }
}

function buildFloatingToolbar(view) {
  const bar = document.createElement("div")
  bar.className = "pm-floating-toolbar"
  bar.setAttribute("role", "toolbar")

  const marks = [
    ["𝐁", "Жирный", toggleMark(schema.marks.bold), "mark-bold"],
    ["𝐼", "Курсив", toggleMark(schema.marks.italic), "mark-italic"],
    ["U̲", "Подчёркнутый", toggleMark(schema.marks.underline), "mark-underline"],
    ["S̶", "Зачёркнутый", toggleMark(schema.marks.strikethrough), "mark-strike"],
    ["🔗", "Ссылка", toggleLink, null],
    ["𝛼", "Формула inline", insertMathInline, null],
  ]

  marks.forEach(([label, title, cmd, cls]) => {
    const btn = document.createElement("button")
    btn.type = "button"
    btn.className = "pm-floating-toolbar-btn" + (cls ? ` ${cls}` : "")
    btn.textContent = label
    btn.title = title
    btn.addEventListener("mousedown", (e) => e.preventDefault())
    btn.addEventListener("click", (e) => {
      e.stopPropagation()
      cmd(view.state, view.dispatch, view)
      view.focus()
    })
    bar.appendChild(btn)
  })

  return bar
}

function unionRect(a, b) {
  const top = Math.min(a.top, b.top)
  const left = Math.min(a.left, b.left)
  const right = Math.max(a.right, b.right)
  const bottom = Math.max(a.bottom, b.bottom)
  return { top, left, right, bottom, width: right - left, height: bottom - top }
}

/**
 * @param {import("prosemirror-view").EditorView} view
 * @param {HTMLElement} editorEl
 */
export function setupContextMenu(view, editorEl) {
  let menuEl = null
  let floatingEl = null
  let hideFloatingTimer = null

  function removeMenu() {
    if (menuEl) {
      menuEl.remove()
      menuEl = null
    }
  }

  function hideFloating() {
    if (floatingEl) {
      floatingEl.classList.remove("visible")
    }
  }

  function showFloating() {
    const state = view.state
    const { from, to, empty } = state.selection
    if (empty || from === to) {
      hideFloating()
      return
    }
    if (!floatingEl) {
      floatingEl = buildFloatingToolbar(view)
      document.body.appendChild(floatingEl)
    }

    const s1 = view.coordsAtPos(from)
    const s2 = view.coordsAtPos(to)
    const rect = unionRect(s1, s2)
    const bar = floatingEl
    bar.classList.add("visible")
    bar.style.position = "fixed"
    bar.style.zIndex = "480"
    const bw = bar.offsetWidth || 280
    const bh = bar.offsetHeight || 36
    let left = rect.left + rect.width / 2 - bw / 2
    let top = rect.top - bh - 8
    if (top < 8) top = rect.bottom + 8
    if (left < 8) left = 8
    if (left + bw > window.innerWidth - 8) left = window.innerWidth - bw - 8
    bar.style.left = `${left}px`
    bar.style.top = `${top}px`
  }

  function onContextMenu(event) {
    if (!editorEl.contains(event.target)) return
    const pm = view.dom
    if (!pm.contains(event.target)) return

    const detected = detectContext(view, event)
    if (!detected) return

    event.preventDefault()
    event.stopPropagation()
    ensureSelectionAtClick(view, event, detected)

    removeMenu()
    menuEl = buildMenuContent(view, detected.kind, detected.ctx)
    placeFixed(menuEl, event.clientX, event.clientY)
    hideFloating()
  }

  function onDocMouseDown(event) {
    if (menuEl && !menuEl.contains(event.target)) {
      removeMenu()
    }
    if (floatingEl && !floatingEl.contains(event.target) && !view.dom.contains(event.target)) {
      hideFloating()
    }
  }

  function onKeyDown(event) {
    if (event.key === "Escape") {
      removeMenu()
      hideFloating()
    }
  }

  function onMouseUp(event) {
    if (event.button === 2) return
    if (menuEl && menuEl.contains(event.target)) return
    clearTimeout(hideFloatingTimer)
    hideFloatingTimer = setTimeout(() => {
      if (!view.dom.contains(event.target)) {
        hideFloating()
        return
      }
      const sel = view.state.selection
      if (sel.empty) {
        hideFloating()
        return
      }
      // Don't show floating toolbar for node selections (images, formulas)
      if (sel instanceof NodeSelection) {
        hideFloating()
        return
      }
      showFloating()
    }, 10)
  }

  // Prevent ProseMirror from changing selection on right-click
  view.dom.addEventListener("mousedown", (e) => {
    if (e.button === 2) {
      // Right click — don't let ProseMirror handle it
      e.stopPropagation()
    }
  }, true)

  view.dom.addEventListener("contextmenu", onContextMenu)
  document.addEventListener("mousedown", onDocMouseDown, true)
  document.addEventListener("keydown", onKeyDown, true)
  editorEl.addEventListener("mouseup", onMouseUp)

  return () => {
    view.dom.removeEventListener("contextmenu", onContextMenu)
    document.removeEventListener("mousedown", onDocMouseDown, true)
    document.removeEventListener("keydown", onKeyDown, true)
    editorEl.removeEventListener("mouseup", onMouseUp)
    removeMenu()
    if (floatingEl) {
      floatingEl.remove()
      floatingEl = null
    }
  }
}
