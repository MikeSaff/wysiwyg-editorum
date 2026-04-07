import { toggleMark, setBlockType, wrapIn, lift } from "prosemirror-commands"
import { wrapInList } from "prosemirror-schema-list"
import { addColumnAfter, addColumnBefore, addRowAfter, addRowBefore, deleteColumn, deleteRow, deleteTable } from "prosemirror-tables"
import { schema } from "./schema.js"

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

function insertMathBlock(state, dispatch) {
  const latex = prompt("LaTeX формула:", "E = mc^2")
  if (!latex) return false
  const node = schema.nodes.math_block.create({ latex })
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
  const rows = 3, cols = 3
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
  if (dispatch) dispatch(state.tr.replaceSelectionWith(table))
  return true
}

function insertHR(state, dispatch) {
  const node = schema.nodes.horizontal_rule.create()
  if (dispatch) dispatch(state.tr.replaceSelectionWith(node))
  return true
}

export function buildToolbar(view, toolbarEl) {
  toolbarEl.innerHTML = ""

  // Marks
  const marks = [
    ["B", "Жирный (Ctrl+B)", toggleMark(schema.marks.bold), { className: "mark-bold" }],
    ["I", "Курсив (Ctrl+I)", toggleMark(schema.marks.italic), { className: "mark-italic" }],
    ["U", "Подчёркнутый", toggleMark(schema.marks.underline), { className: "mark-underline" }],
    ["S", "Зачёркнутый", toggleMark(schema.marks.strikethrough), { className: "mark-strike" }],
    ["x²", "Надстрочный", toggleMark(schema.marks.superscript)],
    ["x₂", "Подстрочный", toggleMark(schema.marks.subscript)],
    ["</>", "Код", toggleMark(schema.marks.code)],
    ["🔗", "Ссылка", (state, dispatch) => {
      if (markActive(state, schema.marks.link)) {
        return toggleMark(schema.marks.link)(state, dispatch)
      }
      const href = prompt("URL:", "https://")
      if (!href) return false
      return toggleMark(schema.marks.link, { href })(state, dispatch)
    }],
  ]

  marks.forEach(([label, title, cmd, opts]) => {
    toolbarEl.appendChild(createButton(label, title, cmd, view, opts || {}))
  })

  toolbarEl.appendChild(createSeparator())

  // Block types
  const blocks = [
    ["H1", "Заголовок 1", setBlockType(schema.nodes.heading, { level: 1 })],
    ["H2", "Заголовок 2", setBlockType(schema.nodes.heading, { level: 2 })],
    ["H3", "Заголовок 3", setBlockType(schema.nodes.heading, { level: 3 })],
    ["¶", "Абзац", setBlockType(schema.nodes.paragraph)],
    ["❝", "Цитата", wrapIn(schema.nodes.blockquote)],
    ["PRE", "Блок кода", setBlockType(schema.nodes.code_block)],
  ]

  blocks.forEach(([label, title, cmd]) => {
    toolbarEl.appendChild(createButton(label, title, cmd, view))
  })

  toolbarEl.appendChild(createSeparator())

  // Lists
  toolbarEl.appendChild(createButton("• ", "Маркированный список", wrapInList(schema.nodes.bullet_list), view))
  toolbarEl.appendChild(createButton("1.", "Нумерованный список", wrapInList(schema.nodes.ordered_list), view))
  toolbarEl.appendChild(createButton("⇤", "Убрать вложенность", lift, view))

  toolbarEl.appendChild(createSeparator())

  // Insert
  toolbarEl.appendChild(createButton("∑", "Формула (блок)", insertMathBlock, view))
  toolbarEl.appendChild(createButton("α", "Формула (inline)", insertMathInline, view))
  toolbarEl.appendChild(createButton("🖼", "Изображение", insertImage, view))
  toolbarEl.appendChild(createButton("▦", "Таблица 3×3", insertTable, view))
  toolbarEl.appendChild(createButton("—", "Горизонтальная линия", insertHR, view))

  toolbarEl.appendChild(createSeparator())

  // Table operations (shown always, work only when in table)
  toolbarEl.appendChild(createButton("+Col→", "Добавить столбец справа", addColumnAfter, view))
  toolbarEl.appendChild(createButton("+Row↓", "Добавить строку снизу", addRowAfter, view))
  toolbarEl.appendChild(createButton("−Col", "Удалить столбец", deleteColumn, view))
  toolbarEl.appendChild(createButton("−Row", "Удалить строку", deleteRow, view))
  toolbarEl.appendChild(createButton("×Tbl", "Удалить таблицу", deleteTable, view))
}
