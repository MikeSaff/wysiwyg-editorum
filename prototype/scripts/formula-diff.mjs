#!/usr/bin/env node
/**
 * Deep-dive: list OLE equations from a DOCX (parseMathTypeSync + paragraph context).
 * Usage: node scripts/formula-diff.mjs --docx path/to/file.docx
 *        node scripts/formula-diff.mjs --all   (walk CORPUX_DOCX_ROOT or Docx/Nauka)
 */
import fs from "node:fs"
import path from "node:path"
import { createHash } from "node:crypto"
import { fileURLToPath } from "node:url"
import { readdir } from "node:fs/promises"
import JSZip from "jszip"
import { parseHTML } from "linkedom"
import { DOMParser } from "xmldom"
import { parseMathTypeSync } from "mtef-to-mathml"
import { docxXmlToHtml, extractDocxArchiveContext, normalizeImportedHtml } from "../src/word-import.js"

if (!globalThis.DOMParser) globalThis.DOMParser = DOMParser

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_ROOT = path.join(__dirname, "../../Docx/Nauka")

function argVal(name) {
  const i = process.argv.indexOf(name)
  if (i >= 0) return process.argv[i + 1] || ""
  return ""
}

function stripOleHeader(u8) {
  if (u8.length > 28 && u8[0] === 0x1c && u8[1] === 0x00) return u8.subarray(28)
  return u8
}

function getPStyleFromParagraph(p) {
  const pPr = p.querySelector("pPr")
  if (!pPr) return ""
  const ps = pPr.querySelector("pStyle")
  return (ps?.getAttribute("val") || "").trim()
}

function paragraphImageHints(p) {
  const types = []
  if (p.querySelector("drawing")) types.push("drawing")
  if (p.querySelector("pict")) types.push("pict")
  if (p.querySelector("shape")) types.push("vml-shape")
  const objs = [...p.querySelectorAll("object")]
  for (const o of objs) {
    const t = (o.getAttribute("progId") || o.getAttribute("ProgID") || "").toLowerCase()
    if (/image|png|jpeg|gif|wmf|emf/i.test(t)) types.push(`object:${t.slice(0, 40)}`)
  }
  return [...new Set(types)]
}

function hasImageRid(p, relsMap) {
  const blips = [...p.querySelectorAll("blip")]
  for (const b of blips) {
    const e = b.getAttribute("embed") || b.getAttribute("r\\:embed") || b.getAttribute("r:embed")
    if (e && relsMap[e]) return relsMap[e]
  }
  const imgs = [...p.querySelectorAll("imagedata")]
  for (const im of imgs) {
    const id = im.getAttribute("id") || im.getAttribute("r\\:id") || im.getAttribute("r:id")
    if (id && relsMap[id]) return relsMap[id]
  }
  return ""
}

function precedingCaptionPi(paragraphs, pi) {
  for (let j = pi - 1; j >= 0 && j >= pi - 3; j--) {
    const t = (paragraphs[j].textContent || "").replace(/\s+/g, " ").trim()
    if (/(?:^|[^A-Za-zА-Яа-я])(?:Рис|Рисунок|Рис\.)\s*\d/i.test(t) || /\bFig\.?\s*\d/i.test(t)) {
      return { pi: j, text: t.slice(0, 120) }
    }
  }
  return null
}

function subsequentCaptionPi(paragraphs, pi) {
  for (let j = pi + 1, seen = 0; j < paragraphs.length && seen < 3; j++) {
    const t = (paragraphs[j].textContent || "").replace(/\s+/g, " ").trim()
    if (!t) {
      seen += 1
      continue
    }
    if (/(?:^|[^A-Za-zА-Яа-я])(?:Рис|Рисунок|Рис\.)\s*\d/i.test(t) || /\bFig\.?\s*\d/i.test(t)) {
      return { pi: j, text: t.slice(0, 120) }
    }
    break
  }
  return null
}

function isEquationProgId(progId) {
  return /(?:Equation|MathType|DSMT)/i.test(progId || "")
}

function textOfParagraph(p) {
  return (p.textContent || "").replace(/\s+/g, " ").trim()
}

function getLabelOnlyParagraph(paragraphs, pi) {
  const p = paragraphs[pi]
  if (!p) return null
  if (p.querySelector("object,OLEObject,oMath,oMathPara,drawing,pict")) return null
  const t = textOfParagraph(p)
  return /^\(\d+\)$/.test(t) ? t : null
}

function walkRunsForEquationLayout(p, onSegment) {
  function handleRun(r) {
    for (const o of r.querySelectorAll("object")) onSegment({ kind: "object", node: o })
    const t = textOfParagraph(r)
    if (t) onSegment({ kind: "text", text: t })
  }
  for (const node of p.children) {
    const name = (node.localName || node.tagName || "").toLowerCase()
    if (name === "ppr") continue
    if (name === "r") handleRun(node)
    else if (name === "hyperlink") {
      for (const child of node.children) {
        const childName = (child.localName || child.tagName || "").toLowerCase()
        if (childName === "r") handleRun(child)
      }
    }
  }
}

function classifyEquationParagraphLayout(p, equationObjects) {
  const eqSet = new Set(equationObjects)
  let before = ""
  let after = ""
  let seen = false
  walkRunsForEquationLayout(p, (seg) => {
    if (seg.kind === "object" && eqSet.has(seg.node)) {
      seen = true
      return
    }
    if (seg.kind === "text") {
      if (!seen) before += seg.text
      else after += seg.text
    }
  })
  const pStyle = getPStyleFromParagraph(p)
  const bt = before.trim()
  const at = after.trim()
  const tailLabel = at.match(/^\(\d+\)$/) ? at : null
  if (/^equation$/i.test(pStyle)) return { display: true, label: tailLabel, oleAfter: at }
  if (bt === "" && tailLabel) return { display: true, label: tailLabel, oleAfter: at }
  if (bt === "" && at === "") return { display: true, label: null, oleAfter: at }
  return { display: false, label: null, oleAfter: at }
}

function peelTailLabels(tail, nOle) {
  const perLabels = Array(nOle).fill(null)
  const rest0 = (tail || "").trim()
  if (!rest0 || nOle < 1) return { perLabels, tailRest: rest0 }
  const labels = []
  let tmp = rest0
  while (tmp.length) {
    const m = tmp.match(/^\s*\((\d+)\)\s*/)
    if (!m) break
    labels.push(`(${m[1]})`)
    tmp = tmp.slice(m[0].length).trim()
  }
  if (labels.length >= nOle) {
    for (let i = 0; i < nOle; i++) perLabels[i] = labels[i]
    return { perLabels, tailRest: tmp }
  }
  if (nOle === 1 && labels.length >= 1) {
    perLabels[0] = labels[0]
    return { perLabels, tailRest: tmp }
  }
  if (nOle > 1 && labels.length === 1) {
    perLabels[nOle - 1] = labels[0]
    return { perLabels, tailRest: tmp }
  }
  return { perLabels, tailRest: rest0 }
}

function normalizeFormulaLatex(s) {
  return String(s || "").replace(/\s+/g, " ").trim()
}

function formulaHash(s) {
  return createHash("sha1").update(normalizeFormulaLatex(s)).digest("hex").slice(0, 12)
}

function decodeXmlAttr(s) {
  return String(s || "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
}

async function inspectEquationMappingInDocx(docxPath) {
  const buf = fs.readFileSync(docxPath)
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
  const prevDocument = globalThis.document
  let html
  try {
    const { document } = parseHTML("<!DOCTYPE html><html><body></body></html>")
    globalThis.document = document
    html = normalizeImportedHtml(rawHtml)
  } finally {
    if (prevDocument) globalThis.document = prevDocument
    else delete globalThis.document
  }

  const stripped = ctx.xmlString
    .replace(/(<\/?)(w|o|m|r|v|wp|pic|a):/gi, "$1")
    .replace(/\s(w|o|m|r|v|wp|pic|a):([a-zA-Z]+)=/g, " $2=")
  const { document: xdoc } = parseHTML(`<root>${stripped}</root>`)
  const paragraphs = Array.from(xdoc.querySelectorAll("p"))

  const sourceRows = []
  for (let pi = 0; pi < paragraphs.length; pi++) {
    const p = paragraphs[pi]
    const pStyle = getPStyleFromParagraph(p)
    const equationObjects = [...p.querySelectorAll("object")].filter((o) => {
      const progId = o.querySelector("OLEObject")?.getAttribute("ProgID") || o.querySelector("OLEObject")?.getAttribute("progID") || ""
      return isEquationProgId(progId)
    })
    if (!equationObjects.length && !/^Equation$/i.test(pStyle)) continue
    const layout = classifyEquationParagraphLayout(p, equationObjects)
    let nextLabel = null
    if (layout.display) nextLabel = getLabelOnlyParagraph(paragraphs, pi + 1)
    const { perLabels } = peelTailLabels(layout.oleAfter || "", equationObjects.length)
    for (let oi = 0; oi < equationObjects.length; oi++) {
      const objectNode = equationObjects[oi]
      const ole = objectNode.querySelector("OLEObject")
      const rid = ole?.getAttribute("id") || ole?.getAttribute("rid") || ""
      const progId = ole?.getAttribute("ProgID") || ole?.getAttribute("progID") || ""
      const target = ctx.oleEmbedRels?.[rid] || null
      const blob = target ? ctx.oleBlobs?.get(target) : null
      const parsed = blob ? parseMathTypeSync(blob) : null
      let label = perLabels[oi]
      if (!label && oi === equationObjects.length - 1) label = layout.label || nextLabel || null
      sourceRows.push({
        pi,
        pStyle,
        source_order: sourceRows.length + 1,
        ole_index_in_paragraph: oi,
        rid,
        progId,
        target,
        paragraph_text: textOfParagraph(p),
        display_expected: layout.display,
        source_label: label,
        source_latex: parsed?.latex || null,
        source_hash: parsed?.latex ? formulaHash(parsed.latex) : null,
      })
    }
  }

  const { document: hdoc } = parseHTML(`<div id="root">${html}</div>`)
  const domBlocks = [...hdoc.querySelectorAll(".math-block")].map((el, index) => ({
    emitted_order: index + 1,
    data_label: el.getAttribute("data-label") || null,
    data_latex: decodeXmlAttr(el.getAttribute("data-latex") || ""),
    data_hash: formulaHash(decodeXmlAttr(el.getAttribute("data-latex") || "")),
    source_ole: el.getAttribute("data-source-ole") || null,
    source_rid: el.getAttribute("data-source-rid") || null,
  }))

  const mismatches = []
  for (const src of sourceRows.filter((row) => row.display_expected)) {
    const dom = src.target
      ? domBlocks.find((row) => row.source_ole === src.target)
      : domBlocks.find((row) => row.data_hash === src.source_hash)
    if (!dom) {
      mismatches.push({
        type: "missing-dom-block",
        target: src.target,
        source_label: src.source_label,
        source_latex: src.source_latex,
      })
      continue
    }
    if ((src.source_label || null) !== (dom.data_label || null)) {
      mismatches.push({
        type: "label-mismatch",
        target: src.target,
        source_label: src.source_label,
        dom_label: dom.data_label,
        source_latex: src.source_latex,
        dom_latex: dom.data_latex,
      })
    }
    if (normalizeFormulaLatex(src.source_latex) !== normalizeFormulaLatex(dom.data_latex)) {
      mismatches.push({
        type: "latex-mismatch",
        target: src.target,
        source_label: src.source_label,
        dom_label: dom.data_label,
        source_latex: src.source_latex,
        dom_latex: dom.data_latex,
      })
    }
  }

  return { docx: docxPath, source_rows: sourceRows, dom_blocks: domBlocks, mismatches }
}

/**
 * @param {string} docxPath
 * @returns {Promise<object>}
 */
export async function inspectFiguresInDocx(docxPath) {
  const buf = fs.readFileSync(docxPath)
  const zip = await JSZip.loadAsync(buf)
  const docXml = await zip.file("word/document.xml")?.async("string")
  const relsXml = await zip.file("word/_rels/document.xml.rels")?.async("string")
  if (!docXml || !relsXml) throw new Error("missing document.xml or rels")
  const relsMap = {}
  for (const m of relsXml.matchAll(/<Relationship\s+[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
    relsMap[m[1]] = m[2]
  }
  const stripped = docXml
    .replace(/(<\/?)(w|o|m|r|v|wp|pic|a):/gi, "$1")
    .replace(/\s(w|o|m|r|v|wp|pic|a):([a-zA-Z]+)=/g, " $2=")
  const { document: hdoc } = parseHTML(`<root>${stripped}</root>`)
  const paragraphs = Array.from(hdoc.querySelectorAll("p"))
  const rows = []
  for (let pi = 0; pi < paragraphs.length; pi++) {
    const p = paragraphs[pi]
    const hints = paragraphImageHints(p)
    if (hints.length === 0) continue
    const media = hasImageRid(p, relsMap)
    const cap = precedingCaptionPi(paragraphs, pi)
    const afterCap = subsequentCaptionPi(paragraphs, pi)
    rows.push({
      image_idx: rows.length + 1,
      pi,
      pStyle: getPStyleFromParagraph(p),
      types: hints.join("+"),
      media_target: media || null,
      preceding_caption_pi: cap?.pi ?? null,
      preceding_caption_text: cap?.text ?? null,
      subsequent_caption_pi: afterCap?.pi ?? null,
      subsequent_caption_text: afterCap?.text ?? null,
    })
  }
  return { docx: docxPath, figure_like_paragraphs: rows }
}

async function analyzeDocx(docxPath) {
  const buf = fs.readFileSync(docxPath)
  const zip = await JSZip.loadAsync(buf)

  const docXml = await zip.file("word/document.xml")?.async("string")
  const relsXml = await zip.file("word/_rels/document.xml.rels")?.async("string")
  if (!docXml || !relsXml) throw new Error("missing document.xml or rels")

  const relsMap = {}
  for (const m of relsXml.matchAll(/<Relationship\s+[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
    relsMap[m[1]] = m[2]
  }

  const oleBlobs = {}
  for (const name of Object.keys(zip.files)) {
    if (/^word\/embeddings\//i.test(name)) {
      oleBlobs[name.replace(/^word\//, "")] = new Uint8Array(await zip.file(name).async("uint8array"))
    }
  }

  const stripped = docXml
    .replace(/(<\/?)(w|o|m|r|v|wp|pic|a):/gi, "$1")
    .replace(/\s(w|o|m|r|v|wp|pic|a):([a-zA-Z]+)=/g, " $2=")
  const { document: hdoc } = parseHTML(`<root>${stripped}</root>`)
  const paragraphs = Array.from(hdoc.querySelectorAll("p"))

  const findings = []
  let runningEqIdx = 0
  for (let pi = 0; pi < paragraphs.length; pi++) {
    const p = paragraphs[pi]
    const text = (p.textContent || "").replace(/\s+/g, " ").trim()
    const oleEls = Array.from(p.querySelectorAll("OLEObject"))
    const oMathEls = Array.from(p.querySelectorAll("oMath"))
    if (!oleEls.length && !oMathEls.length) {
      if (/^\(\d+\)$/.test(text)) findings.push({ pi, type: "lone-label", text })
      continue
    }
    for (const ole of oleEls) {
      runningEqIdx++
      const rid = ole.getAttribute("id") || ole.getAttribute("rid")
      const target = relsMap[rid]
      const blobKey = target ? `embeddings/${path.basename(target)}` : null
      const blob = blobKey ? oleBlobs[blobKey] : null
      let parsed = null
      let err = null
      if (blob) {
        try {
          parsed = parseMathTypeSync(stripOleHeader(blob))
        } catch (e) {
          err = String(e)
        }
      }
      findings.push({
        pi,
        eqIdx: runningEqIdx,
        type: "ole",
        rid,
        target,
        blobBytes: blob ? blob.length : 0,
        mathml: parsed?.mathml?.slice(0, 350) || null,
        latex: parsed?.latex?.slice(0, 200) || null,
        warnings: parsed?.warnings || null,
        paragraphText: text.slice(0, 200),
        err,
      })
    }
    for (const _m of oMathEls) {
      runningEqIdx++
      findings.push({ pi, eqIdx: runningEqIdx, type: "oMath", paragraphText: text.slice(0, 200) })
    }
  }

  return {
    docx: docxPath,
    totalParagraphs: paragraphs.length,
    totalOleBlobs: Object.keys(oleBlobs).length,
    totalEquations: runningEqIdx,
    findings,
  }
}

async function walkDocxFiles(dir, out = []) {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const e of entries) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) await walkDocxFiles(p, out)
    else if (e.isFile() && e.name.toLowerCase().endsWith(".docx") && !e.name.startsWith("~$")) {
      out.push(p)
    }
  }
  return out
}

async function main() {
  const docx = argVal("--docx")
  const all = process.argv.includes("--all")
  const inspectFigures = process.argv.includes("--inspect-figures")
  const inspectEquationMapping = process.argv.includes("--inspect-equation-mapping")
  const root = process.env.CORPUS_DOCX_ROOT || DEFAULT_ROOT

  if (docx && inspectFigures) {
    const report = await inspectFiguresInDocx(path.resolve(docx))
    console.log(JSON.stringify(report, null, 2))
    return
  }
  if (docx && inspectEquationMapping) {
    const report = await inspectEquationMappingInDocx(path.resolve(docx))
    console.log(JSON.stringify(report, null, 2))
    process.exit(report.mismatches.length === 0 ? 0 : 1)
  }
  if (docx) {
    const report = await analyzeDocx(path.resolve(docx))
    console.log(JSON.stringify(report, null, 2))
    return
  }
  if (all) {
    const files = await walkDocxFiles(root)
    const reports = []
    for (const f of files.sort()) {
      try {
        reports.push(inspectEquationMapping ? await inspectEquationMappingInDocx(f) : await analyzeDocx(f))
      } catch (e) {
        reports.push({ docx: f, error: String(e) })
      }
    }
    console.log(JSON.stringify({ root, count: reports.length, reports }, null, 2))
    if (inspectEquationMapping) {
      const mismatchCount = reports.reduce((sum, r) => sum + (Array.isArray(r.mismatches) ? r.mismatches.length : 1), 0)
      process.exit(mismatchCount === 0 ? 0 : 1)
    }
    return
  }

  console.error(
    "Usage: node scripts/formula-diff.mjs --docx <file.docx> [--inspect-figures|--inspect-equation-mapping] | --all [--inspect-equation-mapping]"
  )
  process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
