import { toggleMark, setBlockType, wrapIn, lift } from "prosemirror-commands"
import { undo, redo } from "prosemirror-history"
import { wrapInList } from "prosemirror-schema-list"
import { addColumnAfter, addColumnBefore, addRowAfter, addRowBefore, deleteColumn, deleteRow, deleteTable, mergeCells, splitCell, toggleHeaderRow, toggleHeaderColumn } from "prosemirror-tables"
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
  toolbarEl.appendChild(groupFormat)

  toolbarEl.appendChild(createSeparator())

  // === Group: Структура ===
  const groupStruct = createGroup("Блок")
  const blocks = [
    ["H1", "Заголовок 1-го уровня", setBlockType(schema.nodes.heading, { level: 1 })],
    ["H2", "Заголовок 2-го уровня", setBlockType(schema.nodes.heading, { level: 2 })],
    ["H3", "Заголовок 3-го уровня", setBlockType(schema.nodes.heading, { level: 3 })],
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
  groupInsert.appendChild(createButton("⊞", "Таблицу 3×3", insertTable, view))
  groupInsert.appendChild(createButton("―", "Горизонтальную линию", insertHR, view))
  toolbarEl.appendChild(groupInsert)

  toolbarEl.appendChild(createSeparator())

  // === Group: Документ ===
  const groupDoc = createGroup("Документ")
  groupDoc.appendChild(createButton("↩", "Отменить (Ctrl+Z)", undo, view))
  groupDoc.appendChild(createButton("↪", "Вернуть (Ctrl+Y)", redo, view))
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
