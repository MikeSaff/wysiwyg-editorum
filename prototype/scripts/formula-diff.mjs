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
  const root = process.env.CORPUS_DOCX_ROOT || DEFAULT_ROOT

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

  console.error("Usage: node scripts/formula-diff.mjs --docx <file.docx> | --all")
  process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
