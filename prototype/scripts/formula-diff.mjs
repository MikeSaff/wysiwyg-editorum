#!/usr/bin/env node
/**
 * Deep-dive: list OLE equations from a DOCX (parseMathTypeSync + paragraph context).
 * Usage: node scripts/formula-diff.mjs --docx path/to/file.docx
 *        node scripts/formula-diff.mjs --all   (walk CORPUX_DOCX_ROOT or Docx/Nauka)
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { readdir } from "node:fs/promises"
import JSZip from "jszip"
import { parseHTML } from "linkedom"
import { parseMathTypeSync } from "mtef-to-mathml"

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
    rows.push({
      image_idx: rows.length + 1,
      pi,
      pStyle: getPStyleFromParagraph(p),
      types: hints.join("+"),
      media_target: media || null,
      preceding_caption_pi: cap?.pi ?? null,
      preceding_caption_text: cap?.text ?? null,
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
  const root = process.env.CORPUS_DOCX_ROOT || DEFAULT_ROOT

  if (docx && inspectFigures) {
    const report = await inspectFiguresInDocx(path.resolve(docx))
    console.log(JSON.stringify(report, null, 2))
    return
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
        reports.push(await analyzeDocx(f))
      } catch (e) {
        reports.push({ docx: f, error: String(e) })
      }
    }
    console.log(JSON.stringify({ root, count: reports.length, reports }, null, 2))
    return
  }

  console.error(
    "Usage: node scripts/formula-diff.mjs --docx <file.docx> [--inspect-figures] | --all"
  )
  process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
