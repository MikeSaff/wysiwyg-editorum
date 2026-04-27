/**
 * Shared formula-quality scoring (used by formula-quality.mjs and formula-quality-diff.mjs).
 */
import { DOMParser } from "xmldom"
globalThis.DOMParser = DOMParser

import { readFile, readdir } from "node:fs/promises"
import { join, relative } from "node:path"
import { docxXmlToHtml, extractDocxArchiveContext, normalizeImportedHtml } from "../src/word-import.js"
import { parseMathTypeSync, validateLatex } from "mtef-to-mathml"

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

function isSingleCharFormulaHeuristic(mathml) {
  if (!mathml) return false
  const mi = (mathml.match(/<mi\b/gi) || []).length
  const mn = (mathml.match(/<mn\b/gi) || []).length
  const mo = (mathml.match(/<mo\b/gi) || []).length
  return mi + mn === 1 && mo <= 1
}

export function scoreFormulaQualityForHtml(html, oleBlobs) {
  let formulas_total = 0
  let empty_msub_count = 0
  let invalid_latex_count = 0
  let single_char_formula_count = 0
  let mathjax_render_error_count = 0

  const tokenRe = /data-mathml="([^"]*)"\s+data-latex="([^"]*)"/g
  let m
  while ((m = tokenRe.exec(html)) !== null) {
    formulas_total++
    const mathml = decodeXmlAttr(m[1])
    const latex = decodeXmlAttr(m[2])
    empty_msub_count += countEmptyScriptsInMathML(mathml)
    if (!validateLatex(latex).valid) invalid_latex_count++
    if (isSingleCharFormulaHeuristic(mathml)) single_char_formula_count++
    if (/<merror\b/i.test(mathml)) mathjax_render_error_count++
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

  return {
    formulas_total,
    empty_msub_count,
    embell_orphan_count,
    single_char_formula_count,
    invalid_latex_count,
    mathjax_render_error_count,
  }
}

async function walkDocxFiles(dir, out = []) {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    const p = join(dir, e.name)
    if (e.isDirectory()) {
      await walkDocxFiles(p, out)
    } else if (
      e.isFile() &&
      e.name.toLowerCase().endsWith(".docx") &&
      !e.name.startsWith("~$")
    ) {
      out.push(p)
    }
  }
  return out
}

export async function walkDocxAndScore(root) {
  const files = await walkDocxFiles(root)
  const results = []
  const totals = {
    formulas_total: 0,
    empty_msub_count: 0,
    embell_orphan_count: 0,
    single_char_formula_count: 0,
    invalid_latex_count: 0,
    mathjax_render_error_count: 0,
  }

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
      const html = normalizeImportedHtml(rawHtml)
      const scores = scoreFormulaQualityForHtml(html, ctx.oleBlobs)
      for (const k of Object.keys(totals)) totals[k] += scores[k]
      results.push({ file: rel, parse_error: null, ...scores })
    } catch (e) {
      results.push({
        file: rel,
        parse_error: e?.message || String(e),
        formulas_total: 0,
        empty_msub_count: 0,
        embell_orphan_count: 0,
        single_char_formula_count: 0,
        invalid_latex_count: 0,
        mathjax_render_error_count: 0,
      })
    }
  }

  return { files, results, totals }
}
