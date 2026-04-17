import { EditorState, Plugin } from "prosemirror-state"
import { EditorView } from "prosemirror-view"
import { DOMParser as ProseDOMParser, DOMSerializer, Slice } from "prosemirror-model"
import { keymap } from "prosemirror-keymap"
import { baseKeymap, toggleMark } from "prosemirror-commands"
import { history, undo, redo } from "prosemirror-history"
import { inputRules, wrappingInputRule, textblockTypeInputRule, ellipsis } from "prosemirror-inputrules"
import { dropCursor } from "prosemirror-dropcursor"
import { gapCursor } from "prosemirror-gapcursor"
import { tableEditing, columnResizing, goToNextCell, fixTables } from "prosemirror-tables"
import { splitListItem, liftListItem, sinkListItem } from "prosemirror-schema-list"

import { schema, sectionTypeLabels, sectionTypeColors } from "./schema.js"
import { buildToolbar, updateTableToolbar } from "./toolbar.js"
import { setupContextMenu } from "./context-menu.js"
import { cleanWordHtml } from "./word-paste.js"
import { importDocx } from "./word-import.js"
import { typographyQuoteAndDashRules } from "./typography-rules.js"
import "mathlive/fonts.css"
import "mathlive"
import { openMathEditModal } from "./mathlive-setup.js"
import "./styles.css"

// === Non-breaking space plugin (ГОСТ §9.4-9.5) ===
// Auto-replace regular space with nbsp after numbers+units, №, etc.
const nbspAutoPlugin = new Plugin({
  appendTransaction(transactions, oldState, newState) {
    if (!transactions.some(tr => tr.docChanged)) return null

    const tr = newState.tr
    let modified = false

    newState.doc.descendants((node, pos) => {
      if (node.isText && node.text) {
        const text = node.text
        // Patterns requiring nbsp (ГОСТ §9.5):
        // 1. After initials: А. Б. before surname
        // 2. After №
        // 3. Between number and unit: 5 м, 10 кг
        // 4. After abbreviations: г., ул., т.д., т.е.

        // Pattern: digit + regular space + short word (unit)
        const unitPattern = /(\d)\s(мм|см|м|км|кг|г|мг|т|л|мл|с|мин|ч|Вт|В|А|Гц|Па|К|°С|%|‰)\b/g
        let match
        while ((match = unitPattern.exec(text)) !== null) {
          const spacePos = pos + match.index + match[1].length
          if (text[match.index + match[1].length] === ' ') {
            tr.replaceWith(spacePos, spacePos + 1,
              newState.schema.text('\u00A0'))
            modified = true
          }
        }

        // Pattern: № + regular space + digit
        const numPattern = /№\s(\d)/g
        while ((match = numPattern.exec(text)) !== null) {
          const spacePos = pos + match.index + 1
          if (text[match.index + 1] === ' ') {
            tr.replaceWith(spacePos, spacePos + 1,
              newState.schema.text('\u00A0'))
            modified = true
          }
        }
      }
    })

    return modified ? tr : null
  }
})

// === Input rules (markdown-like shortcuts) ===
function buildInputRules() {
  const rules = [
    ...typographyQuoteAndDashRules,
    ellipsis,
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
  ]

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

  const items = []
  let figNum = 0, tblNum = 0, formulaNum = 0

  state.doc.forEach((node, offset) => {
    // Headings
    if (node.type.name === "heading") {
      const level = node.attrs.level || 1
      const text = node.textContent.trim()
      if (text) {
        items.push({ type: "heading", level, text: text.substring(0, 55), pos: offset })
      }
    }
    // Figures — find image paragraph BEFORE the caption
    if (node.type.name === "paragraph") {
      const text = node.textContent.trim()
      if (/^(Рис\.|Рисунок)\s*\d/i.test(text)) {
        figNum++
        // Navigate to image above caption, not to caption itself
        // Look back for nearest image paragraph
        let imgPos = offset
        state.doc.nodesBetween(Math.max(0, offset - 2000), offset, (n, p) => {
          if (n.type.name === "paragraph") {
            let hasImage = false
            n.forEach(child => { if (child.type.name === "image") hasImage = true })
            if (hasImage) imgPos = p
          }
        })
        items.push({ type: "fig", text: text.substring(0, 50), pos: imgPos })
      }
      if (/^(Табл\.|Таблица)\s*\d/i.test(text)) {
        tblNum++
        items.push({ type: "tbl", text: text.substring(0, 50), pos: offset })
      }
    }
    // Formulas with labels
    if (node.type.name === "math_block" && node.attrs.label) {
      formulaNum++
      items.push({ type: "formula", text: `Формула ${node.attrs.label}`, pos: offset })
    }
  })

  // Build HTML — hierarchical tree with collapsible headings
  let html = ""
  let openSections = [] // stack of open section divs

  function closeToLevel(level) {
    while (openSections.length > 0 && openSections[openSections.length - 1] >= level) {
      html += "</div>"
      openSections.pop()
    }
  }

  // Group items: each heading opens a section, non-heading items go inside
  for (let i = 0; i < items.length; i++) {
    const item = items[i]

    if (item.type === "heading") {
      closeToLevel(item.level)

      // Check if this heading has any children (next items before next same/higher level heading)
      let hasChildren = false
      for (let j = i + 1; j < items.length; j++) {
        if (items[j].type === "heading" && items[j].level <= item.level) break
        hasChildren = true
        break
      }

      if (hasChildren) {
        html += `<div class="nav-item level-${item.level} nav-section-toggle" data-pos="${item.pos}">${escapeHtmlNav(item.text)}</div>`
        html += `<div class="nav-section">`
        openSections.push(item.level)
      } else {
        html += `<div class="nav-item level-${item.level}" data-pos="${item.pos}">${escapeHtmlNav(item.text)}</div>`
      }
    } else if (item.type === "fig") {
      html += `<div class="nav-item nav-fig" data-pos="${item.pos}">🖼 ${escapeHtmlNav(item.text)}</div>`
    } else if (item.type === "tbl") {
      html += `<div class="nav-item nav-tbl" data-pos="${item.pos}">▦ ${escapeHtmlNav(item.text)}</div>`
    } else if (item.type === "formula") {
      html += `<div class="nav-item nav-formula" data-pos="${item.pos}">∑ ${escapeHtmlNav(item.text)}</div>`
    }
  }

  closeToLevel(0)

  navItems.innerHTML = html

  // Default: show level 1-2, collapse level 3+
  navItems.querySelectorAll(".nav-section").forEach(sec => {
    const toggle = sec.previousElementSibling
    if (!toggle) return
    let depth = 0
    let p = sec.parentElement
    while (p && p !== navItems) {
      if (p.classList.contains("nav-section")) depth++
      p = p.parentElement
    }
    if (depth >= 1) {
      sec.classList.add("collapsed")
      toggle.classList.add("collapsed")
    }
  })
}

function escapeHtmlNav(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

// Event delegation for nav clicks — works even after innerHTML updates
document.getElementById("nav-items")?.addEventListener("click", (e) => {
  const item = e.target.closest(".nav-item")
  if (!item) return

  // Toggle section collapse
  if (item.classList.contains("nav-section-toggle")) {
    item.classList.toggle("collapsed")
    const section = item.nextElementSibling
    if (section && section.classList.contains("nav-section")) {
      section.classList.toggle("collapsed")
    }
    // Don't navigate, just toggle
    if (!e.ctrlKey) return
  }

  if (!_editorView) return
  const pos = parseInt(item.dataset.pos)
  if (isNaN(pos)) return

  try {
    _editorView.focus()
    const resolvedPos = _editorView.state.doc.resolve(Math.min(pos + 1, _editorView.state.doc.content.size))
    const selection = _editorView.state.selection.constructor.near(resolvedPos)
    const tr = _editorView.state.tr.setSelection(selection)
    _editorView.dispatch(tr)

    const coords = _editorView.coordsAtPos(pos + 1)
    if (coords) {
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

// === Section type dropdown ===
function showSectionTypeDropdown(headingEl, view) {
  // Remove existing dropdown
  document.querySelector(".pm-section-dropdown")?.remove()

  const dropdown = document.createElement("div")
  dropdown.className = "pm-section-dropdown"

  const types = [
    [null, "Без типа", "#9e9e9e"],
    ...Object.entries(sectionTypeLabels).map(([key, label]) => [key, label, sectionTypeColors[key] || "#616161"])
  ]

  types.forEach(([type, label, color]) => {
    const item = document.createElement("div")
    item.className = "pm-section-dropdown-item"
    const dot = document.createElement("span")
    dot.className = "pm-section-dot"
    dot.style.background = color
    item.appendChild(dot)
    item.appendChild(document.createTextNode(label))
    item.addEventListener("click", (e) => {
      e.stopPropagation()
      // Find ProseMirror pos of heading
      const pos = view.posAtDOM(headingEl, 0)
      if (pos === undefined) return
      const node = view.state.doc.nodeAt(pos)
      if (!node || node.type !== schema.nodes.heading) return
      const tr = view.state.tr.setNodeMarkup(pos, null, { ...node.attrs, sectionType: type })
      view.dispatch(tr)
      dropdown.remove()
      view.focus()
    })
    dropdown.appendChild(item)
  })

  const rect = headingEl.getBoundingClientRect()
  dropdown.style.position = "fixed"
  dropdown.style.left = `${rect.left}px`
  dropdown.style.top = `${rect.bottom + 4}px`
  document.body.appendChild(dropdown)

  // Close on outside click
  const close = (e) => {
    if (!dropdown.contains(e.target)) {
      dropdown.remove()
      document.removeEventListener("click", close, true)
    }
  }
  setTimeout(() => document.addEventListener("click", close, true), 0)
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
      nbspAutoPlugin,
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

  // Lightbox helpers
  const lbOverlay = document.getElementById("lightbox-overlay")
  const lbImg = document.getElementById("lightbox-img")
  const isLightboxPlaceholder = (src) => !src || src.startsWith("data:image/svg+xml")
  const closeLightbox = () => {
    if (!lbOverlay) return
    lbOverlay.classList.remove("active")
    if (lbImg) {
      lbImg.removeAttribute("src")
      lbImg.alt = ""
    }
  }
  const openLightbox = (src, alt = "") => {
    if (!lbOverlay || !lbImg || isLightboxPlaceholder(src)) return false
    lbImg.src = src
    lbImg.alt = alt
    lbOverlay.classList.add("active")
    return true
  }

  if (lbOverlay) {
    lbOverlay.addEventListener("click", (e) => {
      if (e.target === lbOverlay) {
        closeLightbox()
      }
    })
  }
  if (lbImg) {
    lbImg.addEventListener("click", (e) => {
      e.stopPropagation()
    })
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && lbOverlay?.classList.contains("active")) {
      closeLightbox()
    }
  })

  // === Image resize (drag corner to resize) ===
  let resizeState = null
  editorEl.addEventListener("mousedown", (e) => {
    const img = e.target.closest(".inline-image")
    if (!img || e.button !== 0) return
    // Only start resize if clicking near bottom-right corner
    const rect = img.getBoundingClientRect()
    const cornerSize = 20
    if (e.clientX > rect.right - cornerSize && e.clientY > rect.bottom - cornerSize) {
      e.preventDefault()
      img.classList.add("resizing")
      resizeState = { img, startX: e.clientX, startY: e.clientY, startW: img.offsetWidth, startH: img.offsetHeight }
    }
  })

  document.addEventListener("mousemove", (e) => {
    if (!resizeState) return
    e.preventDefault()
    const { img, startX, startW, startH } = resizeState
    const dx = e.clientX - startX
    const newW = Math.max(50, startW + dx)
    const ratio = startH / startW
    img.style.width = newW + "px"
    img.style.height = (newW * ratio) + "px"
  })

  document.addEventListener("mouseup", (e) => {
    if (!resizeState) return
    const { img } = resizeState
    img.classList.remove("resizing")
    // Update ProseMirror node attrs if needed
    resizeState = null
  })

  // === Image: single click = lightbox (enlarge), right click = edit menu ===
  window._openLightbox = function(src) {
    return openLightbox(src)
  }

  editorEl.addEventListener("click", (e) => {
    const img = e.target.closest(".inline-image")
    if (!img || resizeState) return
    const src = img.src || ""
    if (isLightboxPlaceholder(src)) return
    e.preventDefault()
    e.stopPropagation()
    openLightbox(src, img.alt || "")
  })

  // === Section type selector on heading click ===
  editorEl.addEventListener("click", (e) => {
    const heading = e.target.closest("h1, h2, h3, h4")
    if (!heading || !editorEl.contains(heading)) return
    // Only trigger on left side (where the badge is)
    const headingRect = heading.getBoundingClientRect()
    if (e.clientX > headingRect.left + 30) return
    e.preventDefault()
    e.stopPropagation()
    showSectionTypeDropdown(heading, view)
  })

  // === Formula editing on click (MathLive modal) ===
  editorEl.addEventListener("click", async (e) => {
    const mathEl = e.target.closest(".math-block") || e.target.closest(".math-inline")
    if (!mathEl) return

    e.preventDefault()
    e.stopPropagation()

    const currentLatex = mathEl.getAttribute("data-latex") || ""
    const isBlock = mathEl.classList.contains("math-block")

    const pos = view.posAtDOM(mathEl, 0)
    if (pos === undefined) return

    const node = view.state.doc.nodeAt(pos)
    if (!node) return

    const initial = node.attrs.latex || currentLatex
    const newLatex = await openMathEditModal(initial, isBlock)

    if (newLatex !== null && newLatex !== node.attrs.latex) {
      const tr = view.state.tr.setNodeMarkup(pos, null, {
        ...node.attrs,
        mathml: "",
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

  // Restore from autosave — only if not a forced reload
  // User can clear with "Новый документ" button
  try {
    const saved = localStorage.getItem(AUTOSAVE_KEY)
    if (saved) {
      const savedDoc = schema.nodeFromJSON(JSON.parse(saved))
      if (savedDoc.content.size > 10) {
        const tr = view.state.tr.replaceWith(0, view.state.doc.content.size, savedDoc.content)
        view.dispatch(tr)
        if (statusEl) {
          statusEl.textContent = "📄 Восстановлен документ. «📂 Новый» для сброса."
          setTimeout(() => { statusEl.textContent = "" }, 4000)
        }
      }
    }
  } catch (e) {
    console.warn("Autosave restore failed:", e)
  }

  // v0.44z3: auto-shrink removed. Formulas must wrap (ГОСТ §13.10), not scale-down.
  // Long formulas — задача Codex: разбивать на строки по знакам операций (=, +, −, ×).

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

  // Clipboard debug button (optional — only exists in dev mode)
  document.getElementById("btn-show-clipboard")?.addEventListener("click", async () => {
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
