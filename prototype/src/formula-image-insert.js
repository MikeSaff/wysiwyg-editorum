import { Fragment, Slice } from "prosemirror-model"
import { dropPoint } from "prosemirror-transform"
import { schema, newNodeId } from "./schema.js"

/**
 * @param {import("prosemirror-model").Node} doc
 * @param {number} pos
 * @returns {boolean}
 */
export function isDropPosInParagraph(doc, pos) {
  const $p = doc.resolve(pos)
  for (let d = $p.depth; d > 0; d--) {
    if ($p.node(d).type === schema.nodes.paragraph) return true
  }
  return false
}

/**
 * @param {string} src
 * @returns {boolean}
 */
export function isValidFormulaImageSrc(src) {
  const s = String(src || "").trim()
  if (!s) return false
  if (s.startsWith("data:image/")) return true
  try {
    const u = new URL(s)
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
}

/**
 * @param {import("prosemirror-state").EditorState} state
 * @param {number} pos
 * @param {{ src: string, alt?: string, number?: string | null, latex_hint?: string, block: boolean, fromToolbar: boolean }} opts
 * @returns {import("prosemirror-state").Transaction | null}
 */
export function insertFormulaImageTransaction(state, pos, opts) {
  const { src, alt = "", number = null, latex_hint = "", block, fromToolbar } = opts
  if (!isValidFormulaImageSrc(src)) return null

  const useInline = fromToolbar ? !block : isDropPosInParagraph(state.doc, pos)
  const node = useInline
    ? schema.nodes.formula_image_inline.create({
      src,
      alt,
      latex_hint: latex_hint || ""
    })
    : schema.nodes.formula_image_block.create({
      id: newNodeId(),
      src,
      alt,
      latex_hint: latex_hint || "",
      number: number && String(number).trim() ? String(number).trim() : null
    })

  const slice = new Slice(Fragment.from(node), 0, 0)
  const at = dropPoint(state.doc, pos, slice)
  const insertPos = at != null ? at : pos
  return state.tr.replace(insertPos, insertPos, slice)
}
