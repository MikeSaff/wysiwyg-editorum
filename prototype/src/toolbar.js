import { Fragment } from "prosemirror-model"
import { toggleMark, setBlockType, wrapIn, lift } from "prosemirror-commands"
import { undo, redo } from "prosemirror-history"
import { wrapInList } from "prosemirror-schema-list"
import { addColumnAfter, addColumnBefore, addRowAfter, addRowBefore, deleteColumn, deleteRow, deleteTable, mergeCells, splitCell, toggleHeaderRow, toggleHeaderColumn } from "prosemirror-tables"
import { schema, newNodeId } from "./schema.js"
import { exportToHtml } from "./export-html.js"
import { insertFormulaImageTransaction, isValidFormulaImageSrc } from "./formula-image-insert.js"

// === Custom confirm modal (replaces native confirm() — Chrome DevTools intercepts native dialogs) ===
function showConfirmModal(title, message, onConfirm) {
  // Remove existing modal if any
  const existing = document.getElementById("pm-confirm-modal")
  if (existing) existing.remove()

  const overlay = document.createElement("div")
  overlay.id = "pm-confirm-modal"
  overlay.className = "pm-confirm-overlay"
  overlay.innerHTML = `
    <div class="pm-confirm-dialog" role="dialog" aria-modal="true">
      <h3 class="pm-confirm-title"></h3>
      <p class="pm-confirm-message"></p>
      <div class="pm-confirm-actions">
        <button class="pm-confirm-cancel" type="button">Отмена</button>
        <button class="pm-confirm-ok" type="button">OK</button>
      </div>
    </div>
  `
  overlay.querySelector(".pm-confirm-title").textContent = title
  overlay.querySelector(".pm-confirm-message").textContent = message

  const okBtn = overlay.querySelector(".pm-confirm-ok")
  const cancelBtn = overlay.querySelector(".pm-confirm-cancel")

  const close = () => overlay.remove()

  okBtn.addEventListener("click", () => {
    close()
    onConfirm()
  })
  cancelBtn.addEventListener("click", close)
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close()
  })

  document.body.appendChild(overlay)
  queueMicrotask(() => okBtn.focus())
}

/**
 * @returns {Promise<{ src: string, alt: string, number: string | null, latex_hint: string, block: boolean } | null>}
 */
function openFormulaImageModal() {
  return new Promise((resolve) => {
    document.getElementById("pm-formula-image-modal")?.remove()

    const overlay = document.createElement("div")
    overlay.id = "pm-formula-image-modal"
    overlay.className = "pm-confirm-overlay pm-formula-image-overlay"
    overlay.setAttribute("role", "dialog")
    overlay.setAttribute("aria-modal", "true")
    overlay.innerHTML = `
      <div class="pm-formula-image-dialog">
        <h3 class="pm-formula-image-title">Формула-картинка</h3>
        <div class="pm-formula-image-tabs">
          <button type="button" class="pm-formula-image-tab active" data-tab="file">Загрузить файл</button>
          <button type="button" class="pm-formula-image-tab" data-tab="url">По URL</button>
        </div>
        <div class="pm-formula-image-panel" data-panel="file">
          <input type="file" class="pm-formula-image-file" accept="image/*" />
        </div>
        <div class="pm-formula-image-panel" data-panel="url" style="display:none">
          <label class="pm-formula-image-label">URL (https://… или data:image/…)</label>
          <input type="text" class="pm-formula-image-url" placeholder="https://..." />
        </div>
        <label class="pm-formula-image-label">Alt (доступность)</label>
        <input type="text" class="pm-formula-image-alt" placeholder="Описание" />
        <label class="pm-formula-image-label">Номер формулы (необязательно)</label>
        <input type="text" class="pm-formula-image-number" placeholder="напр. 1 или 2.3" />
        <label class="pm-formula-image-label">LaTeX-hint (необязательно)</label>
        <input type="text" class="pm-formula-image-latex" placeholder="\\alpha+\\beta" />
        <div class="pm-formula-image-mode">
          <label><input type="radio" name="fi-mode" value="block" checked /> Блок (display)</label>
          <label><input type="radio" name="fi-mode" value="inline" /> Инлайн</label>
        </div>
        <p class="pm-formula-image-error" style="display:none;color:#c62828;font-size:13px;margin:8px 0 0;"></p>
        <div class="pm-confirm-actions">
          <button type="button" class="pm-formula-image-cancel pm-confirm-cancel">Отмена</button>
          <button type="button" class="pm-formula-image-ok pm-confirm-ok">OK</button>
        </div>
      </div>
    `

    const tabBtns = overlay.querySelectorAll(".pm-formula-image-tab")
    const panels = overlay.querySelectorAll(".pm-formula-image-panel")
    const fileInput = overlay.querySelector(".pm-formula-image-file")
    const urlInput = overlay.querySelector(".pm-formula-image-url")
    const altInput = overlay.querySelector(".pm-formula-image-alt")
    const numInput = overlay.querySelector(".pm-formula-image-number")
    const latexInput = overlay.querySelector(".pm-formula-image-latex")
    const errEl = overlay.querySelector(".pm-formula-image-error")
    let activeTab = "file"
    let fileDataUrl = ""

    const showTab = (name) => {
      activeTab = name
      tabBtns.forEach((b) => {
        b.classList.toggle("active", b.getAttribute("data-tab") === name)
      })
      panels.forEach((p) => {
        p.style.display = p.getAttribute("data-panel") === name ? "block" : "none"
      })
    }

    tabBtns.forEach((btn) => {
      btn.addEventListener("click", () => showTab(btn.getAttribute("data-tab") || "file"))
    })

    fileInput.addEventListener("change", () => {
      const f = fileInput.files?.[0]
      if (!f) {
        fileDataUrl = ""
        return
      }
      const r = new FileReader()
      r.onload = () => {
        fileDataUrl = String(r.result || "")
        if (!altInput.value) altInput.value = f.name || ""
      }
      r.readAsDataURL(f)
    })

    const done = (payload) => {
      overlay.remove()
      resolve(payload)
    }

    overlay.querySelector(".pm-formula-image-cancel").addEventListener("click", () => done(null))
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) done(null)
    })

    overlay.querySelector(".pm-formula-image-ok").addEventListener("click", () => {
      errEl.style.display = "none"
      errEl.textContent = ""
      let src = ""
      if (activeTab === "file") {
        src = fileDataUrl
        if (!src) {
          errEl.textContent = "Выберите файл изображения."
          errEl.style.display = "block"
          return
        }
      } else {
        src = (urlInput.value || "").trim()
        if (!isValidFormulaImageSrc(src)) {
          errEl.textContent = "Нужен URL http(s) или data:image/…"
          errEl.style.display = "block"
          return
        }
      }
      const block = overlay.querySelector('input[name="fi-mode"]:checked')?.value !== "inline"
      const numRaw = (numInput.value || "").trim()
      done({
        src,
        alt: (altInput.value || "").trim(),
        number: numRaw ? numRaw : null,
        latex_hint: (latexInput.value || "").trim(),
        block
      })
    })

    document.body.appendChild(overlay)
    queueMicrotask(() => fileInput.focus())
  })
}

function insertFormulaImageFromToolbar(view) {
  openFormulaImageModal().then((result) => {
    if (!result) return
    const tr = insertFormulaImageTransaction(view.state, view.state.selection.from, {
      src: result.src,
      alt: result.alt,
      number: result.number,
      latex_hint: result.latex_hint,
      block: result.block,
      fromToolbar: true
    })
    if (tr) view.dispatch(tr)
    view.focus()
  })
}

function markActive(state, type) {
  const { from, $from, to, empty } = state.selection
  if (empty) return !!type.isInSet(state.storedMarks || $from.marks())
  return state.doc.rangeHasMark(from, to, type)
}

function blockActive(state, type, attrs) {
  const { $from, to } = state.selection
  let found = false
  state.doc.nodesBetween($from.pos, to, node => {
    if (node.type === type) {
      if (!attrs || Object.keys(attrs).every(k => node.attrs[k] === attrs[k])) {
        found = true
      }
    }
  })
  return found
}

function createButton(label, title, command, view, options = {}) {
  const btn = document.createElement("button")
  btn.textContent = label
  btn.title = title
  btn.className = "toolbar-btn"
  if (options.className) btn.classList.add(options.className)

  btn.addEventListener("mousedown", e => {
    e.preventDefault()
    command(view.state, view.dispatch, view)
    view.focus()
  })

  return btn
}

function createSeparator() {
  const sep = document.createElement("span")
  sep.className = "toolbar-separator"
  return sep
}

function headingAttrs(state, level) {
  const { $from } = state.selection
  const block = $from.node($from.depth)
  if (block.type === schema.nodes.heading) {
    return {
      level,
      id: block.attrs.id || newNodeId(),
      align: block.attrs.align ?? null,
      sectionType: block.attrs.sectionType ?? null
    }
  }
  return { level, id: newNodeId(), align: null, sectionType: null }
}

function insertMathBlock(state, dispatch) {
  const latex = prompt("LaTeX формула:", "E = mc^2")
  if (!latex) return false
  const node = schema.nodes.math_block.create({ latex, id: newNodeId() })
  if (dispatch) dispatch(state.tr.replaceSelectionWith(node))
  return true
}

function insertMathInline(state, dispatch) {
  const latex = prompt("Inline LaTeX:", "\\alpha + \\beta")
  if (!latex) return false
  const node = schema.nodes.math_inline.create({ latex })
  if (dispatch) dispatch(state.tr.replaceSelectionWith(node))
  return true
}

function insertImage(state, dispatch) {
  const src = prompt("URL изображения:", "https://via.placeholder.com/400x300")
  if (!src) return false
  const alt = prompt("Alt текст:", "") || ""
  const node = schema.nodes.image.create({ src, alt })
  if (dispatch) dispatch(state.tr.replaceSelectionWith(node))
  return true
}

function insertTable(state, dispatch) {
  const rows = 3
  const cols = 3
  const cells = []
  for (let r = 0; r < rows; r++) {
    const rowCells = []
    for (let c = 0; c < cols; c++) {
      const cellType = r === 0 ? schema.nodes.table_header : schema.nodes.table_cell
      rowCells.push(cellType.createAndFill())
    }
    cells.push(schema.nodes.table_row.create(null, rowCells))
  }
  const table = schema.nodes.table.create(null, cells)
  const wrap = schema.nodes.table_block.create({ id: newNodeId() }, Fragment.from(table))
  if (dispatch) dispatch(state.tr.replaceSelectionWith(wrap))
  return true
}

function insertFigureBlock(state, dispatch) {
  const src = prompt("URL изображения:", "https://via.placeholder.com/400x300")
  if (!src) return false
  const img = schema.nodes.figure_image.create({ src, alt: "" })
  const fb = schema.nodes.figure_block.create({ id: newNodeId() }, img)
  if (dispatch) dispatch(state.tr.replaceSelectionWith(fb))
  return true
}

function insertCitationRef(state, dispatch) {
  const raw = prompt("ID цитат (через запятую):", "1,2")
  const ref_ids = raw ? raw.split(",").map((s) => s.trim()).filter(Boolean) : []
  const node = schema.nodes.citation_ref.create({ ref_ids })
  if (dispatch) dispatch(state.tr.replaceSelectionWith(node))
  return true
}

function insertFootnoteRef(state, dispatch) {
  const footnote_id = prompt("ID сноски:", "fn1") || ""
  const node = schema.nodes.footnote_ref.create({ footnote_id })
  if (dispatch) dispatch(state.tr.replaceSelectionWith(node))
  return true
}

function insertHR(state, dispatch) {
  const node = schema.nodes.horizontal_rule.create()
  if (dispatch) dispatch(state.tr.replaceSelectionWith(node))
  return true
}

export function buildToolbar(view, toolbarEl) {
  toolbarEl.innerHTML = ""

  // === Group: Форматирование текста ===
  const groupFormat = createGroup("Текст")
  const marks = [
    ["𝐁", "Жирный (Ctrl+B)", toggleMark(schema.marks.bold), { className: "mark-bold" }],
    ["𝐼", "Курсив (Ctrl+I)", toggleMark(schema.marks.italic), { className: "mark-italic" }],
    ["U̲", "Подчёркнутый (Ctrl+U)", toggleMark(schema.marks.underline), { className: "mark-underline" }],
    ["S̶", "Зачёркнутый", toggleMark(schema.marks.strikethrough), { className: "mark-strike" }],
    ["x²", "Надстрочный", toggleMark(schema.marks.superscript)],
    ["x₂", "Подстрочный", toggleMark(schema.marks.subscript)],
    ["⟨⟩", "Код", toggleMark(schema.marks.code)],
    ["🔗", "Вставить ссылку", (state, dispatch) => {
      if (markActive(state, schema.marks.link)) {
        return toggleMark(schema.marks.link)(state, dispatch)
      }
      const href = prompt("URL:", "https://")
      if (!href) return false
      return toggleMark(schema.marks.link, { href })(state, dispatch)
    }],
  ]
  marks.forEach(([label, title, cmd, opts]) => {
    groupFormat.appendChild(createButton(label, title, cmd, view, opts || {}))
  })
  groupFormat.appendChild(createButton("🌐", "Язык фрагмента (lang)", (state, dispatch) => {
    const lang = prompt("Код языка (BCP 47), напр. en:", "en")
    if (!lang) return false
    return toggleMark(schema.marks.lang, { lang })(state, dispatch)
  }, view))
  toolbarEl.appendChild(groupFormat)

  toolbarEl.appendChild(createSeparator())

  // === Group: Структура ===
  const groupStruct = createGroup("Блок")
  const blocks = [
    ["H1", "Заголовок 1-го уровня", (s, d) => setBlockType(schema.nodes.heading, headingAttrs(s, 1))(s, d)],
    ["H2", "Заголовок 2-го уровня", (s, d) => setBlockType(schema.nodes.heading, headingAttrs(s, 2))(s, d)],
    ["H3", "Заголовок 3-го уровня", (s, d) => setBlockType(schema.nodes.heading, headingAttrs(s, 3))(s, d)],
    ["¶", "Обычный абзац", setBlockType(schema.nodes.paragraph)],
    ["❝", "Цитата", wrapIn(schema.nodes.blockquote)],
    ["⌨", "Блок кода", setBlockType(schema.nodes.code_block)],
  ]
  blocks.forEach(([label, title, cmd]) => {
    groupStruct.appendChild(createButton(label, title, cmd, view))
  })
  toolbarEl.appendChild(groupStruct)

  toolbarEl.appendChild(createSeparator())

  // === Group: Списки ===
  const groupList = createGroup("Список")
  groupList.appendChild(createButton("•", "Маркированный список", wrapInList(schema.nodes.bullet_list), view))
  groupList.appendChild(createButton("1.", "Нумерованный список", wrapInList(schema.nodes.ordered_list), view))
  groupList.appendChild(createButton("⇤", "Уменьшить отступ", lift, view))
  toolbarEl.appendChild(groupList)

  toolbarEl.appendChild(createSeparator())

  toolbarEl.appendChild(createSeparator())

  // === Group: Стиль абзаца ===
  const groupStyle = createGroup("Стиль")
  const paraStyles = [
    ["Рис.", "Подпись рисунка (Рис. N. Название)", "fig-caption"],
    ["Табл.", "Заголовок таблицы (Табл. N. Название)", "table-caption"],
    ["№Т", "Номер таблицы (справа)", "table-number"],
    ["¶", "Обычный абзац (сбросить стиль)", null],
  ]
  paraStyles.forEach(([label, title, styleType]) => {
    groupStyle.appendChild(createButton(label, title, (state, dispatch) => {
      const { from, to } = state.selection
      let tr = state.tr
      state.doc.nodesBetween(from, to, (node, pos) => {
        if (node.type.name === "paragraph") {
          tr = tr.setNodeMarkup(pos, null, { ...node.attrs, styleType })
        }
      })
      if (dispatch) dispatch(tr)
      return true
    }, view))
  })
  toolbarEl.appendChild(groupStyle)

  toolbarEl.appendChild(createSeparator())

  // === Group: Выравнивание ===
  const groupAlign = createGroup("Выравнивание")
  const alignCommands = [
    ["⇤", "По левому краю", "left"],
    ["⇔", "По центру", "center"],
    ["⇥", "По правому краю", "right"],
    ["☰", "По ширине", "justify"],
  ]
  alignCommands.forEach(([label, title, align]) => {
    groupAlign.appendChild(createButton(label, title, (state, dispatch) => {
      const { from, to } = state.selection
      let tr = state.tr
      state.doc.nodesBetween(from, to, (node, pos) => {
        if (node.type.name === "paragraph" || node.type.name === "heading") {
          tr = tr.setNodeMarkup(pos, null, { ...node.attrs, align })
        }
      })
      if (dispatch) dispatch(tr)
      return true
    }, view))
  })
  toolbarEl.appendChild(groupAlign)

  toolbarEl.appendChild(createSeparator())

  // === Group: Вставка ===
  const groupInsert = createGroup("Вставить")
  groupInsert.appendChild(createButton("∑", "Формулу (блок, LaTeX)", insertMathBlock, view))
  groupInsert.appendChild(createButton("𝛼", "Формулу (в строке)", insertMathInline, view))
  groupInsert.appendChild(createButton("🖼∑", "Формула-картинка (скрин / ChemDraw)", () => {
    insertFormulaImageFromToolbar(view)
    return true
  }, view))
  groupInsert.appendChild(createButton("🖼", "Изображение (URL)", insertImage, view))
  groupInsert.appendChild(createButton("📁", "Изображение (файл)", (state, dispatch) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/*"
    input.onchange = (e) => {
      const file = e.target.files[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        const node = schema.nodes.image.create({ src: ev.target.result, alt: file.name })
        const tr = view.state.tr.replaceSelectionWith(node)
        view.dispatch(tr)
      }
      reader.readAsDataURL(file)
    }
    input.click()
    return true
  }, view))
  groupInsert.appendChild(createButton("⊞", "Таблицу 3×3 (обёртка table_block)", insertTable, view))
  groupInsert.appendChild(createButton("🖼‍⬚", "Рисунок (figure_block)", insertFigureBlock, view))
  groupInsert.appendChild(createButton("[·]", "Цитирование (citation_ref)", insertCitationRef, view))
  groupInsert.appendChild(createButton("⁎", "Сноска (footnote_ref)", insertFootnoteRef, view))
  groupInsert.appendChild(createButton("―", "Горизонтальную линию", insertHR, view))
  toolbarEl.appendChild(groupInsert)

  toolbarEl.appendChild(createSeparator())

  // === Group: Документ ===
  const groupDoc = createGroup("Документ")
  groupDoc.appendChild(createButton("↩", "Отменить (Ctrl+Z)", undo, view))
  groupDoc.appendChild(createButton("↪", "Вернуть (Ctrl+Y)", redo, view))
  groupDoc.appendChild(createButton("🗑", "Новый документ (очистить всё)", (state, dispatch) => {
    showConfirmModal("Очистить документ?", "Автосохранение будет удалено безвозвратно.", () => {
      localStorage.removeItem("wysiwyg-editorum-autosave")
      location.reload()
    })
    return true
  }, view))
  groupDoc.appendChild(createButton("💾", "Сохранить документ (скачать JSON)", (state, dispatch) => {
    const json = JSON.stringify(state.doc.toJSON(), null, 2)
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "document.json"
    a.click()
    URL.revokeObjectURL(url)
    return true
  }, view))
  groupDoc.appendChild(createButton("📄 HTML", "Экспорт HTML5 + MathJax (скачать)", (state, dispatch) => {
    const html = exportToHtml(state.doc.toJSON(), schema)
    const blob = new Blob([html], { type: "text/html;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "document.html"
    a.click()
    URL.revokeObjectURL(url)
    return true
  }, view))
  groupDoc.appendChild(createButton("📂", "Открыть документ (JSON)", (state, dispatch) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".json"
    input.onchange = (e) => {
      const file = e.target.files[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        try {
          const json = JSON.parse(ev.target.result)
          const doc = view.state.schema.nodeFromJSON(json)
          const tr = view.state.tr.replaceWith(0, view.state.doc.content.size, doc.content)
          view.dispatch(tr)
        } catch (err) {
          alert("Ошибка загрузки: " + err.message)
        }
      }
      reader.readAsText(file)
    }
    input.click()
    return true
  }, view))
  toolbarEl.appendChild(groupDoc)

  // === Group: Таблица (скрытая, появляется при курсоре в таблице) ===
  const groupTable = createGroup("Таблица")
  groupTable.id = "table-toolbar"
  groupTable.style.display = "none"
  groupTable.appendChild(createSeparator())
  groupTable.appendChild(createButton("+ столбец", "Добавить столбец справа от текущего", addColumnAfter, view))
  groupTable.appendChild(createButton("+ строку", "Добавить строку ниже текущей", addRowAfter, view))
  groupTable.appendChild(createButton("− столбец", "Удалить текущий столбец", deleteColumn, view))
  groupTable.appendChild(createButton("− строку", "Удалить текущую строку", deleteRow, view))
  groupTable.appendChild(createButton("✕ таблицу", "Удалить всю таблицу", deleteTable, view))
  groupTable.appendChild(createButton("⊞ объед.", "Объединить выделенные ячейки", mergeCells, view))
  groupTable.appendChild(createButton("⊟ разд.", "Разделить ячейку", splitCell, view))
  groupTable.appendChild(createButton("▤ заголовок", "Переключить строку-заголовок", toggleHeaderRow, view))
  toolbarEl.appendChild(groupTable)

  // === Update table toolbar visibility on selection change ===
  updateTableToolbar(view)
}

function createGroup(label) {
  const group = document.createElement("div")
  group.className = "toolbar-group"
  const groupLabel = document.createElement("span")
  groupLabel.className = "toolbar-group-label"
  groupLabel.textContent = label
  group.appendChild(groupLabel)
  return group
}

/**
 * Show/hide table toolbar based on cursor position.
 * Called from EditorView.dispatchTransaction.
 */
export function updateTableToolbar(view) {
  const tableToolbar = document.getElementById("table-toolbar")
  if (!tableToolbar) return

  // Check if cursor is inside a table
  const { $from } = view.state.selection
  let inTable = false
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name === "table") {
      inTable = true
      break
    }
  }
  tableToolbar.style.display = inTable ? "flex" : "none"
}
