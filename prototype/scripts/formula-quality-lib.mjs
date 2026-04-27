/**
 * Shared formula-quality scoring (used by formula-quality.mjs and formula-quality-diff.mjs).
 */
import { parseHTML } from "linkedom"
import { DOMParser } from "xmldom"
import { readFile } from "node:fs/promises"
import { relative } from "node:path"
import { docxXmlToHtml, extractDocxArchiveContext, normalizeImportedHtml } from "../src/word-import.js"
import { extractMetadataFromImportedHtml } from "../src/metadata-extract.js"
import { parseMathTypeSync, validateLatex } from "mtef-to-mathml"
import { walkDocxFiles } from "./corpus-root.mjs"

if (!globalThis.DOMParser) globalThis.DOMParser = DOMParser

function stripOleHeader(u8) {
  if (u8.length > 28 && u8[0] === 0x1c && u8[1] === 0x00) return u8.subarray(28)
  return u8
}

function decodeXmlAttr(s) {
  if (!s) return ""
  return s
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
}

const ATOM_TAGS = new Set(["mi", "mn", "mtext", "mo"])

/**
 * Count semantic atoms (mi, mn, mtext, mo) inside MathML. Empty mrow contributes nothing.
 * @param {string} mathml
 * @returns {number}
 */
export function countSemanticAtomsInMathML(mathml) {
  if (!mathml || !String(mathml).trim()) return 0
  const wrapped = /<math[\s>]/i.test(mathml) ? mathml : `<math>${mathml}</math>`
  try {
    const { document: d } = parseHTML(`<body xmlns="http://www.w3.org/1999/xhtml">${wrapped}</body>`)
    const math = d.querySelector("math")
    if (!math) return 0
    let n = 0
    function walk(el) {
      const tag = (el.localName || el.tagName || "").split(":").pop().toLowerCase()
      if (ATOM_TAGS.has(tag)) {
        n += 1
        return
      }
      for (const c of el.children || []) walk(c)
    }
    walk(math)
    return n
  } catch {
    return 0
  }
}

/** @param {string} mathml */
export function countSingleCharFormula(mathml) {
  const atoms = countSemanticAtomsInMathML(mathml)
  return atoms <= 1 ? 1 : 0
}

export function countEmptyScriptsInMathML(mathml) {
  if (!mathml) return 0
  let c = 0
  const pats = [
    /<msub\b[^>]*>[\s\S]*?<mrow>\s*<\/mrow>\s*<\/msub>/gi,
    /<msub\b[^>]*>[\s\S]*?<mrow\s*\/>\s*<\/msub>/gi,
    /<msup\b[^>]*>[\s\S]*?<mrow>\s*<\/mrow>\s*<\/msup>/gi,
    /<msup\b[^>]*>[\s\S]*?<mrow\s*\/>\s*<\/msup>/gi,
    /<msubsup\b[^>]*>[\s\S]*?<mrow>\s*<\/mrow>\s*<mrow>\s*<\/mrow>\s*<\/msubsup>/gi,
    /<msubsup\b[^>]*>[\s\S]*?<mrow\s*\/>\s*<mrow\s*\/>\s*<\/msubsup>/gi,
  ]
  for (const re of pats) {
    c += (mathml.match(re) || []).length
  }
  return c
}

/**
 * @param {string} html — normalized import HTML
 */
export function scoreFigureMetrics(html) {
  let figure_count = 0
  let figure_caption_truncated_count = 0
  let figure_placeholder_count = 0
  try {
    const { document: d } = parseHTML(`<div id="fq-root">${html || ""}</div>`)
    const root = d.getElementById("fq-root")
    if (!root) return { figure_count, figure_caption_truncated_count, figure_placeholder_count }
    const figures = [...root.querySelectorAll("figure.figure-block")]
    figure_count = figures.length
    const prefixRe = /^(?:Рис\.|Рисунок|Fig\.?|Figure)\s*\d+/iu
    for (const fig of figures) {
      if (fig.querySelector(".figure-placeholder")) figure_placeholder_count += 1
      const fc =
        fig.querySelector("figcaption.figure-caption-ru") || fig.querySelector("figcaption")
      if (!fc) continue
      const plain = (fc.textContent || "").replace(/\s+/gu, " ").trim()
      if (plain.length > 0 && plain.length <= 15 && prefixRe.test(plain)) {
        figure_caption_truncated_count += 1
      }
    }
  } catch {
    /* ignore */
  }
  return { figure_count, figure_caption_truncated_count, figure_placeholder_count }
}

/**
 * @param {import("../src/document-model.js").EMPTY_META} meta
 */
export function computeMetadataCompletenessPct(meta) {
  if (!meta) return 0
  const checks = [
    !!(meta.title?.ru && String(meta.title.ru).trim()),
    !!(meta.title?.en && String(meta.title.en).trim()),
    !!(
      (meta.abstracts?.ru && String(meta.abstracts.ru).trim()) ||
      (meta.abstract?.ru && String(meta.abstract.ru).trim())
    ),
    !!(
      (meta.abstracts?.en && String(meta.abstracts.en).trim()) ||
      (meta.abstract?.en && String(meta.abstract.en).trim())
    ),
    Array.isArray(meta.keywords?.ru) && meta.keywords.ru.length > 0,
    !!(meta.dates?.received && String(meta.dates.received).trim()),
    !!(meta.dates?.accepted && String(meta.dates.accepted).trim()),
    Array.isArray(meta.contributors) && meta.contributors.some((c) => c?.is_corresponding),
  ]
  const filled = checks.filter(Boolean).length
  return (filled / checks.length) * 100
}

/**
 * Among docs with non-empty title.ru, fraction that also have title.en (0–100).
 * @param {import("../src/document-model.js").EMPTY_META} meta
 */
export function computeBilingualExtractionScore(meta) {
  if (!meta?.title?.ru || !String(meta.title.ru).trim()) return null
  return meta.title.en && String(meta.title.en).trim() ? 100 : 0
}

export function scoreFormulaQualityForHtml(html, oleBlobs, meta = null) {
  let formulas_total = 0
  let empty_msub_count = 0
  let invalid_latex_count = 0
  let single_char_formula_count = 0
  let mathjax_render_error_count = 0

  try {
    const { document: d } = parseHTML(`<div id="fq-root">${html || ""}</div>`)
    const root = d.getElementById("fq-root")
    const formulas = root ? [...root.querySelectorAll(".math-block,.math-inline")] : []
    for (const el of formulas) {
      formulas_total++
      const mathml = el.getAttribute("data-mathml") || ""
      const latex = el.getAttribute("data-latex") || ""
      empty_msub_count += countEmptyScriptsInMathML(mathml)
      if (!validateLatex(latex).valid) invalid_latex_count++
      if (el.classList?.contains("math-block")) {
        single_char_formula_count += countSingleCharFormula(mathml)
      }
      if (/<merror\b/i.test(mathml)) mathjax_render_error_count++
    }
  } catch {
    const tokenRe = /data-mathml="([^"]*)"\s+data-latex="([^"]*)"/g
    let m
    while ((m = tokenRe.exec(html)) !== null) {
      formulas_total++
      const mathml = decodeXmlAttr(m[1])
      const latex = decodeXmlAttr(m[2])
      empty_msub_count += countEmptyScriptsInMathML(mathml)
      if (!validateLatex(latex).valid) invalid_latex_count++
      if (/<merror\b/i.test(mathml)) mathjax_render_error_count++
    }
  }

  let embell_orphan_count = 0
  if (oleBlobs instanceof Map) {
    for (const u8 of oleBlobs.values()) {
      try {
        const r = parseMathTypeSync(stripOleHeader(u8))
        if (r.warnings.some((w) => w.type === "embell-orphan")) embell_orphan_count++
      } catch {
        /* non-MTEF */
      }
    }
  }

  const fig = scoreFigureMetrics(html)

  let metadata_completeness_pct = meta ? computeMetadataCompletenessPct(meta) : 0
  let bilingual_extraction_score = meta ? computeBilingualExtractionScore(meta) : null

  return {
    formulas_total,
    empty_msub_count,
    embell_orphan_count,
    single_char_formula_count,
    invalid_latex_count,
    mathjax_render_error_count,
    figure_count: fig.figure_count,
    figure_caption_truncated_count: fig.figure_caption_truncated_count,
    figure_placeholder_count: fig.figure_placeholder_count,
    metadata_completeness_pct,
    bilingual_extraction_score,
  }
}

const ZERO_EXT = {
  formulas_total: 0,
  empty_msub_count: 0,
  embell_orphan_count: 0,
  single_char_formula_count: 0,
  invalid_latex_count: 0,
  mathjax_render_error_count: 0,
  figure_count: 0,
  figure_caption_truncated_count: 0,
  figure_placeholder_count: 0,
  metadata_completeness_pct: 0,
  bilingual_extraction_score: null,
}

export async function walkDocxAndScore(root, resolvedFiles = null) {
  const files = resolvedFiles || await walkDocxFiles(root)
  const results = []
  const totals = { ...ZERO_EXT, bilingual_extraction_score: 0, _bilingual_n: 0 }

  for (const abs of files.sort()) {
    const rel = relative(root, abs).replace(/\\/g, "/")
    try {
      const buf = await readFile(abs)
      const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
      const ctx = await extractDocxArchiveContext(ab)
      const rawHtml = docxXmlToHtml(
        ctx.xmlString,
        ctx.images,
        ctx.imageRels,
        ctx.footnotes,
        ctx.oleEmbedRels,
        ctx.oleBlobs
      )
      const { document: importDocument } = parseHTML("<!DOCTYPE html><html><body></body></html>")
      const prevDocument = globalThis.document
      let html
      try {
        globalThis.document = importDocument
        html = normalizeImportedHtml(rawHtml)
      } finally {
        if (prevDocument) globalThis.document = prevDocument
        else delete globalThis.document
      }
      const { document: ldoc } = parseHTML("<!DOCTYPE html><html><body></body></html>")
      const { meta } = extractMetadataFromImportedHtml(html, { rootDocument: ldoc })
      const scores = scoreFormulaQualityForHtml(html, ctx.oleBlobs, meta)
      for (const k of Object.keys(ZERO_EXT)) {
        if (k === "bilingual_extraction_score") continue
        totals[k] += scores[k]
      }
      const b = scores.bilingual_extraction_score
      if (b !== null) {
        totals.bilingual_extraction_score += b
        totals._bilingual_n += 1
      }
      results.push({ file: rel, parse_error: null, ...scores })
    } catch (e) {
      results.push({
        file: rel,
        parse_error: e?.message || String(e),
        ...ZERO_EXT,
      })
    }
  }

  const n = totals._bilingual_n || 0
  delete totals._bilingual_n
  totals.bilingual_extraction_score = n > 0 ? totals.bilingual_extraction_score / n : null

  return { files, results, totals }
}
