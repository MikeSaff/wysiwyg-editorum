import { InputRule } from "prosemirror-inputrules"

export const emDashThreeHyphens = new InputRule(/---$/, "\u2014", { inCodeMark: false })

export const enDashTwoHyphens = new InputRule(/^(.*)--([^-])$/, (state, match, start, end) => {
  const prefix = match[1] ?? ""
  const ch = match[2] ?? ""
  return state.tr.insertText(prefix + "\u2013" + ch, start, end)
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

export const typographyQuoteAndDashRules = [
  emDashThreeHyphens,
  enDashTwoHyphens,
  russianDoubleQuote,
]
