import { InputRule } from "prosemirror-inputrules"

export const emDashThreeHyphens = new InputRule(/---$/, "\u2014", { inCodeMark: false })

/** `--` + next char: en dash before digit (ranges), em dash otherwise (v0.44e). */
export const enDashTwoHyphens = new InputRule(/^(.*)--([^-])$/, (state, match, start, end) => {
  const prefix = match[1] ?? ""
  const ch = match[2] ?? ""
  const dash = /\d/.test(ch) ? "\u2013" : "\u2014"
  return state.tr.insertText(prefix + dash + ch, start, end)
}, { inCodeMark: false })

export function nextRussianDoubleQuote(beforeNoQuote) {
  const lastOpen = beforeNoQuote.lastIndexOf("\u00AB")
  const lastClose = beforeNoQuote.lastIndexOf("\u00BB")
  if (lastOpen === -1 || lastClose > lastOpen) return "\u00AB"
  const seg = beforeNoQuote.slice(lastOpen + 1)
  const nd = (seg.match(/\u201E/g) || []).length
  const nq = (seg.match(/"/g) || []).length
  if (nd > nq) return '"'
  if (nd < nq) return "\u00BB"
  if (nd === 0 && nq === 0) return seg.length === 0 ? "\u201E" : "\u00BB"
  return "\u00BB"
}

export const russianDoubleQuote = new InputRule(/"$/, (state, _match, start, end) => {
  const $from = state.doc.resolve(start)
  const blockStart = $from.start()
  const textBefore = state.doc.textBetween(blockStart, end, "", "\ufffc")
  const beforeNoQuote = textBefore.slice(0, -1)
  const q = nextRussianDoubleQuote(beforeNoQuote)
  return state.tr.insertText(q, start, end)
}, { inCodeMark: false })

/** Chars: , . ; : ! ? ) ] } » " — `]` must be escaped inside a class. */
const SPACE_BEFORE_PUNCT_CLASS = "[,.;:!?\\)\\]\\}»\"]"

/** v0.44d: remove regular space before punctuation when the punctuation is typed. */
export const removeSpaceBeforePunctuation = new InputRule(
  new RegExp(` (${SPACE_BEFORE_PUNCT_CLASS})$`),
  (state, match, start, end) => state.tr.insertText(match[1], start, end),
  { inCodeMark: false },
)

const RU_PREP =
  "в|на|с|к|по|об|от|из|у|о|и|а|но|не|для|при|под|над|про|что|как|же|ли|бы"
const EN_PREP = "a|an|in|on|at|by|to|of|or"

const reHangingRu = new RegExp(`(?<![\\p{L}\\p{M}])(${RU_PREP})\\s`, "giu")
const reHangingEn = new RegExp(`\\b(${EN_PREP})\\s`, "giu")

/** v0.44f: space after one-syllable preposition → nbsp (when space is typed). */
export const hangingPrepositionNbsp = new InputRule(
  new RegExp(`^(.*)(?<![\\p{L}\\p{M}])(${RU_PREP})\\s$`, "giu"),
  (state, match, start, end) => {
    const head = match[1] ?? ""
    const word = match[2] ?? ""
    return state.tr.insertText(head + word + "\u00A0", start, end)
  },
  { inCodeMark: false },
)

/** Optional EN: `a word` → nbsp after article/preposition when typing space. */
export const hangingPrepositionNbspEn = new InputRule(
  new RegExp(`^(.*)\\b(${EN_PREP})\\s$`, "giu"),
  (state, match, start, end) => {
    const head = match[1] ?? ""
    const word = match[2] ?? ""
    return state.tr.insertText(head + word + "\u00A0", start, end)
  },
  { inCodeMark: false },
)

/**
 * v0.44d — spaces before punctuation (GOST).
 * @param {string} text
 * @returns {string}
 */
export function normalizeSpaceBeforePunctuation(text) {
  return text.replace(new RegExp(` +(${SPACE_BEFORE_PUNCT_CLASS})`, "g"), "$1")
}

/**
 * v0.44e — short dash → long dash, except digit–digit ranges.
 * @param {string} text
 * @returns {string}
 */
export function normalizeEnDashToEmDash(text) {
  return text.replace(/(?<!\d\s?)\u2013(?!\s?\d)/g, "\u2014")
}

/** Typing/pasting Unicode en dash — convert to em when not a digit range (same rule as normalizer). */
export const unicodeEnDashToEm = new InputRule(/^(.*)\u2013$/, (state, match, start, end) => {
  const prefix = match[1] ?? ""
  const blockStart = state.doc.resolve(start).start()
  const textBefore = state.doc.textBetween(blockStart, end, "", "\ufffc")
  if (!textBefore.endsWith("\u2013")) return null
  const normalized = normalizeEnDashToEmDash(textBefore)
  if (!normalized.endsWith("\u2014")) return null
  return state.tr.insertText(prefix + "\u2014", start, end)
}, { inCodeMark: false })

/**
 * v0.44f — nbsp after short prepositions (RU + optional EN).
 * @param {string} text
 * @returns {string}
 */
export function normalizeHangingPrepositions(text) {
  let s = text.replace(reHangingRu, "$1\u00A0")
  s = s.replace(reHangingEn, "$1\u00A0")
  return s
}

/**
 * Collapse runs of ordinary spaces (U+0020) to a single space.
 * @param {string} text
 * @returns {string}
 */
export function collapseDoubleSpaces(text) {
  return text.replace(/ {2,}/g, " ")
}

/**
 * Full plain-text typography chain for post-import / per text node (order matters).
 * @param {string} text
 * @returns {string}
 */
export function normalizeTypographyPlainText(text) {
  let s = normalizeSpaceBeforePunctuation(text)
  s = normalizeEnDashToEmDash(s)
  s = normalizeHangingPrepositions(s)
  s = collapseDoubleSpaces(s)
  return s
}

function isEffectivelyEmptyParagraph(node) {
  if (node.type.name !== "paragraph") return false
  if (node.childCount === 0) return true
  let hasVisible = false
  node.forEach(child => {
    if (child.type.name === "math_inline" || child.type.name === "image") hasVisible = true
    if (child.isText && child.text.replace(/[\s\u00A0]/g, "") !== "") hasVisible = true
  })
  return !hasVisible
}

/**
 * Post-import: apply typography to all text nodes, remove duplicate spaces, delete empty paragraphs
 * where the parent allows it (v0.44).
 * @import {EditorState} from "prosemirror-state"
 * @param {EditorState} state
 * @returns {import("prosemirror-state").Transaction}
 */
export function createTypographyNormalizationTransaction(state) {
  const schema = state.schema
  const replacements = []
  state.doc.descendants((node, pos) => {
    if (!node.isText) return
    const next = normalizeTypographyPlainText(node.text)
    if (next !== node.text) {
      replacements.push({
        from: pos,
        to: pos + node.text.length,
        text: next,
        marks: node.marks,
      })
    }
  })

  let tr = state.tr
  replacements.sort((a, b) => b.from - a.from)
  for (const r of replacements) {
    tr = tr.replaceWith(r.from, r.to, schema.text(r.text, r.marks))
  }

  const emptyParagraphPositions = []
  tr.doc.descendants((node, pos) => {
    if (!isEffectivelyEmptyParagraph(node)) return
    const parent = tr.doc.resolve(pos).parent
    if (parent.childCount <= 1) return
    emptyParagraphPositions.push(pos)
  })

  emptyParagraphPositions.sort((a, b) => b - a)
  for (const pos of emptyParagraphPositions) {
    const node = tr.doc.nodeAt(pos)
    if (!node || node.type.name !== "paragraph") continue
    tr = tr.delete(pos, pos + node.nodeSize)
  }

  return tr
}

export const typographyQuoteAndDashRules = [
  emDashThreeHyphens,
  enDashTwoHyphens,
  unicodeEnDashToEm,
  russianDoubleQuote,
  removeSpaceBeforePunctuation,
  hangingPrepositionNbsp,
  hangingPrepositionNbspEn,
]
