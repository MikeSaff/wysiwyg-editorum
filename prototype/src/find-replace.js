import { Plugin, PluginKey, TextSelection } from "prosemirror-state"
import { Decoration, DecorationSet } from "prosemirror-view"

export const findReplaceKey = new PluginKey("findReplace")

/**
 * @typedef {object} FindReplaceState
 * @property {boolean} visible
 * @property {boolean} replaceMode
 * @property {string} query
 * @property {string} replaceWith
 * @property {boolean} caseSensitive
 * @property {boolean} wholeWord
 * @property {boolean} useRegex
 * @property {number} currentIndex
 * @property {Array<{ from: number, to: number }>} matches
 */

/** @type {FindReplaceState} */
const defaultState = {
  visible: false,
  replaceMode: false,
  query: "",
  replaceWith: "",
  caseSensitive: false,
  wholeWord: false,
  useRegex: false,
  currentIndex: 0,
  matches: [],
}

/**
 * @param {string} text
 * @param {string} query
 * @param {{ caseSensitive: boolean, wholeWord: boolean, useRegex: boolean }} opts
 * @returns {Array<{ from: number, to: number }>}
 */
export function findMatchesInPlainText(text, query, opts) {
  const { caseSensitive, wholeWord, useRegex } = opts
  if (!query) return []

  if (useRegex) {
    let re
    try {
      re = new RegExp(query, caseSensitive ? "gu" : "giu")
    } catch {
      return []
    }
    const out = []
    let m
    const t = text
    while ((m = re.exec(t)) !== null) {
      out.push({ from: m.index, to: m.index + m[0].length })
      if (!re.global) break
    }
    return out
  }

  const needle = caseSensitive ? query : query.toLowerCase()
  const hay = caseSensitive ? text : text.toLowerCase()
  const nlen = needle.length
  if (nlen === 0) return []

  const out = []
  let i = 0
  while (i <= hay.length - nlen) {
    const idx = hay.indexOf(needle, i)
    if (idx < 0) break
    const before = idx === 0 ? "" : text[idx - 1]
    const after = idx + nlen >= text.length ? "" : text[idx + nlen]
    const wordOk = !wholeWord || (!isWordChar(before) && !isWordChar(after))
    if (wordOk) out.push({ from: idx, to: idx + nlen })
    i = idx + 1
  }
  return out
}

function isWordChar(ch) {
  if (!ch) return false
  return /[\p{L}\p{M}\p{N}_]/u.test(ch)
}

/**
 * @param {import("prosemirror-model").Node} doc
 * @param {string} query
 * @param {{ caseSensitive: boolean, wholeWord: boolean, useRegex: boolean }} opts
 */
export function collectFindMatches(doc, query, opts) {
  /** @type {Array<{ from: number, to: number }>} */
  const matches = []
  doc.descendants((node, pos) => {
    if (!node.isText) return
    const local = findMatchesInPlainText(node.text, query, opts)
    for (const m of local) {
      matches.push({ from: pos + m.from, to: pos + m.to })
    }
  })
  return matches
}

function buildDecorations(doc, matches, currentIndex) {
  if (!matches.length) return DecorationSet.empty
  const decos = matches.map((range, i) =>
    Decoration.inline(range.from, range.to, {
      class: i === currentIndex ? "pm-find-match pm-find-match-current" : "pm-find-match",
    }),
  )
  return DecorationSet.create(doc, decos)
}

function recomputeMatches(doc, ps) {
  return collectFindMatches(doc, ps.query, {
    caseSensitive: ps.caseSensitive,
    wholeWord: ps.wholeWord,
    useRegex: ps.useRegex,
  })
}

let panelEl = null

function getOrCreatePanel() {
  if (panelEl) return panelEl
  panelEl = document.createElement("div")
  panelEl.className = "pm-find-replace-panel"
  panelEl.innerHTML = `
    <div class="pm-find-replace-inner">
      <div class="pm-find-replace-row">
        <label class="pm-find-label">Найти</label>
        <input type="text" class="pm-find-input" spellcheck="false" autocomplete="off" />
        <span class="pm-find-count"></span>
        <button type="button" class="pm-find-prev" title="Предыдущее (Shift+Enter)">↑</button>
        <button type="button" class="pm-find-next" title="Следующее (Enter)">↓</button>
        <button type="button" class="pm-find-close" title="Закрыть (Escape)">×</button>
      </div>
      <div class="pm-find-replace-row pm-replace-row" style="display:none">
        <label class="pm-find-label">Заменить</label>
        <input type="text" class="pm-find-replace-input" spellcheck="false" autocomplete="off" />
        <button type="button" class="pm-replace-one">Заменить</button>
        <button type="button" class="pm-replace-all">Заменить всё</button>
      </div>
      <div class="pm-find-options">
        <label class="pm-find-opt"><input type="checkbox" class="pm-opt-case" /> Учитывать регистр</label>
        <label class="pm-find-opt"><input type="checkbox" class="pm-opt-word" /> Целое слово</label>
        <label class="pm-find-opt"><input type="checkbox" class="pm-opt-regex" /> Regex</label>
      </div>
    </div>
  `
  document.body.appendChild(panelEl)
  return panelEl
}

/**
 * @param {import("prosemirror-view").EditorView} view
 */
function bindPanel(view) {
  const el = getOrCreatePanel()
  if (el.dataset.bound === "1") return
  el.dataset.bound = "1"

  const findInput = el.querySelector(".pm-find-input")
  const replaceInput = el.querySelector(".pm-find-replace-input")
  const countEl = el.querySelector(".pm-find-count")
  const replaceRow = el.querySelector(".pm-replace-row")

  const dispatchMeta = partial => {
    view.dispatch(view.state.tr.setMeta(findReplaceKey, partial))
  }

  const syncCount = () => {
    const ps = findReplaceKey.getState(view.state)
    if (!ps) return
    const n = ps.matches.length
    countEl.textContent = n ? `${Math.min(ps.currentIndex + 1, n)}/${n}` : "0/0"
  }

  findInput.addEventListener("input", () => {
    dispatchMeta({ action: "setQuery", query: findInput.value })
  })
  replaceInput.addEventListener("input", () => {
    dispatchMeta({ action: "setReplace", replaceWith: replaceInput.value })
  })
  el.querySelector(".pm-opt-case").addEventListener("change", e => {
    dispatchMeta({ action: "setOpts", caseSensitive: e.target.checked })
  })
  el.querySelector(".pm-opt-word").addEventListener("change", e => {
    dispatchMeta({ action: "setOpts", wholeWord: e.target.checked })
  })
  el.querySelector(".pm-opt-regex").addEventListener("change", e => {
    dispatchMeta({ action: "setOpts", useRegex: e.target.checked })
  })

  el.querySelector(".pm-find-prev").addEventListener("click", () => findGo(view, -1))
  el.querySelector(".pm-find-next").addEventListener("click", () => findGo(view, 1))
  el.querySelector(".pm-find-close").addEventListener("click", () => dispatchMeta({ action: "close" }))
  el.querySelector(".pm-replace-one").addEventListener("click", () => findReplaceOne(view))
  el.querySelector(".pm-replace-all").addEventListener("click", () => findReplaceAll(view))

  el.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault()
      if (e.shiftKey) findGo(view, -1)
      else findGo(view, 1)
    }
    if (e.key === "Escape") {
      e.preventDefault()
      dispatchMeta({ action: "close" })
    }
  })

  const origDispatch = view.dispatch.bind(view)
  view.dispatch = tr => {
    origDispatch(tr)
    const ps = findReplaceKey.getState(view.state)
    el.classList.toggle("pm-find-replace-visible", !!ps?.visible)
    if (ps?.visible) {
      replaceRow.style.display = ps.replaceMode ? "flex" : "none"
      syncCount()
    }
  }
}

/**
 * @param {import("prosemirror-view").EditorView} view
 * @param {number} dir
 */
function findGo(view, dir) {
  const ps = findReplaceKey.getState(view.state)
  if (!ps?.matches.length) return
  const n = ps.matches.length
  const ni = (ps.currentIndex + dir + n) % n
  const m = ps.matches[ni]
  const sel = TextSelection.create(view.state.doc, m.from)
  view.dispatch(
    view.state.tr.setSelection(sel).setMeta(findReplaceKey, { action: "setIndex", index: ni }),
  )
}

/**
 * @param {import("prosemirror-view").EditorView} view
 */
function findReplaceOne(view) {
  const ps = findReplaceKey.getState(view.state)
  if (!ps?.matches.length) return
  const cur = ps.matches[ps.currentIndex] ?? ps.matches[0]
  const tr = view.state.tr.insertText(ps.replaceWith, cur.from, cur.to)
  view.dispatch(tr.setMeta(findReplaceKey, { action: "afterDocReplace" }))
}

/**
 * @param {import("prosemirror-view").EditorView} view
 */
function findReplaceAll(view) {
  const ps = findReplaceKey.getState(view.state)
  if (!ps?.matches.length) return
  let { tr } = view.state
  const sorted = [...ps.matches].sort((a, b) => b.from - a.from)
  for (const m of sorted) {
    tr = tr.insertText(ps.replaceWith, m.from, m.to)
  }
  view.dispatch(tr.setMeta(findReplaceKey, { action: "afterDocReplace" }))
}

function ensureFindReplacePlugin(view) {
  const exists = view.state.plugins.some(p => p.spec.key === findReplaceKey)
  if (!exists) {
    const plugin = createFindReplacePlugin()
    view.updateState(view.state.reconfigure({ plugins: view.state.plugins.concat([plugin]) }))
  }
  bindPanel(view)
}

/**
 * @param {import("prosemirror-view").EditorView} view
 */
export function openFindPanel(view) {
  ensureFindReplacePlugin(view)
  view.dispatch(view.state.tr.setMeta(findReplaceKey, { action: "open", replaceMode: false }))
  const el = getOrCreatePanel()
  requestAnimationFrame(() => {
    el.querySelector(".pm-find-input")?.focus()
    syncPanelFromState(view)
  })
}

/**
 * @param {import("prosemirror-view").EditorView} view
 */
export function openReplacePanel(view) {
  ensureFindReplacePlugin(view)
  view.dispatch(view.state.tr.setMeta(findReplaceKey, { action: "open", replaceMode: true }))
  const el = getOrCreatePanel()
  requestAnimationFrame(() => {
    el.querySelector(".pm-find-input")?.focus()
    syncPanelFromState(view)
  })
}

/**
 * @param {import("prosemirror-view").EditorView} view
 */
function syncPanelFromState(view) {
  const el = getOrCreatePanel()
  const ps = findReplaceKey.getState(view.state)
  if (!ps) return
  const findInput = el.querySelector(".pm-find-input")
  const replaceInput = el.querySelector(".pm-find-replace-input")
  const replaceRow = el.querySelector(".pm-replace-row")
  if (findInput) findInput.value = ps.query
  if (replaceInput) replaceInput.value = ps.replaceWith
  el.querySelector(".pm-opt-case").checked = ps.caseSensitive
  el.querySelector(".pm-opt-word").checked = ps.wholeWord
  el.querySelector(".pm-opt-regex").checked = ps.useRegex
  if (replaceRow) replaceRow.style.display = ps.replaceMode ? "flex" : "none"
  el.classList.toggle("pm-find-replace-visible", ps.visible)
}

export function createFindReplacePlugin() {
  return new Plugin({
    key: findReplaceKey,
    state: {
      init() {
        return { ...defaultState }
      },
      apply(tr, value, _old, newState) {
        let next = { ...value }
        const meta = tr.getMeta(findReplaceKey)

        if (meta !== undefined && meta && typeof meta === "object" && meta.action) {
          switch (meta.action) {
            case "open":
              next = {
                ...next,
                visible: true,
                replaceMode: !!meta.replaceMode,
                matches: recomputeMatches(newState.doc, { ...next, query: next.query }),
                currentIndex: 0,
              }
              break
            case "close":
              next = { ...defaultState }
              break
            case "setQuery":
              next = {
                ...next,
                query: meta.query ?? "",
                matches: recomputeMatches(newState.doc, { ...next, query: meta.query ?? "" }),
                currentIndex: 0,
              }
              break
            case "setReplace":
              next = { ...next, replaceWith: meta.replaceWith ?? "" }
              break
            case "setOpts":
              next = {
                ...next,
                caseSensitive: meta.caseSensitive ?? next.caseSensitive,
                wholeWord: meta.wholeWord ?? next.wholeWord,
                useRegex: meta.useRegex ?? next.useRegex,
                matches: recomputeMatches(newState.doc, {
                  ...next,
                  caseSensitive: meta.caseSensitive ?? next.caseSensitive,
                  wholeWord: meta.wholeWord ?? next.wholeWord,
                  useRegex: meta.useRegex ?? next.useRegex,
                }),
                currentIndex: 0,
              }
              break
            case "setIndex":
              next = { ...next, currentIndex: meta.index ?? 0 }
              break
            case "afterDocReplace":
              next = {
                ...next,
                matches: recomputeMatches(newState.doc, next),
                currentIndex: 0,
              }
              break
            default:
              break
          }
        }

        if (tr.docChanged && next.visible) {
          next = {
            ...next,
            matches: recomputeMatches(newState.doc, next),
            currentIndex: Math.min(next.currentIndex, Math.max(0, next.matches.length - 1)),
          }
        }

        return next
      },
    },
    props: {
      decorations(state) {
        const ps = findReplaceKey.getState(state)
        if (!ps?.visible || !ps.matches.length) return DecorationSet.empty
        return buildDecorations(state.doc, ps.matches, ps.currentIndex)
      },
    },
    view(view) {
      return {
        update(v) {
          const ps = findReplaceKey.getState(v.state)
          const el = panelEl
          if (!el) return
          el.classList.toggle("pm-find-replace-visible", !!ps?.visible)
          if (!ps?.visible) return
          const findInput = el.querySelector(".pm-find-input")
          const replaceInput = el.querySelector(".pm-find-replace-input")
          const countEl = el.querySelector(".pm-find-count")
          const replaceRow = el.querySelector(".pm-replace-row")
          if (findInput && document.activeElement !== findInput) findInput.value = ps.query
          if (replaceInput && document.activeElement !== replaceInput) replaceInput.value = ps.replaceWith
          if (replaceRow) replaceRow.style.display = ps.replaceMode ? "flex" : "none"
          if (countEl) {
            const n = ps.matches.length
            countEl.textContent = n ? `${Math.min(ps.currentIndex + 1, n)}/${n}` : "0/0"
          }
        },
      }
    },
  })
}
