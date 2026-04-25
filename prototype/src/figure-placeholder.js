import { schema } from "./schema.js"

/**
 * @param {string} url
 * @returns {boolean}
 */
export function isAllowedImageUrl(url) {
  const u = String(url || "").trim()
  if (!u) return false
  if (u.startsWith("data:image/")) return true
  try {
    const base = typeof globalThis !== "undefined" && globalThis.location?.href
      ? globalThis.location.href
      : "https://example.com/"
    const parsed = new URL(u, base)
    return parsed.protocol === "http:" || parsed.protocol === "https:"
  } catch {
    return false
  }
}

/**
 * Replaces a placeholder figure_image with a real image (data URL or https URL).
 * @param {import("prosemirror-view").EditorView} view
 * @param {HTMLElement | number} placeholderElOrDocPos — DOM node or document position of the figure_image atom
 * @param {string} src
 * @param {string} [alt]
 * @returns {boolean}
 */
export function insertImageIntoFigurePlaceholder(view, placeholderElOrDocPos, src, alt) {
  if (!isAllowedImageUrl(src)) return false
  let pos = null
  if (typeof placeholderElOrDocPos === "number") {
    pos = placeholderElOrDocPos
  } else {
    const el = placeholderElOrDocPos
    if (!el || !view.dom.contains(el)) return false
    pos = view.posAtDOM(el, 0)
  }
  if (pos == null) return false
  const node = view.state.doc.nodeAt(pos)
  if (!node || node.type !== schema.nodes.figure_image || !node.attrs.placeholder) {
    return false
  }
  const tr = view.state.tr
    .setNodeMarkup(pos, null, {
      src: String(src).trim(),
      alt: alt != null ? String(alt) : "",
      title: "",
      placeholder: false,
    })
    .scrollIntoView()
  view.dispatch(tr)
  view.focus()
  return true
}

/**
 * Drag-over visual feedback. Drop is handled in main.js `handleDrop` (ProseMirror).
 * @param {import("prosemirror-view").EditorView} view
 * @param {HTMLElement} editorEl
 * @returns {() => void}
 */
export function setupFigurePlaceholderDnD(view, editorEl) {
  const clearAllDragTarget = () => {
    editorEl.querySelectorAll(".figure-placeholder.drag-target").forEach((el) => {
      el.classList.remove("drag-target")
    })
  }

  const onEditorDragOver = (e) => {
    const ph = e.target && e.target.closest && e.target.closest(".figure-placeholder")
    if (ph && view.dom.contains(ph) && e.dataTransfer) {
      const dt = e.dataTransfer
      const hasFiles =
        dt.types && (Array.from(dt.types).indexOf("Files") >= 0 || dt.types.contains?.("Files"))
      if (hasFiles) {
        e.preventDefault()
        dt.dropEffect = "copy"
        clearAllDragTarget()
        ph.classList.add("drag-target")
        return
      }
    }
    if (!e.target || !e.target.closest || !e.target.closest(".figure-placeholder")) {
      clearAllDragTarget()
    }
  }

  const onDocumentDragEnd = () => {
    clearAllDragTarget()
  }

  editorEl.addEventListener("dragover", onEditorDragOver, true)
  document.addEventListener("dragend", onDocumentDragEnd, true)

  return () => {
    editorEl.removeEventListener("dragover", onEditorDragOver, true)
    document.removeEventListener("dragend", onDocumentDragEnd, true)
  }
}
