import { EditorState } from "prosemirror-state"
import { EditorView } from "prosemirror-view"
import { DOMParser as ProseDOMParser, DOMSerializer, Slice } from "prosemirror-model"
import { keymap } from "prosemirror-keymap"
import { baseKeymap, toggleMark } from "prosemirror-commands"
import { history, undo, redo } from "prosemirror-history"
import { inputRules, wrappingInputRule, textblockTypeInputRule, smartQuotes, emDash, ellipsis } from "prosemirror-inputrules"
import { dropCursor } from "prosemirror-dropcursor"
import { gapCursor } from "prosemirror-gapcursor"
import { tableEditing, columnResizing, goToNextCell, fixTables } from "prosemirror-tables"
import { splitListItem, liftListItem, sinkListItem } from "prosemirror-schema-list"

import { schema } from "./schema.js"
import { buildToolbar, updateTableToolbar } from "./toolbar.js"
import { setupContextMenu } from "./context-menu.js"
import { cleanWordHtml } from "./word-paste.js"
import { importDocx } from "./word-import.js"
import "./styles.css"

// === Input rules (markdown-like shortcuts) ===
function buildInputRules() {
  const rules = [
    ...smartQuotes,
    ellipsis,
    emDash,
    // # Heading
    textblockTypeInputRule(/^(#{1,4})\s$/, schema.nodes.heading, match => ({ level: match[1].length })),
    // > Blockquote
    wrappingInputRule(/^\s*>\s$/, schema.nodes.blockquote),
    // - or * Bullet list
    wrappingInputRule(/^\s*([-+*])\s$/, schema.nodes.bullet_list),
    // 1. Ordered list
    wrappingInputRule(/^(\d+)\.\s$/, schema.nodes.ordered_list, match => ({ order: +match[1] }),
      (match, node) => node.childCount + node.attrs.order === +match[1]),
    // ``` Code block
    textblockTypeInputRule(/^```$/, schema.nodes.code_block),
    // --- Horizontal rule
    new inputRules.constructor([]).constructor ? null : null, // placeholder
  ].filter(Boolean)

  return inputRules({ rules })
}

// === Keymaps ===
function buildKeymaps() {
  const keys = {
    "Mod-z": undo,
    "Mod-y": redo,
    "Shift-Mod-z": redo,
    "Mod-b": toggleMark(schema.marks.bold),
    "Mod-i": toggleMark(schema.marks.italic),
    "Mod-u": toggleMark(schema.marks.underline),
    "Tab": goToNextCell(1),
    "Shift-Tab": goToNextCell(-1),
    "Enter": splitListItem(schema.nodes.list_item),
    "Mod-[": liftListItem(schema.nodes.list_item),
    "Mod-]": sinkListItem(schema.nodes.list_item),
  }
  return keymap(keys)
}

// === Initial document ===
const initialDoc = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: "WYSIWYG Editorum" }]
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Это " },
        { type: "text", text: "прототип", marks: [{ type: "bold" }] },
        { type: "text", text: " структурного редактора научных публикаций. Вставьте текст из " },
        { type: "text", text: "Word", marks: [{ type: "italic" }] },
        { type: "text", text: " (Ctrl+V) или начните набирать." }
      ]
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Формулы" }]
    },
    {
      type: "paragraph",
      content: [{ type: "text", text: "Нажмите кнопку ∑ для блочной или α для inline формулы." }]
    },
    {
      type: "math_block",
      attrs: { latex: "E = mc^2", label: "(1)" }
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Таблицы" }]
    },
    {
      type: "paragraph",
      content: [{ type: "text", text: "Нажмите ▦ для вставки таблицы 3×3. Можно добавлять/удалять строки и столбцы." }]
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Markdown-шорткаты" }]
    },
    {
      type: "paragraph",
      content: [{ type: "text", text: "# → H1, ## → H2, ### → H3, > → цитата, - → список, 1. → нумерованный, ``` → код" }]
    }
  ]
}

// === Navigation panel ===
let _editorView = null  // Module-level reference

function updateNavigation(state) {
  const navItems = document.getElementById("nav-items")
  if (!navItems) return

  const headings = []
  state.doc.forEach((node, offset) => {
    if (node.type.name === "heading") {
      const level = node.attrs.level || 1
      const text = node.textContent
      if (text.trim()) {
        headings.push({ level, text: text.substring(0, 60), pos: offset })
      }
    }
  })

  navItems.innerHTML = headings.map(h =>
    `<div class="nav-item level-${h.level}" data-pos="${h.pos}">${escapeHtmlNav(h.text)}</div>`
  ).join("")
}

function escapeHtmlNav(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

// Event delegation for nav clicks — works even after innerHTML updates
document.getElementById("nav-items")?.addEventListener("click", (e) => {
  const item = e.target.closest(".nav-item")
  if (!item || !_editorView) return

  const pos = parseInt(item.dataset.pos)
  if (isNaN(pos)) return

  try {
    _editorView.focus()
    const resolvedPos = _editorView.state.doc.resolve(Math.min(pos + 1, _editorView.state.doc.content.size))
    const selection = _editorView.state.selection.constructor.near(resolvedPos)
    const tr = _editorView.state.tr.setSelection(selection)
    _editorView.dispatch(tr)

    // Scroll heading to top third of viewport
    const coords = _editorView.coordsAtPos(pos + 1)
    if (coords) {
      const viewportHeight = window.innerHeight
      const targetY = coords.top - viewportHeight * 0.15  // 15% from top
      window.scrollTo({ top: window.scrollY + (coords.top - window.innerHeight * 0.15), behavior: "smooth" })
    }
  } catch (err) {
    console.warn("Nav click error:", err)
  }
})

// === Output panel ===
function updateOutput(state) {
  const jsonEl = document.getElementById("json-output")
  const htmlEl = document.getElementById("html-output")

  // JSON output
  const json = state.doc.toJSON()
  jsonEl.textContent = JSON.stringify(json, null, 2)

  // HTML output
  const fragment = DOMSerializer.fromSchema(schema).serializeFragment(state.doc.content)
  const div = document.createElement("div")
  div.appendChild(fragment)
  htmlEl.textContent = div.innerHTML
}

// === Tab switching ===
function setupTabs() {
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"))
      tab.classList.add("active")
      const target = tab.dataset.tab
      document.getElementById("json-output").style.display = target === "json" ? "block" : "none"
      document.getElementById("html-output").style.display = target === "html" ? "block" : "none"
    })
  })
}

// === Init ===
function init() {
  const toolbarEl = document.getElementById("toolbar")
  const editorEl = document.getElementById("editor")

  const doc = schema.nodeFromJSON(initialDoc)

  const state = EditorState.create({
    doc,
    plugins: [
      buildInputRules(),
      buildKeymaps(),
      keymap(baseKeymap),
      history(),
      dropCursor(),
      gapCursor(),
      columnResizing(),
      tableEditing(),
    ]
  })

  // Fix tables if needed
  const fix = fixTables(state)

  const view = new EditorView(editorEl, {
    state: fix ? fix.state : state,
    dispatchTransaction(tr) {
      const newState = view.state.apply(tr)
      view.updateState(newState)
      updateOutput(newState)
      updateTableToolbar(view)
    },
    handlePaste(view, event, slice) {
      // Intercept paste to clean Word HTML before ProseMirror parses it
      const clipboardData = event.clipboardData || window.clipboardData
      if (!clipboardData) return false

      const html = clipboardData.getData("text/html")
      if (!html) return false

      // Check if this looks like Word HTML
      const isWord = html.includes("urn:schemas-microsoft-com:office") ||
                     html.includes("xmlns:w=") ||
                     html.includes("class=\"Mso") ||
                     html.includes("mso-") ||
                     html.includes("<o:p>")

      if (isWord) {
        event.preventDefault()
        console.log("=== WORD PASTE RAW HTML ===")
        console.log(html)
        console.log("=== END RAW HTML ===")

        const cleaned = cleanWordHtml(html)

        // Parse cleaned HTML into ProseMirror content
        const tempDiv = document.createElement("div")
        tempDiv.innerHTML = cleaned

        const domParser = ProseDOMParser.fromSchema(schema)
        const doc = domParser.parse(tempDiv)
        const tr = view.state.tr.replaceSelection(
          new Slice(doc.content, 0, 0)
        )
        view.dispatch(tr)
        return true
      }

      return false // let ProseMirror handle non-Word paste normally
    },
    handleDrop(view, event, slice, moved) {
      const files = event.dataTransfer?.files
      if (files && files.length > 0) {
        const file = files[0]

        // Handle .docx drop
        if (file.name.endsWith(".docx") || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
          event.preventDefault()
          if (window._handleDocxImport) window._handleDocxImport(file)
          return true
        }

        // Handle image drops
        if (file.type.startsWith("image/")) {
          event.preventDefault()
          const reader = new FileReader()
          reader.onload = (e) => {
            const node = schema.nodes.image.create({ src: e.target.result, alt: file.name })
            const tr = view.state.tr.replaceSelectionWith(node)
            view.dispatch(tr)
          }
          reader.readAsDataURL(file)
          return true
        }
      }
      return false
    }
  })

  _editorView = view  // Save reference for navigation clicks
  window.editorView = view

  // === Image lightbox (click to enlarge) ===
  editorEl.addEventListener("click", (e) => {
    if (e.target.classList.contains("inline-image")) {
      const overlay = document.getElementById("lightbox-overlay")
      const img = document.getElementById("lightbox-img")
      img.src = e.target.src
      img.alt = e.target.alt
      overlay.classList.add("active")
      e.preventDefault()
      e.stopPropagation()
    }
  })

  // === Formula editing on click ===
  editorEl.addEventListener("click", (e) => {
    const mathBlock = e.target.closest(".math-block")
    const mathInline = e.target.closest(".math-inline")
    const mathEl = mathBlock || mathInline
    if (!mathEl) return

    const currentLatex = mathEl.getAttribute("data-latex") || ""
    const isBlock = !!mathBlock

    // Find the ProseMirror position of this node
    const pos = view.posAtDOM(mathEl, 0)
    if (pos === undefined) return

    const node = view.state.doc.nodeAt(pos)
    if (!node) return

    const newLatex = prompt(
      isBlock ? "Редактирование блочной формулы (LaTeX):" : "Редактирование inline формулы (LaTeX):",
      node.attrs.latex || currentLatex
    )

    if (newLatex !== null && newLatex !== node.attrs.latex) {
      const tr = view.state.tr.setNodeMarkup(pos, null, {
        ...node.attrs,
        latex: newLatex
      })
      view.dispatch(tr)
    }
  })

  buildToolbar(view, toolbarEl)
  setupContextMenu(view, editorEl)
  updateOutput(view.state)
  updateNavigation(view.state)
  setupTabs()

  // === Autosave to localStorage ===
  const AUTOSAVE_KEY = "wysiwyg-editorum-autosave"
  const statusEl = document.getElementById("import-status")
  let autosaveTimer = null

  function autosave() {
    try {
      const json = JSON.stringify(view.state.doc.toJSON())
      localStorage.setItem(AUTOSAVE_KEY, json)
      if (statusEl) {
        statusEl.textContent = "💾 Автосохранение " + new Date().toLocaleTimeString()
        setTimeout(() => { if (statusEl.textContent.startsWith("💾")) statusEl.textContent = "" }, 3000)
      }
    } catch (e) {
      console.warn("Autosave failed:", e)
    }
  }

  // Autosave every 5 seconds after last change
  const originalDispatch = view.dispatch.bind(view)
  view.setProps({
    dispatchTransaction(tr) {
      const newState = view.state.apply(tr)
      view.updateState(newState)
      updateOutput(newState)
      updateTableToolbar(view)
      if (tr.docChanged) {
        updateNavigation(newState)
      }
      if (tr.docChanged) {
        clearTimeout(autosaveTimer)
        autosaveTimer = setTimeout(autosave, 3000)
      }
    }
  })

  // Restore from autosave on page load — silent, no confirm dialog
  try {
    const saved = localStorage.getItem(AUTOSAVE_KEY)
    if (saved) {
      const savedDoc = schema.nodeFromJSON(JSON.parse(saved))
      if (savedDoc.content.size > 10) {
        const tr = view.state.tr.replaceWith(0, view.state.doc.content.size, savedDoc.content)
        view.dispatch(tr)
        if (statusEl) {
          statusEl.textContent = "📄 Восстановлен автосохранённый документ"
          setTimeout(() => { statusEl.textContent = "" }, 3000)
        }
      }
    }
  } catch (e) {
    console.warn("Autosave restore failed:", e)
  }

  // === DOCX Import ===
  async function handleDocxImport(file, editorView) {
    const statusEl = document.getElementById("import-status")
    statusEl.textContent = "⏳ Импорт..."

    try {
      const result = await importDocx(file)

      // Replace entire document content
      const tr = editorView.state.tr.replaceWith(
        0,
        editorView.state.doc.content.size,
        result.doc.content
      )
      editorView.dispatch(tr)

      statusEl.textContent = `✅ ${file.name} (формул: ${result.formulaCount})`
      // Hide import bar completely after import
      const importBar = document.getElementById("import-bar")
      if (importBar) {
        setTimeout(() => { importBar.style.display = "none" }, 1500)
      }
      updateNavigation(editorView.state)
    } catch (e) {
      console.error("DOCX import error:", e)
      statusEl.textContent = `❌ Ошибка: ${e.message}`
    }
  }
  // Make accessible to handleDrop
  window._handleDocxImport = (file) => handleDocxImport(file, view)

  // File input handler
  document.getElementById("file-input").addEventListener("change", (e) => {
    const file = e.target.files[0]
    if (file) handleDocxImport(file, view)
  })

  // Drag-over visual feedback on editor
  editorEl.addEventListener("dragover", (e) => {
    e.preventDefault()
    editorEl.classList.add("drag-over")
  })
  editorEl.addEventListener("dragleave", () => {
    editorEl.classList.remove("drag-over")
  })
  editorEl.addEventListener("drop", (e) => {
    editorEl.classList.remove("drag-over")
    // .docx handling is in ProseMirror handleDrop
    // but we also handle it here as fallback for drops outside ProseMirror area
    const files = e.dataTransfer?.files
    if (files && files.length > 0) {
      const file = files[0]
      if (file.name.endsWith(".docx")) {
        e.preventDefault()
        e.stopPropagation()
        handleDocxImport(file, view)
      }
    }
  })

  // Clipboard debug button
  document.getElementById("btn-show-clipboard").addEventListener("click", async () => {
    try {
      const items = await navigator.clipboard.read()
      let debugOutput = ""
      for (const item of items) {
        for (const type of item.types) {
          const blob = await item.getType(type)
          const text = await blob.text()
          debugOutput += `=== ${type} (${text.length} chars) ===\n`
          debugOutput += text.substring(0, 5000)
          debugOutput += text.length > 5000 ? "\n... (truncated)" : ""
          debugOutput += "\n\n"
        }
      }
      // Show in output panel
      const jsonEl = document.getElementById("json-output")
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"))
      document.querySelector('[data-tab="json"]').classList.add("active")
      document.getElementById("json-output").style.display = "block"
      document.getElementById("html-output").style.display = "none"
      jsonEl.textContent = debugOutput || "Буфер обмена пуст или нет разрешения"
    } catch(e) {
      alert("Не удалось прочитать буфер: " + e.message + "\n\nПопробуйте: вставьте текст (Ctrl+V) прямо в редактор — диагностика будет в консоли браузера (F12)")
    }
  })

  // Expose for debugging
  window.editorView = view
  window.editorSchema = schema
}

init()
