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
import { buildToolbar } from "./toolbar.js"
import { cleanWordHtml } from "./word-paste.js"
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
        console.log("Word paste detected, cleaning HTML...")

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
      // Handle image drops
      const files = event.dataTransfer?.files
      if (files && files.length > 0) {
        const file = files[0]
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

  buildToolbar(view, toolbarEl)
  updateOutput(view.state)
  setupTabs()

  // Expose for debugging
  window.editorView = view
  window.editorSchema = schema
}

init()
